import { fromHtml as mhtmlFromHtml } from './mhtml.js'

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

chrome.runtime.onMessage.addListener((msg, _, respond) => {
	if (msg.type != 'sw-download') return respond()
	
	;(async () => {
		const css =
			await fetch(chrome.runtime.getURL('style.min.css'))
				.then(res => res.text())
		const html =
			HTML_TEMPLATE
				.replace('%css%', css)
				.replace('%article_body%',
					msg.articleBodyHtml
						.replace(/<div id="defaultImage">[^]*?<\/div>/, '') // 짤방 제거
				)
		const mhtml = await mhtmlFromHtml(msg.url, html, msg.imgQuality)
		const [url, revokeUrl] = await getBlobUrl(mhtml)
		await chrome.downloads.download({
			url,
			filename: `${msg.articleId} - ${escapeFileName(msg.articleTitle)}.mhtml`,
			conflictAction: 'uniquify',
		})
		revokeUrl()
		respond()
	})()
	
	return true
})

chrome.contextMenus.create({
	id: 'download-preview',
	title: '이미지 미리보기로 다운로드 (용량 절감)',
	contexts: ['action'],
})
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId == 'download-preview' && tab) {
		await chrome.tabs.sendMessage(tab.id!, {
			type: 'content-download',
			imgQuality: 'preview',
		})
	}
})

const getBlobUrl = (() => {
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
