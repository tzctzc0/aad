import type { Msg } from './types.js'

const fileNameEl = document.querySelector('.file-name')! as HTMLElement
const progressEl = document.querySelector('progress')!
const doneCountEl = document.querySelector('.done-count')! as HTMLElement
const totalCountEl = document.querySelector('.total-count')! as HTMLElement

let downloadId = -1

chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
	await chrome.tabs.sendMessage(tab.id!, {
		type: 'content-download',
		imgQuality: 'original',
	} satisfies Msg.ContentDownload)
})

chrome.runtime.onMessage.addListener((msg: Msg.Any, _, respond) => {
	if (msg.type == 'article-download-init') {
		downloadId = msg.downloadId
		fileNameEl.innerText = msg.fileName
		progressEl.max = msg.totalCount
		totalCountEl.innerText = `${progressEl.max}`
	} else if (msg.type == 'finish-resource-download') {
		if (downloadId != msg.downloadId) return
		
		progressEl.value++
		doneCountEl.innerText = `${progressEl.value}`
		respond()
	} else if (msg.type == 'finish-article-download') {
		if (downloadId != msg.downloadId) return
		
		respond()
		window.close()
	}
})
