const fs = require('fs')

const main = () => {
	const css = fs.readFileSync('style.css', 'utf-8')
		.replace(/\/\*[^]*?\*\//g, '') // 주석 제거
	const rules = [...css.matchAll(/(?<=^|\n)([^{\s][^{]*?)\s*{([^}]+?)}/g)]
	// [1]: 셀렉터 (줄이 공백이나 여는 중괄호로 시작하지 않으면 됨)
	// [2]: 중괄호 안의 몸체

	let res = ''

	for (let [_, sel, body] of rules) {
		if (!isTarget(sel)) continue
		
		if (isGlobalSelector(sel)) sel = reduceGlobalSelector(sel)
		sel = removeOutScopedSelector(sel)
		body = reduceRuleBody(body)
		
		res += `${sel}{${body}}`
	}

	res += [
		`html{${reduceRuleBody(`
			--color-bg-body: #eee;
			--color-bg-main: #fff;
			--color-text: #000;
			--color-link: #0275d8;
			--color-bd-outer: #bbb;
		`)}}`,
		`@media(prefers-color-scheme:dark){html{${reduceRuleBody(`
			--color-bg-body: #111;
			--color-bg-main: #222;
			--color-text: #d3d3d3;
			--color-link: #ec9f19;
			--color-bd-outer: #43494c;
		`)}}}`,
		`body{${reduceRuleBody(`
			display: flex;
			flex-direction: column;
			align-items: center;
			color: var(--color-text);
			background-color: var(--color-bg-body);
		`)}}`,
		`.content-wrapper{${reduceRuleBody(`
			max-width: min(800px, 100vw);
			background-color: var(--color-bg-main);
		`)}}`,
	].join('')

	fs.writeFileSync('style.min.css', res, 'utf-8')
}

const isArticleContentSelector = sel =>
	sel.includes('.article-body') || sel.includes('.article-content')
const isSeriesSelector = sel =>
	sel.includes('series')
const isGlobalSelector = sel =>
	/^[\w\[]/.test(sel)
const isTwemojiSelector = sel =>
	sel.includes('.twemoji')
const isTarget = sel =>
	(sel == 'html' || !sel.includes('html')) && (
		isGlobalSelector(sel)
			|| isArticleContentSelector(sel)
			|| isSeriesSelector(sel)
			|| isTwemojiSelector(sel)
	)

const reduceGlobalSelector = sel =>
	sel.match(/^(\w+),\.\1$/)?.[1] ?? sel
const removeOutScopedSelector = sel =>
	sel
		.replace(/\.(body|board-article) /g, '')
		.replace(/^\.body$/, 'body')
const reduceRuleBody = body =>
	body.replace(/(?<=^|;|:)\s+|\s+$/g, '') // 쓸모없는 공백 제거

main()
