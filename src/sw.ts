import { fromHtml as mhtmlFromHtml, blobToDataUrl } from './mhtml.js'

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
		const url = await blobToDataUrl(new Blob([mhtml], { type: 'multipart/related' }))
		await chrome.downloads.download({
			url,
			filename: `${msg.articleId} - ${escapeFileName(msg.articleTitle)}.mhtml`,
			conflictAction: 'uniquify',
		})
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
