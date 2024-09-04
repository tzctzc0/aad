chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
	await chrome.tabs.sendMessage(tab.id!, { type: 'content-download' })
	
	window.close()
})
