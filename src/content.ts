chrome.runtime.onMessage.addListener(msg => {
	if (msg.type != 'content-download') return
	
	if (!document.querySelector('.article-wrapper')) return // 글 페이지가 아님
	
	const url = new URL(document.querySelector<HTMLAnchorElement>('.article-link a')!.href)
	
	const titleNode = document.querySelector('.article-head .title')!.cloneNode(true) as HTMLElement
	titleNode.querySelector('.category-badge')?.remove()
	const articleTitle = titleNode.innerText.trim()
	
	chrome.runtime.sendMessage({
		type: 'sw-download',
		url: url.href,
		articleId: url.pathname.split('/').at(-1),
		articleTitle,
		articleBodyHtml:
			document.querySelector('.article-body')!
				.outerHTML
				.replace(/&(?:amp|lt|gt|quot|#(0+)?39);/g, m => // from lodash
					({
						'&amp;': '&',
						'&lt;': '<',
						'&gt;': '>',
						'&quot;': '"',
						'&#39;': '\'',
					})[m] ?? '\''
				),
	})
})
