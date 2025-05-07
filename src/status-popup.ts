// NOTE: we do not need to consider adding new download,
// since this popup is mutually exclusive to download popup
// so new downloads cannot be added unless this popup is closed

import type { DownloadStatusListItem, Msg } from './types.js'

const downloadListEl = document.getElementById('status-list')!

const statuses = await chrome.runtime.sendMessage<any, DownloadStatusListItem[]>({
	type: 'get-download-status-list',
})

const createDownloadItem = (item: DownloadStatusListItem) => {
	const itemEl = document.createElement('li')
	itemEl.className = 'status-item'
	itemEl.dataset.downloadId = `${item.downloadId}`
	itemEl.innerHTML = `
		<div class="status-item-inner">
			<div class="file-name"></div>
			<div>
				<span class="done-count"></span>/<span class="total-count"></span>
			</div>
			<progress value="0" max="1"></progress>
		</div>
	`
	const fileNameEl = itemEl.querySelector('.file-name')! as HTMLElement
	const progressEl = itemEl.querySelector('progress')!
	const doneCountEl = itemEl.querySelector('.done-count')! as HTMLElement
	const totalCountEl = itemEl.querySelector('.total-count')! as HTMLElement
	fileNameEl.innerText = item.fileName
	fileNameEl.title = item.fileName
	progressEl.value = item.doneCount
	progressEl.max = item.totalCount
	doneCountEl.innerText = `${item.doneCount}`
	totalCountEl.innerText = `${item.totalCount}`
	return itemEl
}
for (const status of statuses) {
	downloadListEl.appendChild(createDownloadItem(status))
}

chrome.runtime.onMessage.addListener((msg: Msg.Any) => {
	if (msg.type == 'article-download-init') {
		throw new Error('Logically here can never be reached; What happened?')
	} else if (msg.type == 'finish-resource-download') {
		finishResourceDownload(msg.downloadId)
	} else if (msg.type == 'finish-article-download') {
		finishArticleDownload(msg.downloadId)
	}
})

const finishResourceDownload = (downloadId: number) => {
	const itemEl = downloadListEl.querySelector(`[data-download-id="${downloadId}"]`)
	if (!itemEl) return
	
	const progressEl = itemEl.querySelector('progress')!
	const doneCountEl = itemEl.querySelector('.done-count')! as HTMLElement
	progressEl.value++
	doneCountEl.innerText = `${progressEl.value}`
}
const finishArticleDownload = (downloadId: number) => {
	downloadListEl.querySelector(`[data-download-id="${downloadId}"]`)?.remove()
}
