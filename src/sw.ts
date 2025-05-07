import * as Mhtml from './mhtml.js'
import type { DownloadStatus, DownloadStatusOperation, Msg } from './types.js'

declare const self: ServiceWorkerGlobalScope

const HTML_TEMPLATE = `
	<!DOCTYPE html>
	<html>
		<head>
			<style>%css%</style>
		</head>
		<body>
			<div class="content-wrapper">%article_body%</div>
		</body>
	</html>
`

const escapeFileName = (fileName: string) =>
	fileName.replace(/[\\/:*?"<>|]/g, '_')

let downloadId = 0
const downloadStatuses = new Map<number, DownloadStatus>()

const minifiedStyleUrl = chrome.runtime.getURL('style.min.css')
chrome.runtime.onMessage.addListener((msg, _, respond) => {
	if (msg.type == 'sw-download') {
		const currentId = downloadId++
		const fileName = `${msg.articleId} - ${escapeFileName(msg.articleTitle)}`
		
		const downloadStatusOp: DownloadStatusOperation = {
			init: (totalCount: number) => {
				downloadStatuses.set(currentId, {
					fileName,
					doneCount: 0,
					totalCount,
				})
				chrome.runtime.sendMessage({
					type: 'init-article-download',
					downloadId: currentId,
					fileName,
					totalCount,
				} satisfies Msg.InitArticleDownload)
			},
			finishResource: () => {
				const status = downloadStatuses.get(currentId)!
				status.doneCount++
				chrome.runtime.sendMessage({
					type: 'finish-resource-download',
					downloadId: currentId,
				} satisfies Msg.FinishResourceDownload)
			},
		}
		const finishDownload = () => {
			downloadStatuses.delete(currentId)
			chrome.runtime.sendMessage({
				type: 'finish-article-download',
				downloadId: currentId,
			} satisfies Msg.FinishArticleDownload)
		}
		;(async () => {
			const css =
				await fetch(minifiedStyleUrl)
					.then(res => res.text())
			const html =
				HTML_TEMPLATE
					.replace('%css%', css)
					.replace('%article_body%',
						msg.articleBodyHtml
							.replace(/<div id="defaultImage">[^]*?<\/div>/, '') // 짤방 제거
					)
			const mhtmlBlob = await Mhtml.fromHtml(msg.url, html, msg.imgQuality, downloadStatusOp)
			const [url, revokeUrl] = await getBlobUrl(mhtmlBlob)
			finishDownload()
			await chrome.downloads.download({
				url,
				filename: `${fileName}.mhtml`,
				conflictAction: 'uniquify',
			})
			revokeUrl()
			respond({ ok: true })
		})()
			.catch(err => {
				console.error(err)
				respond({ ok: false })
			})
		
		return true
	} else if (msg.type == 'get-download-status-list') {
		respond(
			downloadStatuses.entries()
				.map(([id, status]) => ({
					id,
					...status,
				}))
				.toArray()
		)
	}
})

const ignoreIfDuplicate = (err: chrome.runtime.LastError | undefined) => {
	if (!err) return
	
	if (err.message?.includes('Cannot create item with duplicate id')) {
		// ignore
	} else {
		throw err
	}
}
chrome.contextMenus.create({
	id: 'download-preview',
	title: '이미지 미리보기로 다운로드 (용량 절감)',
	contexts: ['action'],
}, () => ignoreIfDuplicate(chrome.runtime.lastError))
chrome.contextMenus.create({
	id: 'view-status',
	title: '다운로드 상태 보기',
	contexts: ['action'],
}, () => ignoreIfDuplicate(chrome.runtime.lastError))

const openPopup = async (file: string) => {
	await chrome.action.setPopup({ popup: file })
	await chrome.action.openPopup()
	
	// NOTE: to receive click event in chrome.action again,
	// we have to remove popup (this does not close opened popup)
	await chrome.action.setPopup({ popup: '' })
}
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (!tab) return
	
	if (info.menuItemId == 'download-preview') {
		await openPopup('popup.html')
		await chrome.tabs.sendMessage(tab.id!, {
			type: 'content-download',
			imgQuality: 'preview',
		} satisfies Msg.ContentDownload)
	} else if (info.menuItemId == 'view-status') {
		await openPopup('status-popup.html')
	}
})
chrome.action.onClicked.addListener(async tab => {
	if (!tab) return
	
	await openPopup('popup.html')
	await chrome.tabs.sendMessage(tab.id!, {
		type: 'content-download',
		imgQuality: 'original',
	} satisfies Msg.ContentDownload)
})

const getBlobUrl = (() => {
	// https://stackoverflow.com/a/77426685/#77427098
	// https://developer.chrome.com/docs/extensions/reference/api/offscreen
	
	let creating: Promise<void> | null = null
	
	const setupOffscreenDoc = async (offscreenUrl: string) => {
		const existingContexts = await chrome.runtime.getContexts({
			contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
			documentUrls: [offscreenUrl],
		})
		if (existingContexts.length > 0) return
		
		if (creating) await creating
		else {
			creating = chrome.offscreen.createDocument({
				url: offscreenUrl,
				reasons: [chrome.offscreen.Reason.BLOBS],
				justification: 'Download a blob.',
			})
			await creating
			creating = null
		}
	}
	return async (blob: Blob) => {
		const offscreenUrl = chrome.runtime.getURL('offscreen.html')
		await setupOffscreenDoc(offscreenUrl)
		const matchedClients = await self.clients.matchAll({ includeUncontrolled: true })
		const client = matchedClients.find(c => c.url === offscreenUrl)!
		const chan = new MessageChannel()
		client.postMessage(blob, [chan.port2])
		return new Promise<[string, () => void]>(resolve => {
			chan.port1.addEventListener('message', e => {
				resolve([e.data, () => client.postMessage(e.data)])
				chan.port1.close()
			}, { once: true })
			chan.port1.start()
		})
	}
})()
