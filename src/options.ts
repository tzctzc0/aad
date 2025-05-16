import { storageOpts, type StorageOption } from './storage-options.js'

const form = document.querySelector('form')!
form.addEventListener('submit', async e => {
	e.preventDefault()
	
	const updateIfChanged = async <T>(opt: Option<T>, whenChanged?: (value: T) => void) => {
		const oldValue = await opt.getValue()
		const value = opt.getValueFromElem()
		
		if (oldValue === value) return
		opt.setValue(value)
		whenChanged?.(value)
	}
	
	updateIfChanged(await opts.maxConcurrentResourceDownload, size => {
		chrome.runtime.sendMessage({
			type: 'refresh-resource-download-pool-size',
			size,
		})
	})
	updateIfChanged(await opts.ignoreGoneResources)
})

type Option<T, E extends HTMLElement = HTMLElement> = StorageOption<T> & {
	elem: E
	getValueFromElem: () => T
	setValueToElem: (value: T) => void
}
const option = async <T, E extends HTMLElement>(
	base: StorageOption<T>,
	getElem: () => E,
	getValueFromElem: (elem: E) => T,
	setValueToElem: (elem: E, value: T) => void,
	setupElem?: (elem: E) => void,
) => {
	const elem = getElem()
	
	setupElem?.(elem)
	
	const value = await base.getValue()
	if (value != null) setValueToElem(elem, value)
	
	return {
		...base,
		elem,
		getValueFromElem: () => getValueFromElem(elem),
		setValueToElem: (value: T) => setValueToElem(elem, value),
	}
}

const maxConcurrentResourceDownload = option(
	storageOpts.maxConcurrentResourceDownload,
	() => document.getElementById('max-concurrent-resource-download')! as HTMLInputElement,
	elem => elem.valueAsNumber,
	(elem, value) => elem.valueAsNumber = value,
	elem => {
		elem.placeholder = `${storageOpts.maxConcurrentResourceDownload.defaultValue}`
	},
)
const ignoreGoneResources = option(
	storageOpts.ignoreGoneResources,
	() => document.getElementById('ignore-gone-resources')! as HTMLInputElement,
	elem => elem.checked,
	(elem, value) => elem.checked = value,
)
export const opts = {
	maxConcurrentResourceDownload,
	ignoreGoneResources,
}
