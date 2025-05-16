const DEFAULT_MAX_CONCURRENT_RESOURCE_DOWNLOAD = 250
const DEFAULT_IGNORE_GONE_RESOURCES = true

export interface StorageOption<T> {
	defaultValue: T
	getValue: () => Promise<T | null>
	getValueOrDefault: () => Promise<T>
	setValue: (value: T) => Promise<void>
}
const option = <T>(
	name: string,
	defaultValue: T,
): StorageOption<T> => {
	const getValue = async () => {
		const items = await chrome.storage.local.get(name)
		const rawValue = items[name]
		return rawValue ? JSON.parse(rawValue) as T : null
	}
	return {
		defaultValue,
		getValue,
		getValueOrDefault: async () => {
			const value = await getValue()
			return value ?? defaultValue
		},
		setValue: (value: T) =>
			chrome.storage.local.set({
				[name]: JSON.stringify(value),
			}),
	}
}

export const storageOpts = {
	maxConcurrentResourceDownload: option(
		'maxConcurrentResourceDownload',
		DEFAULT_MAX_CONCURRENT_RESOURCE_DOWNLOAD,
	),
	ignoreGoneResources: option(
		'ignoreGoneResources',
		DEFAULT_IGNORE_GONE_RESOURCES,
	),
}
