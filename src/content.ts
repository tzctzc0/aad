type ContentDownload = import('./types.js').Msg.ContentDownload

chrome.runtime.onMessage.addListener((msg: ContentDownload) => {
	if (msg.type != 'content-download') return
	
	if (!document.querySelector('.article-wrapper')) return // 글 페이지가 아님
	
	const url = new URL(document.querySelector<HTMLAnchorElement>('.article-link a')!.href)
	
	const titleNode = document.querySelector('.article-head .title')!.cloneNode(true) as HTMLElement
	titleNode.querySelector('.category-badge')?.remove()
	const articleTitle = titleNode.innerText.trim()
	
	chrome.runtime.sendMessage({
		type: 'sw-download',
		imgQuality: msg.imgQuality,
		url: url.href,
		articleId: url.pathname.split('/').at(-1),
		articleTitle,
		articleBodyHtml: document.querySelector('.article-body')!.outerHTML,
	})
		.then(res => {
			if (!res.ok) alert(`${url} 다운로드 실패 (chrome://extensions 확인 바람)`)
		})
})
