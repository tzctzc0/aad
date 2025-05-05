navigator.serviceWorker.addEventListener('message', e => {
	const data = e.data
	if (data instanceof Blob) {
		// create object URL
		e.ports[0].postMessage(URL.createObjectURL(e.data))
	} else {
		// revoke object URL
		URL.revokeObjectURL(data)
	}
})
navigator.serviceWorker.startMessages()
