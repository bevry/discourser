import DiscourseAPI from './index.js'
import { log, mkdirp, readJSON } from './util.js'
import { resolve as pathResolve } from 'path'
import links, { resolve, follow } from '@bevry/links'
import escape from 'regexp.escape'
import { PostResponse } from './types.js'
import Errlop from 'errlop'

const replacements: Array<[string, string]> = [
	['Feedback Category', 'Build Category'],
	['Jordan B Peterson Study Group', 'Study Group'],
	['JBP Study Group', 'Study Group'],
]

interface Configuration {
	host: string
	key: string
	username: string
	cache?: string
	dry?: boolean
}

async function readConfiguration(): Promise<Configuration> {
	const cwd = process.cwd()
	const configPath = pathResolve(
		cwd,
		process.env.DISCOURSER_CONFIG_PATH || 'discourser.json'
	)
	let config: Configuration
	try {
		config = await readJSON<Configuration>(configPath)
	} catch (err) {
		throw new Errlop(
			`You must create a valid configuration file at: ${configPath}`,
			err
		)
	}
	if (config.cache) {
		config.cache = pathResolve(cwd, config.cache)
	}
	if (config.dry == null) {
		config.dry = process.argv.includes('--dry')
	}
	return config
}

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

function modifier({ raw }: PostResponse): { result: string; reason?: string } {
	const reasons = new Set()
	let result = raw,
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
	// prepare
	const config: Configuration = await readConfiguration()
	if (config.cache) {
		await mkdirp(config.cache)
	}
	const api = new DiscourseAPI(config)

	// fetch
	const allPosts = await api.getPosts()

	// find and replace
	const results = await api.modifyPosts(allPosts, modifier)
	log('found and replaced', results, results.length)

	// timestamp correction for meeting topics
	// const meetingCategoryID = 13
	// @todo

	// timestamp correction for youtube video topics
	const youtubeCategoryID = 44
	const youtubePostItems = await api.getPostItemsOfCategory(youtubeCategoryID)
	const youtubePosts = await api.getPosts(youtubePostItems.map((i) => i.id))
	youtubePosts.forEach((post) => {
		log('youtube post:', post.id, post.raw)
	})
	log('youtube posts:', youtubePosts.length)
}

cli()
