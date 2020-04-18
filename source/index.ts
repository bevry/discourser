/* eslint camelcase:0, class-methods-use-this:0, func-style:0 */
import fetch, { RequestInit } from 'node-fetch'
import type {
	Category,
	CategoriesResponse,
	TopicsResponse,
	Topic,
	PostsResponse,
	PostResponse,
	Post,
} from './types'
import { log } from './util.js'

export default class DiscourseAPI {
	host: string
	key: string
	username: string

	constructor(host: string, key: string, username: string) {
		this.host = host
		this.key = key
		this.username = username
	}

	async fetch<T>(route: string, _opts?: RequestInit) {
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

		const retry = (seconds: number) =>
			new Promise<T>((resolve, reject) => {
				setTimeout(
					() => this.fetch<T>(route, _opts).then(resolve),
					(seconds || 60) * 1000
				)
			})

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
					// log(`waiting for ${wait} seconds on ${route}`)
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

	async rebakePost(postID: number): Promise<Post> {
		const url = `${this.host}/posts/${postID}/rebake`
		const response = await this.fetch<PostResponse>(url, {
			method: 'put',
		})
		return response.post
	}

	async updatePost(
		postID: number,
		content: string,
		reason: string = 'api update'
	): Promise<Post> {
		const url = `${this.host}/posts/${postID}.json`
		const response = await this.fetch<PostResponse>(url, {
			method: 'put',
			body: JSON.stringify({
				post: {
					raw: content,
					edit_reason: reason,
				},
			}),
		})
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

	async getPosts(): Promise<Post[]> {
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
		post: Post,
		find: RegExp,
		replace: string,
		reason?: string
	): Promise<Post | null> {
		let result: string
		try {
			result = post.raw.replace(find, replace)
		} catch (err) {
			console.error({ err })
			log('replaced failed on post', post.id, { post })
			process.exit(-1)
		}
		if (post.raw !== result) {
			log('updating', post.id, { post, result })
			const response = await this.updatePost(post.id, result, reason)
			log('updated', post.id, { response })
			return response
		}
		log('skipping update, replace was non-effective', post.id, { post, result })
		return Promise.resolve(null)
	}

	async findAndReplacePostID(
		postID: number,
		find: RegExp,
		replace: string,
		reason?: string
	) {
		const post = await this.getPost(postID)
		return this.findAndReplacePost(post, find, replace, reason)
	}

	async findAndReplacePosts(
		posts: Post[],
		find: RegExp,
		replace: string,
		reason?: string
	): Promise<Post[]> {
		log(
			'find and replace across',
			posts.length,
			'posts',
			posts.map((i: Post) => i.id)
		)
		const updates = await Promise.all(
			posts.map((post) => {
				if (post.raw) {
					if (find.test(post.raw) === false) {
						log('skipping fetch', post.id, 'not found in raw')
						return Promise.resolve(null)
					}
					log('found in raw', post.id)
					return this.findAndReplacePost(post, find, replace, reason)
				}
				if (post.cooked) {
					if (find.test(post.cooked) === false) {
						log('skipping fetch', post.id, 'not found in cooked')
						return Promise.resolve(null)
					}
					log('found in cooked', post.id)
					return this.findAndReplacePostID(post.id, find, replace, reason)
				}
				log('missing raw and cooked', post.id)
				return this.findAndReplacePostID(post.id, find, replace, reason)
			})
		)
		const updated = updates.filter((i) => i) as Post[]
		return updated
	}
}
