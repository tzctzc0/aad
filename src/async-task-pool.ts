type AsyncTask<T> = () => Promise<T>

export class AsyncTaskContext {
	interrupted = false
	interrupt() { this.interrupted = true }
}
class QueuedAsyncTask<T> {
	running = false
	next: QueuedAsyncTask<any> | null = null
	promise: Promise<T>
	private resolve: (result: T) => void
	private reject: (err?: unknown) => void
	private task: AsyncTask<T>
	private ctx: AsyncTaskContext
	constructor(task: AsyncTask<T>, ctx: AsyncTaskContext) {
		const { promise, resolve, reject } = Promise.withResolvers<T>()
		this.promise = promise
		this.resolve = resolve
		this.reject = reject
		this.task = task
		this.ctx = ctx
	}
	async run() {
		if (this.running) return
		
		if (this.ctx.interrupted) {
			this.reject(new Error('Task interrupted.'))
			return
		}
		
		this.running = true
		await this.task()
			.then(this.resolve, this.reject)
			.catch(() => {})
	}
}
class AsyncTaskQueue {
	private size = 0
	private firstTask: QueuedAsyncTask<any> | null = null
	private lastTask: QueuedAsyncTask<any> | null = null
	private runningTask: QueuedAsyncTask<any> | null = null
	get sizeIncludeRunning() {
		return this.size + (this.runningTask ? 1 : 0)
	}
	get isFree() {
		return !this.runningTask && this.size == 0
	}
	private run(task: QueuedAsyncTask<any>) {
		this.runningTask = task
		this.size--
		task.run()
		const runNextTask = () => {
			if (this.lastTask == task) {
				// ran every task, clean up
				this.lastTask = null
				this.runningTask = null
				return
			}
			
			if (this.firstTask) {
				const task = this.firstTask
				this.firstTask = this.firstTask?.next ?? null
				this.run(task)
			} else {
				this.runningTask = null
			}
		}
		task.promise.then(runNextTask, runNextTask)
	}
	add<T>(task: AsyncTask<T>, ctx: AsyncTaskContext): Promise<T> {
		return this.addRaw(new QueuedAsyncTask(task, ctx))
	}
	addRaw(task: QueuedAsyncTask<any>) {
		if (this.isFree) {
			// run immediately
			this.size++
			this.run(task)
		} else {
			// add to queue
			const oldLast = this.lastTask
			this.firstTask ??= task
			if (oldLast) oldLast.next = task
			this.lastTask = task
			this.size++
		}
		return task.promise
	}
	takeItemsLazy(): QueuedAsyncTask<any> | null {
		const first = this.firstTask
		this.firstTask = null
		this.lastTask = null
		return first
	}
}
export class AsyncTaskPool {
	private size: number
	private queues: Array<AsyncTaskQueue> = []
	constructor(size: number) {
		if (size <= 0) throw new RangeError()
		this.size = size
	}
	queue<T>(task: () => Promise<T>, ctx: AsyncTaskContext): Promise<T> {
		const idleQueue = this.findOrCreateIdleQueue()
		return idleQueue.add(task, ctx)
	}
	private *iterFromQueuesItems(items: (QueuedAsyncTask<any> | null)[]): IterableIterator<QueuedAsyncTask<any>> {
		while (true) {
			let yieldedSomething = false
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (!item) continue
				
				yield item
				items[i] = item.next
				yieldedSomething = true
			}
			if (!yieldedSomething) break
		}
	}
	resize(size: number) {
		if (size == this.size) return
		this.size = size
		
		let fillingRunning = true
		const iter = this.iterFromQueuesItems(this.queues.map(q => q.takeItemsLazy()))
		for (let i = 0; ; i = (i + 1) % size) {
			const queue = this.getOrCreateQueue(i)
			if (fillingRunning) {
				if (queue.isFree) {
					const item = iter.next()
					if (item.done) break
					
					queue.addRaw(item.value)
				}
				if (i == size - 1) fillingRunning = false
			} else {
				const item = iter.next()
				if (item.done) break
				
				queue.addRaw(item.value)
			}
		}
	}
	getOrCreateQueue(index: number) {
		this.queues[index] ??= new AsyncTaskQueue()
		return this.queues[index]
	}
	findOrCreateIdleQueue() {
		let smallest = {
			index: -1,
			size: Infinity,
		}
		for (let i = 0; i < this.queues.length; i++) {
			const queue = this.queues[i]
			const size = queue.sizeIncludeRunning
			
			if (size == 0) return queue
			
			if (size < smallest.size) {
				smallest = {
					index: i,
					size,
				}
			}
		}
		
		if (smallest.index == -1 || this.queues.length < this.size) {
			const queue = new AsyncTaskQueue()
			this.queues.push(queue)
			return queue
		}
		
		const smallestQueue = this.queues[smallest.index]
		return smallestQueue
	}
}
