import { AsyncTaskContext, AsyncTaskPool } from './async-task-pool.js'
import type { DownloadStatusOperation } from './types.js'

const BOUNDARY = '--boundary--'
const LINE_BREAK = '\r\n'

type ImgQuality = 'preview' | 'original'

const resourceDownloadPool = new AsyncTaskPool(250)

export const fromHtml = async (url: string, html: string, imgQuality: ImgQuality, statusOp: DownloadStatusOperation) => {
	const rootUrl = new URL(url)
	const resourceUrls = extractResourceUrls(html, rootUrl, imgQuality)
	
	statusOp.init(resourceUrls.length)
	
	const ctx = new AsyncTaskContext()
	let resources
	try {
		resources = await Promise.all(
			resourceUrls.map(async url => {
				const [finalUrl, blob] = await (async () => {
					try {
						return [url.rendering, await fetchBlobAssumingOk(url.rendering, ctx)]
					} catch (err) {
						if (url.rendering == url.preview) throw err
						
						console.warn(err)
						return [url.preview, await fetchBlobAssumingOk(url.preview, ctx)]
					}
				})()
				
				statusOp.finishResource()
				
				return [
					url.raw,
					finalUrl,
					blob,
				] as const
			})
		)
	} catch (err) {
		ctx.interrupt()
		throw err
	}
	
	for (const [oldUrl, newUrl] of resources) {
		html = html.replaceAll(new RegExp(`"${escapeForRegex(oldUrl)}"`, 'g'), `"${newUrl}"`)
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
const fetchBlobAssumingOk = async (url: string, ctx: AsyncTaskContext) => {
	const resp = await resourceDownloadPool.queue(() => fetch(url), ctx)
	if (!resp.ok) {
		const textBody = await resp.text()
		throw new Error(`Failed to fetch ${url} with status code ${resp.status}: ${textBody}`)
	}
	return await resp.blob()
}
const textBlob = (text: string) =>
	new Blob([text])
const escapeForRegex = (str: string) =>
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
				const isTwemoji = /<img[^>]*\btwemoji\b/.test(linkedImgHtml)
				const isEmoticon = /<img[^>]*\bemoticon\b/.test(linkedImgHtml)
				
				const preview = makeUrlExplicit(url, rootUrl)
				const original = origUrl ? makeUrlExplicit(origUrl, rootUrl) : preview
				
				return [
					url,
					{
						raw: url,
						preview,
						original,
						rendering:
							isTwemoji || isEmoticon
								? preview
								: {
									preview,
									original,
								}[imgQuality],
					},
				] as const
			})
	).values()]

const ASCII_LAST_CHAR = '\x7F'
const makeHtmlAsciiOnly = (html: string) => {
	let res = ''
	for (const ch of html) {
		res +=
			ch <= ASCII_LAST_CHAR
				? ch
				: `&#x${ch.codePointAt(0)!.toString(16)};`
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
