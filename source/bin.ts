import DiscourseAPI from './index.js'
import { log, mkdirp } from './util.js'
import { join } from 'path'
import { Post } from './types.js'
import links, { resolve, follow } from '@bevry/links'
import escape from 'regexp.escape'

const opts = {
	host: 'https://discuss.bevry.me',
	key: 'xxx',
	username: 'xxx',
	cache: join(process.cwd(), 'data'),
	dry: process.argv.includes('--dry'),
}
const topicID = 0

const replacements: Array<[string, string]> = [
	['Feedback Category', 'Build Category'],
	['Jordan B Peterson Study Group', 'Study Group'],
	['JBP Study Group', 'Study Group'],
]

// as string replacements only occur once, keep doing it until it is a no-op
function replaceAll(content: string, find: string, replace: string): string {
	let result = content
	while (true) {
		const swap = result.replace(find, replace)
		if (swap === result) break
		result = swap
	}
	return result
}

const urlBoundary = '([\\s"`\'()[\\]<>])'
function replaceAllURL(content: string, find: string, replace: string): string {
	const f = new RegExp(urlBoundary + escape(find) + urlBoundary, 'ig')
	const r = '$1' + replace + '$2'
	return content.replace(f, r)
}

function replacer(content: string): { result: string; reason?: string } {
	const reasons = new Set()
	let result = content,
		reason: string = 'api update'

	// urls
	const urlSource = result
	for (const key of Object.keys(links)) {
		const resolved = resolve(key)
		// would replace things like bevry.me with the forum page
		// const followed = follow(key)
		// if (followed.url.startsWith(opts.host)) {
		// 	result = replaceAllURL(result, key, followed.url)
		// } else
		if (resolved.redirection === 'permanent') {
			result = replaceAllURL(result, key, resolved.url)
		}
	}
	if (result !== urlSource) {
		reasons.add('links update')
	}

	// add the manual replacements
	const manualSource = result
	for (const [find, replace] of replacements) {
		result = replaceAll(result, find, replace)
	}
	if (result !== manualSource) {
		reasons.add('manual update')
	}

	// return
	if (reasons.size) {
		reason += ': ' + Array.from(reasons.values()).join(', ')
	}
	return { result, reason }
}

async function cli() {
	await mkdirp(opts.cache)
	const api = new DiscourseAPI(opts)

	let posts: Post[]
	if (topicID) {
		posts = await api.getPostsOfTopic(topicID)
	} else {
		posts = await api.getPosts()
	}

	const results = await api.findAndReplacePosts(posts, replacer)
	log('results', results)
	log('all done', results.length)
}

cli()
