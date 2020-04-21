import DiscourseAPI, { DiscourserConfiguration } from './index.js'
import { log, mkdirp, readJSON, writeJSON } from './util.js'
import { resolve as pathResolve } from 'path'
import links, { resolve } from '@bevry/links'
import util from 'util'
import escape from 'regexp.escape'
import { PostResponse, TopicItem } from './types/discourse.js'
import Errlop from 'errlop'
import { JSDOM } from 'jsdom'
import {
	extractYoutubeID,
	extractYoutubePlaylistID,
	replace as replaceTimestamps,
} from 'extract-timestamp'
import { getYoutubeVideo } from './youtube.js'
import {
	Database,
	Video,
	Note,
	Thread,
	Discussion,
	Series,
	User,
	Comment,
} from './types/bevry.js'

const youtubeCategoryID = 44
const meetingCategoryID = 13

const replacements: Array<[string, string]> = [
	['Feedback Category', 'Build Category'],
	['Jordan B Peterson Study Group', 'Study Group'],
	['JBP Study Group', 'Study Group'],
]

function getElement(value: string): HTMLElement {
	// make element
	const el = JSDOM.fragment(`<article>${value}</article>`) as HTMLElement
	// remove embeds to other posts to prevent selectors from getting the wrong data
	for (const aside of el.querySelectorAll('aside')) {
		aside.remove()
	}
	// return
	return el
}

