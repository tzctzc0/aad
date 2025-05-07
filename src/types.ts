export interface DownloadStatus {
	fileName: string
	doneCount: number
	totalCount: number
}
export interface DownloadStatusListItem extends DownloadStatus {
	downloadId: number
}
export interface DownloadStatusOperation {
	init: (total: number) => void
	finishResource: () => void
}

export namespace Msg {
	export type Any =
		| InitArticleDownload
		| FinishResourceDownload
		| FinishArticleDownload
	export interface ContentDownload {
		type: 'content-download'
		imgQuality: 'preview' | 'original'
	}
	export interface InitArticleDownload {
		type: 'init-article-download'
		downloadId: number
		fileName: string
		totalCount: number
	}
	export interface FinishResourceDownload {
		type: 'finish-resource-download'
		downloadId: number
	}
	export interface FinishArticleDownload {
		type: 'finish-article-download'
		downloadId: number
	}
}
