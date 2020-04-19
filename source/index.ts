/* eslint camelcase:0, class-methods-use-this:0, func-style:0 */
import fetch, { RequestInit } from 'node-fetch'
import PromisePool from 'native-promise-pool'
import { join } from 'path'
import type {
	UpdateRequest,
	Category,
	CategoriesResponse,
	TopicsResponse,
	Topic,
	PostsResponse,
	PostResponse,
	Post,
} from './types'
import { log, writeJSON, readJSON, exists, escape } from './util.js'

export type Replacer = (content: string) => { result: string; reason?: string }

export interface APIOptions {
	host: string
	key: string
	username: string
	cache?: string
	dry?: boolean
	rateLimitConcurrency?: number
}
export default class DiscourseAPI {
	host: string
	key: string
	username: string
	cache?: string
	dry: boolean
	pool: PromisePool<any>

	constructor({
		host,
		key,
		username,
		cache,
		dry = false,
		rateLimitConcurrency = 60,
	}: APIOptions) {
		this.host = host
		this.key = key
		this.username = username
		this.cache = cache
		this.dry = dry
		this.pool = new PromisePool(rateLimitConcurrency)
	}

	async fetch<T>(route: string, _opts?: RequestInit): Promise<T> {
		const cache =
			(_opts?.method || 'get') === 'get' &&
			this.cache &&
			join(this.cache, escape(route))
		if (cache && (await exists(cache))) {
			log(`reading ${route} from cache ${cache}`)
			const result = await readJSON(cache)
			return (result as unknown) as T
		}
		const result = await this.pool.open(() => this._fetch(route, _opts))
		if (cache) {
			writeJSON(cache, result)
		}
		return result
	}

	async _fetch<T>(route: string, _opts?: RequestInit): Promise<T> {
		const opts: RequestInit = {
			..._opts,
			headers: {
				..._opts?.headers,
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'Api-Key': this.key,
				'Api-Username': this.username,
			},
		}

		const retry = (seconds: number) => {
			log(`waiting for ${seconds} seconds on ${route}`)
			return new Promise<T>((resolve, reject) => {
				setTimeout(
					() => this._fetch<T>(route, _opts).then(resolve),
					(seconds || 60) * 1000
				)
			})
		}

		try {
			const res = await fetch(route, opts)

			// fetch text then parse as json, so that when errors occur we can output what it was
			// rather than being stuck with errors like these:
			// FetchError: invalid json response body at https://discuss.bevry.me/posts/507.json reason: Unexpected token < in JSON at position 0
			const text = await res.text()
			let data: T
			try {
				data = JSON.parse(text) as T
			} catch (err) {
				// check if it was cloudflare reporting that the server has been hit too hard
				if (text.includes('Please try again in a few minutes')) {
					log('server has stalled, trying again in a minute')
					return await retry(60)
				}
				// otherwise log the error page and die
				log({ text, route, opts })
				process.exit(-1)
			}

			// debug
			if (typeof (data as any).errors !== 'undefined') {
				const wait: number = (data as any).extras?.wait_seconds
				if (wait != null) {
					return await retry(wait + 1)
				}
				log({ data, route, opts })
				process.exit(-1)
			}
			return data
		} catch (err) {
			console.error(err)
			log({ err, route, opts })
			process.exit(-1)
		}
	}

	async getCategories(): Promise<Category[]> {
		const url = `${this.host}/categories.json`
		const response = await this.fetch<CategoriesResponse>(url)
		const categories = response.category_list.categories
		return categories
	}

	async getTopicsOfCategory(
		categoryID: number,
		page: number = 0
	): Promise<Topic[]> {
		const url =
			`${this.host}/c/${categoryID}.json` + (page !== 0 ? `?page=${page}` : '')
		const response = await this.fetch<TopicsResponse>(url)
		const topics: Topic[] = response.topic_list.topics

		// fetch the next page
		if (topics.length === response.topic_list.per_page) {
			log('category', categoryID, 'has more topics, fetching page', page + 1)
			const more = await this.getTopicsOfCategory(categoryID, page + 1)
			topics.push(...more)
		}

		// if we are the first page, then output count as we now have all of them
		if (page === 0) {
			log(
				'category',
				categoryID,
				'has',
				topics.length,
				'topics',
				topics.map((i: Topic) => i.id)
			)
		}
		return topics
	}

	async getPostsOfTopic(topicID: number): Promise<Post[]> {
		const url = `${this.host}/t/${topicID}/posts.json`
		const response = await this.fetch<PostsResponse>(url)
		const posts: Post[] = response.post_stream.posts
		log(
			'topic',
			topicID,
			'contains',
			posts.length,
			'posts',
			posts.map((i: Post) => i.id)
		)
		return posts
	}