async function readConfiguration(): Promise<DiscourserConfiguration> {
	const cwd = process.cwd()
	const configPath = pathResolve(
		cwd,
		process.env.DISCOURSER_CONFIG_PATH || 'discourser.json'
	)
	let config: DiscourserConfiguration
	try {
		config = await readJSON<DiscourserConfiguration>(configPath)
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
	try {
		// prepare
		const config = await readConfiguration()
		if (config.cache) {
			await mkdirp(config.cache)
		}
		const api = new DiscourseAPI(config)

		// find and replace
		// const allPosts = await api.getPosts()
		// const results = await api.modifyPosts(allPosts, modifier)
		// log('found and replaced', results, results.length)

		// timestamp correction for meeting topics
		// @todo

		// prepare database
		const database: Database = {
			users: {},
			videos: {},
			series: {},
			youtube: {},
		}

		// prepare topics
		const meetingTopics = await api.getTopicItemsOfCategory(meetingCategoryID)
		const meetingTopicsByURL: { [key: string]: TopicItem } = {}
		meetingTopics.forEach((topic) => {
			meetingTopicsByURL[api.getTopicURL(topic)] = topic
			meetingTopicsByURL[api.getTopicURL(topic.id)] = topic
		})

		// prepare tags to series aka playlist
		const tagsOfSeries = [
			'meaning-crisis',
			'jbp-meaning',
			'jbp-personality',
			'jbp-bible',
		]
		const categoryToTag: {
			// category
			[key: number]: {
				// tag
				[key: string]: {
					youtubePlaylistID?: string
					series?: Series
					videos: Video[]
				}
			}
		} = {
			[meetingCategoryID]: {
				'meaning-crisis': {
					youtubePlaylistID: 'PL68A9KvUGBlpbAfU5sqgTOW-_HpQijEbF',
					videos: [],
				},
				'jbp-bible': {
					youtubePlaylistID: 'PL68A9KvUGBlo5Ic53iV6o6zasbd4aR-cM',
					videos: [],
				},
				'jbp-meaning': {
					youtubePlaylistID: 'PL68A9KvUGBloIxS4e96ucnFmSH3F-YbID',
					videos: [],
				},
				// book: 'PL68A9KvUGBlq-szz3LSLufczHzYntrLR3',
				// interview: 'PL68A9KvUGBlqxyJFFwTyAcNLaWQ7qtQCJ',
			},
		}

		// prepare
		async function threadToYoutube(thread: Thread): Promise<Video | null> {
			// prepare
			const { topic, post, replies } = thread
			const postElement = getElement(post.cooked)

			// fetch youtube vieo id
			const youtubeVideoID = extractYoutubeID(postElement)
			if (!youtubeVideoID) {
				log(`post`, post.id, `did not contain a youtube video ID`)
				return Promise.resolve(null)
			}

			// fetch youtube data
			try {
				// fetch
				const youtube = await getYoutubeVideo(youtubeVideoID)
				const published =
					youtube.microformat.playerMicroformatRenderer.publishDate
				const timestamp = new Date(published)
				database.youtube[youtubeVideoID] = youtube
				// video
				const author: User = {
					id: youtube.videoDetails.channelId,
					name: youtube.videoDetails.author,
					profiles: [
						{
							service: 'youtube',
							value: youtube.videoDetails.channelId,
							url: `https://youtube.com/user/${youtube.videoDetails.channelId}`,
						},
					],
				}
				database.users[author.id] = author
				const video: Video = {
					// @todo, considerig removing
					thread,
					youtube,
					// continue
					youtubeID: youtubeVideoID,
					youtubeURL: `https://youtube.com/watch?v=${youtubeVideoID}`,
					forumURL: api.getTopicURL(topic),
					studyURL: `https://study.bevry.me/youtube/video/${youtubeVideoID}`,
					datetime: timestamp.toISOString(),
					name: topic.fancy_title,
					series: null,
					notes: [],
					discussions: [],
					comments: [],
					author,
					toJSON() {
						return {
							...this,
							series: this.series?.youtubeID,
							author: this.author.id,
							youtube: this.youtubeID,
						}
					},
				}
				// playlist
				const seriesTag = topic.tags.filter((tag) =>
					tagsOfSeries.includes(tag)
				)[0]
				if (seriesTag) {
					// get the tag map
					const tagMap = (categoryToTag[topic.category_id] =
						categoryToTag[topic.category_id] || {})
					// create tag entry in tag map
					const tagData = (tagMap[seriesTag] = tagMap[seriesTag] || {
						videos: [],
					})
					// map tag to this video
					tagData.videos.push(video)
					// map tag to the series
					if (tagData.series) {
						video.series = tagData.series
						video.series.videos.push(video)
					} else {
						const youtubePlaylistID =
							tagData.youtubePlaylistID || extractYoutubePlaylistID(postElement)
						if (youtubePlaylistID) {
							const series: Series = {
								author,
								youtubeID: youtubePlaylistID,
								youtubeURL: `https://youtube.com/playlist?list=${youtubePlaylistID}`,
								forumURL: `${config.host}/search?q=${escape(
									`tags:${seriesTag} category:${topic.category_id} order:latest_topic`
								)}`,
								studyURL: `https://study.bevry.me/youtube/playlist/${youtubePlaylistID}`,
								datetime: video.datetime,
								name: seriesTag,
								videos: tagData.videos,
								toJSON() {
									return {
										...this,
										videos: this.videos.map((i) => i.youtubeID),
										author: this.author.id,
									}
								},
							}
							for (const seriesVideo of tagData.videos) {
								seriesVideo.series = series
							}
							tagData.youtubePlaylistID = youtubePlaylistID
							database.series[
								youtubePlaylistID
							] = tagData.series = video.series = series
						}
					}
				}
				// replies => notes
				replies.forEach((post) => {
					// note
					const note: Note = {
						video,
						forumURL: `${config.host}/p/${post.id}`,
						content: post.cooked,
						author: {
							id: post.username,
							name: post.display_username,
							profiles: [
								{
									service: 'bevry',
									value: post.username,
									url: `${config.host}/u/${post.username}`,
								},
							],
						},
						toJSON() {
							return {
								...this,
								video: this.video.youtubeID,
								author: this.author.id,
							}
						},
					}
					database.users[note.author.id] = note.author
					video.notes.push(note)

					// check if it is timestamped
					const noteElement =
						note.content.includes('my notes') && getElement(note.content)
					if (noteElement) {
						for (const li of noteElement.querySelectorAll('li p')) {
							let seconds: number | null = null
							const innerHTML = li.innerHTML
							const content = replaceTimestamps(
								innerHTML,
								({ total }) => {
									if (seconds == null) seconds = total
									return ''
								},
								{ suffix: ' [-—] ' }
							)
							if (seconds) {
								const comment: Comment = {
									video,
									seconds,
									content,
									forumURL: note.forumURL,
									author: note.author,
									toJSON() {
										return {
											...this,
											video: this.video.youtubeID,
											author: note.author.id,
										}
									},
								}
								video.comments.push(comment)
							}
							// log({ seconds, innerHTML, content })
						}
					}
				})
				// meetings => discussions
				await Promise.all(
					post.link_counts.map(async (link) => {
						const topic = meetingTopicsByURL[link.url]
						if (!topic) return
						const discussionVideo = await threadToYoutube(
							await api.getThread(topic.id)
						)
						const discussion: Discussion = {
							forumURL: link.url,
							name: link.title,
							datetime: topic.created_at,
							video: discussionVideo,
							toJSON() {
								return { ...this, video: this.video?.youtubeID }
							},
						}
						video.discussions.push(discussion)
					})
				)
				/* log([
					video.youtubeURL,
					video.forumURL,
					video.discussions.length,
					'discussions',
					video.series?.youtubeID,
					'playlist',
					extractYoutubePlaylistID(postElement) || post.cooked,
				])*/
				// add
				database.videos[video.youtubeID] = video
				return video
			} catch (err) {
				return Promise.reject(
					new Errlop(
						`post ${post.id} for topic ${post.topic_id} failed acquire youtube data ${youtubeVideoID}`,
						err
					)
				)
			}
		}

		// populate database
		const youtubeThreads = await api.getThreadsOfCategory(youtubeCategoryID)
		await Promise.all(
			youtubeThreads.map((thread) => threadToYoutube(thread).catch((e) => e))
		)

		console.log('writing database')
		await mkdirp('database')
		await mkdirp('database/users')
		await mkdirp('database/videos')
		await mkdirp('database/series')
		await mkdirp('database/youtube')
		await writeJSON('database/index.json', database)
		const keys = ['users', 'videos', 'series', 'youtube']
		await Promise.all(
			keys.map(async (key) => {
				// @ts-ignore
				const data = database[key]
				await writeJSON(`database/${key}.json`, data)
				return Promise.all(
					Object.entries(data).map(([id, data]: [string, any]) => {
						return writeJSON(`database/${key}/${id}.json`, data)
					})
				)
			})
		)
		console.log('database written')
		// console.log(util.inspect(database, {depth: 4, color: true})

		// update timestamps
		if (false) {
			const timestampResults = await Promise.all(
				Object.values(database.videos).map(async (video) => {
					// prepare
					const { thread, youtube, datetime, youtubeID } = video
					const { topic, post } = thread

					// update
					try {
						// continue with timestamp update
						const result = await api.updateTopicTimestamp(
							post.topic_id,
							datetime
						)
						const meta = {
							topicID: post.topic_id,
							youtubeID,
							youtubeTitle: youtube.videoDetails.title,
							youtubeAuthor: youtube.videoDetails.author,
							datetime,
							result,
						}
						return meta
					} catch (err) {
						// if we cannot delete, it is probably the "about topic" post
						if (post.can_delete === false) {
							log(
								new Errlop(
									'tolerated timestamp update failure on probable about topic post',
									err
								),
								{
									post: post.id,
									topic: post.topic_id,
									youtube: youtubeID,
								}
							)
							return Promise.resolve()
						}
						// fail
						return Promise.reject(
							new Errlop(
								`post ${post.id} for topic ${post.topic_id} failed to update timestamp`,
								err
							)
						)
					}
				})
			)
			log(
				'timestamp update results:',
				timestampResults,
				timestampResults.length
			)
		}
	} catch (err) {
		return Promise.reject(err)
	}
}

cli()
	.then(() => console.log('OK'))
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
