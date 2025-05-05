const BOUNDARY = '--boundary--'
const LINE_BREAK = '\r\n'

type ImgQuality = 'preview' | 'original'

export const fromHtml = async (url: string, html: string, imgQuality: ImgQuality) => {
	const resources = await extractResources(html, new URL(url), imgQuality)
	
	for (const [oldUrl, newUrl] of resources) {
		html = html.replaceAll(new RegExp(`(?<=")${escapeRegex(oldUrl)}(?=")`, 'g'), newUrl)
	}
	
	const parts = [
		textBlob(joinLines([
			`Snapshot-Content-Location: ${url}`,
			'MIME-Version: 1.0',
			`Content-Type: multipart/related; type="text/html"; boundary="${BOUNDARY}"`,
			'',
			resourceHeaderIncludeBoundary('text/html', null, url),
			makeHtmlAsciiOnly(html),
			'',
		])),
		...resources.flatMap(([_, url, blob]) => [
			textBlob(resourceHeaderIncludeBoundary(blob.type, 'binary', url)),
			textBlob(LINE_BREAK),
			blob,
			textBlob(LINE_BREAK),
		]),
		textBlob(`--${BOUNDARY}--`),
	]
	
	return new Blob(parts, { type: 'multipart/related' })
}
const textBlob = (text: string) =>
	new Blob([text])
const escapeRegex = (str: string) =>
	str.replace(/[?.]/g, '\\$&')
const joinLines = (lines: string[]) =>
	lines.join(LINE_BREAK)

const resourceHeaderIncludeBoundary = (contentType: string, transferEncoding: string | null, url: string) =>
	joinLines([
		`--${BOUNDARY}`,
		`Content-Type: ${contentType}`,
		...transferEncoding
			? [`Content-Transfer-Encoding: ${transferEncoding}`]
			: [],
		`Content-Location: ${url}`,
		'',
	])

const makeUrlExplicit = (url: string, rootUrl: URL) => {
	if (url.startsWith('//')) return rootUrl.protocol + url
	if (url.startsWith('/')) return rootUrl.origin + url
	return url
}
const extractResourceUrls = (html: string, rootUrl: URL, imgQuality: ImgQuality) =>
	[...new Map( // 같은 url은 한번만 나오도록
		[...html.matchAll(/(?:<a href="([^"]+?)"[^>]*>\s*)?(?:<(?:video|img)[^>]*\bsrc=")(.+?)"/g)]
			.map(([linkedImgHtml, origUrl, url]) => {
				const isEmoticon = /<img[^>]*\bemoticon\b/.test(linkedImgHtml)
				return [
					url,
					[
						url,
						{
							preview: () => makeUrlExplicit(url, rootUrl),
							original: () => makeUrlExplicit(origUrl ?? url, rootUrl),
						}[isEmoticon ? 'preview' : imgQuality](),
					],
				] as const
			})
	).values()]
const extractResources = (html: string, rootUrl: URL, imgQuality: ImgQuality) =>
	Promise.all(
		extractResourceUrls(html, rootUrl, imgQuality)
			.map(async ([oldUrl, renderingUrl]) => [
				oldUrl,
				renderingUrl,
				await fetch(renderingUrl)
					.then(r => r.blob()),
			] as const)
	)

const ASCII_LAST_CHAR = '\x7F'
const makeHtmlAsciiOnly = (html: string) => {
	let res = ''
	let prevCh
	for (const ch of html) {
		res +=
			ch <= ASCII_LAST_CHAR
				? ch
				: `&#x${ch.codePointAt(0)!.toString(16)};`
		prevCh = ch
	}
	return res
}

export const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.addEventListener('load', () => resolve(reader.result as string))
		reader.addEventListener('error', reject)
		reader.readAsDataURL(blob)
	})