	getPost(postID: number): Promise<Post> {
		const url = `${this.host}/posts/${postID}.json`
		return this.fetch<Post>(url)
	}

	// async rebakePost(postID: number): Promise<Post> {
	// 	const url = `${this.host}/posts/${postID}/rebake`
	// 	log('rebaking', postID)
	// 	const response = await this.fetch<PostResponse>(url, {
	// 		method: 'put',
	// 	})
	// 	log('rebaked', postID)
	// 	return response.post
	// }

	async updatePost(
		postID: number,
		content: string,
		reason: string = 'api update',
		old?: string
	): Promise<Post> {
		const data: UpdateRequest = {
			post: {
				raw: content,
				edit_reason: reason,
			},
		}
		if (old) {
			data.post.raw_old = old
		}
		log('updating', postID, 'with', data)
		const url = `${this.host}/posts/${postID}.json`
		const response = await this.fetch<PostResponse>(url, {
			method: 'put',
			body: JSON.stringify(data),
		})
		log('updated', postID)
		return response.post
	}

	async getTopics(): Promise<Topic[]> {
		const categories = await this.getCategories()
		const topicsOfCategories = await Promise.all(
			categories.map((category) => this.getTopicsOfCategory(category.id))
		)
		// @ts-ignore
		const topics: Topic[] = topicsOfCategories.flat()
		log(
			'forum has',
			categories.length,
			'categories',
			'and',
			topics.length,
			'topics',
			topics.map((i: Topic) => i.id)
		)
		return topics
	}

	async getPosts(postIDs?: number[]): Promise<Post[]> {
		// fetch only specific ids
		if (postIDs) {
			return Promise.all(postIDs.map((postID: number) => this.getPost(postID)))
		}

		// fetch all of them
		const topics = await this.getTopics()
		const postsOfTopics = await Promise.all(
			topics.map((topic) => this.getPostsOfTopic(topic.id))
		)
		// @ts-ignore
		const posts: Post[] = postsOfTopics.flat()
		log(
			'forum has',
			topics.length,
			'topics',
			topics.map((i: Topic) => i.id),
			'and',
			posts.length,
			'posts',
			posts.map((i: Post) => i.id)
		)
		return posts
	}

	async getPostsOfCategory(categoryID: number): Promise<Post[]> {
		const topics = await this.getTopicsOfCategory(categoryID)
		const postsOfTopics = await Promise.all(
			topics.map((topic) => this.getPostsOfTopic(topic.id))
		)
		// @ts-ignore
		const posts: Post[] = postsOfTopics.flat()
		log(
			'category',
			categoryID,
			'has',
			posts.length,
			'posts',
			posts.map((i: Post) => i.id)
		)
		return posts
	}

	async findAndReplacePost(
		postOrPostID: number | Post,
		replacer: Replacer
	): Promise<Post | null> {
		// determine
		let postID: number, post: Post
		if (typeof postOrPostID === 'number') {
			postID = postOrPostID
			post = await this.getPost(postID)
		} else {
			post = postOrPostID
			postID = post.id

			// check
			if (post.raw == null) {
				log('post had no raw, fetching it', postID)
				post = await this.getPost(postID)
			}
		}

		// check
		if (!post.raw) {
			log('post had empty raw, skipping', postID)
			return Promise.resolve(null)
		}

		// replace
		const { result, reason } = replacer(post.raw)
		if (result === post.raw) {
			log('replace had no effect on raw post', postID)
			// if (post.cooked) {
			// 	const { result, reason } = replacer(post.cooked)
			// 	if (result !== post.cooked) {
			// 		log(
			// 			'replace did have an effect on cooked post',
			// 			postID,
			// 			'so rebaking it'
			// 		)
			// 		return await this.rebakePost(postID)
			// 	}
			// }
			return Promise.resolve(null)
		}

		// update
		if (this.dry) {
			log('skipping update on dry mode')
			return Promise.resolve({ ...post, result, reason })
		} else {
			return await this.updatePost(postID, result, reason, post.raw)
		}
	}

	async findAndReplacePosts(
		posts: Post[],
		replacer: Replacer
	): Promise<Post[]> {
		log(
			'find and replace across',
			posts.length,
			'posts',
			posts.map((i: Post) => i.id)
		)
		const updates = await Promise.all(
			posts.map((post) => this.findAndReplacePost(post, replacer))
		)
		const updated = updates.filter((i) => i) as Post[]
		return updated
	}
}
