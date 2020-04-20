import fetch from 'isomorphic-unfetch'
import PromisePool from 'native-promise-pool'
import { join } from 'path'
import Errlop from 'errlop'
import { inspect, log, writeJSON, readJSON, exists, escape } from './util.js'

// types
import type {
	PostUpdateRequest,
	Category,
	CategoriesResponse,
	PostsResponse,
	PostResponse,
	TopicResponse,
	TopicItem,
	CategoryResponse,
	PostItem,
	PostUpdateResponse,
	PostUpdateItem,
} from './types'

/** When finding and replacing, determine replacements using a method that matches this */
export type PostModifier = (
	post: PostResponse
) => { result: string; reason?: string }

/** Configuration for Discourser */
export interface DiscourserConfiguration {
	/** the discourse hostname to connect to, including protocol */
	host: string
	/** the API key to connect with */
	key: string
	/** the username to behave as */
	username: string
	/** the cache directory to use, if we are caching */
	cache?: string
	/** whether or not updates should be dry (non-applying) */
	dry?: boolean
	/** how many concurrency requests to send to the server at once */
	rateLimitConcurrency?: number
}

interface FetchOptions {
	/** Whether or not we should read from the cache */
	useCache?: boolean
	/** Only applicable to fetching topics of category */
	page?: number
	/** Any thing to init the fetch call with? */
	request?: RequestInit
}
interface FetchConfig extends FetchOptions {
	url: string
}

/**
 * Discourser is an API Client for the [Discourse API](https://docs.discourse.org)
 * It special features are:
 * - TypeScript Types
 * - Respecting Rate Limits
 * - Optional Heavy Caching
 * - Post Modifiers (can be used for global find and replace across all posts on the forum)
 */
export default class Discourser {
	readonly host: string
	readonly key: string
	readonly username: string
	readonly cache?: string
	readonly dry: boolean
	readonly pool: PromisePool<any>

	constructor({
		host,
		key,
		username,
		cache,
		dry = false,
		rateLimitConcurrency = 60,
	}: DiscourserConfiguration) {
		this.host = host
		this.key = key
		this.username = username
		this.cache = cache
		this.dry = dry
		this.pool = new PromisePool(rateLimitConcurrency)
	}

	/** Fetch a discourse API URL, with rate limit concurrency and optional caching */
	async fetch<T>({ url, useCache, request }: FetchConfig): Promise<T> {
		// check if cache is enabled
		const cache =
			this.cache &&
			(request?.method || 'get') === 'get' &&
			join(this.cache, escape(url))
		// check if we should and can read from cache
		if (cache && useCache !== false && (await exists(cache))) {
			log('reading', url, 'from cache', cache)
			const result = await readJSON(cache)
			return (result as unknown) as T
		}
		// fetch
		const result = await this.pool.open(() => this._fetch({ url, request }))
		// write to cache if cache is enabled
		if (cache) {
			writeJSON(cache, result)
		}
		// return the result
		return result
	}

	/** Fetch a discourse API URL, with rate limit retries */
	private async _fetch<T>({ url, request }: FetchConfig): Promise<T> {
		const opts: RequestInit = {
			...request,
			headers: {
				...request?.headers,
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'Api-Key': this.key,
				'Api-Username': this.username,
			},
		}

		const retry = (seconds: number) => {
			log('waiting for', seconds, 'seconds on', url)
			return new Promise<T>((resolve, reject) => {
				setTimeout(
					() =>
						this._fetch<T>({ url, request })
							.then(resolve)
							.catch(reject),
					(seconds || 60) * 1000
				)
			})
		}

		try {
			const res = await fetch(url, opts)

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
				// log({ text, url , opts })
				return Promise.reject(
					new Error(`fetch of [${url}] received invalid response:\n${text}`)
				)
			}

			// check if there are errors
			if (typeof (data as any).errors !== 'undefined') {
				// check if the error is a rate limit
				const wait: number = (data as any).extras?.wait_seconds
				if (wait != null) {
					// if it was, try later
					return await retry(wait + 1)
				}

				// otherwise fail
				// log({ data, url, opts })
				return Promise.reject(
					new Error(
						`fetch of [${url}] received failed response:\n${inspect(data)}`
					)
				)
			}
			return data
		} catch (err) {
			// log({ err, url, opts })
			return Promise.reject(
				new Errlop(`fetch of [${url}] failed with error`, err)
			)
		}
	}

	// =================================
	// CATEGORIES

	/**
	 * API Helper for {@link .getCategories}
	 */
	protected async getCategoriesResponse(
		opts: FetchOptions = {}
	): Promise<CategoriesResponse> {
		const url = `${this.host}/categories.json`
		return await this.fetch<CategoriesResponse>({ url, ...opts })
	}

	/**
	 * Fetch the whole information, for all categories of the forum
	 */
	async getCategories(opts: FetchOptions = {}): Promise<Category[]> {
		const response = await this.getCategoriesResponse(opts)
		const categories = response.category_list.categories
		log('forum', 'contains', categories.length, 'categories')
		return categories
	}

	/**
	 * API Helper for {@link .getTopicItemsOfCategory}
	 * Discourse does not provide an API for fetching category information for a specific category.
	 * Instead, all that it provides is a way of getting the topics for a specific category.
	 */
	protected async getCategoryResponse(
		categoryID: number,
		opts: FetchOptions = {}
	): Promise<CategoryResponse> {
		const url =
			`${this.host}/c/${categoryID}.json` +
			(opts.page !== 0 ? `?page=${opts.page}` : '')
		return await this.fetch<CategoryResponse>({ url, ...opts })
	}

	// =================================
	// TOPICS

	/**
	 * Fetch the partial information, for all topics of a specific category
	 */
	async getTopicItemsOfCategory(
		categoryID: number,
		opts: FetchOptions = {}
	): Promise<TopicItem[]> {
		// prepare and fetch
		let page = opts.page || 0
		const response = await this.getCategoryResponse(categoryID, {
			...opts,
			page,
		})
		const topics: TopicItem[] = response.topic_list.topics

		// fetch the next page
		if (topics.length === response.topic_list.per_page) {
			page += 1
			log('category', categoryID, 'has more topics, fetching page', page)
			const more = await this.getTopicItemsOfCategory(categoryID, {
				...opts,
				page,
			})
			topics.push(...more)
		}

		// if we are the first page, then output count as we now have all of them
		if (page === 0) {
			const ids = topics.map((i: TopicItem) => i.id)
			log('category', categoryID, 'has', ids.length, 'topics', ids)
		}

		// return
		return topics
	}

	/**
	 * Fetch the partial information, for all topics of specific categoires
	 */
	async getTopicItemsOfCategories(
		categoryIDs: number[],
		opts: FetchOptions = {}
	): Promise<TopicItem[]> {
		// fetch topic items for specific categories
		const topicsOfCategories = await Promise.all(
			categoryIDs.map((id) => this.getTopicItemsOfCategory(id, opts))
		)

		// @ts-ignore
		return topicsOfCategories.flat()
	}

	/**
	 * Fetch the partial information, for all topics of the forum
	 */
	async getTopicItems(opts: FetchOptions = {}) {
		const categories = await this.getCategories()
		const categoryIDs = categories.map((i) => i.id)
		return this.getTopicItemsOfCategories(categoryIDs, opts)
	}

	/**
	 * Fetch the whole information, for a specific topic of the forum
	 */
	getTopic(id: number, opts: FetchOptions = {}): Promise<TopicResponse> {
		const url = `${this.host}/t/${id}.json`
		return this.fetch<TopicResponse>({ url, ...opts })
	}

	/**
	 * Fetch the whole information, for all topics, or specific topics, of the forum
	 */
	async getTopics(
		topicIDs?: number[] | null,
		opts: FetchOptions = {}
	): Promise<TopicItem[] | TopicResponse[]> {
		// if no topics, use all topics
		if (!topicIDs) {
			const topics = await this.getTopicItems(opts)
			topicIDs = topics.map((i) => i.id)
		}

		// fetch whole topics
		return Promise.all(topicIDs.map((id) => this.getTopic(id, opts)))
	}

	// =================================
	// POSTS

	/**
	 * API Helper for {@link .getPostItemsOfTopic}
	 */
	protected async getPostItemsOfTopicResponse(
		topicID: number,
		opts: FetchOptions = {}
	): Promise<PostsResponse> {
		const url = `${this.host}/t/${topicID}/posts.json`
		const response = await this.fetch<PostsResponse>({ url, ...opts })
		return response
	}

	/**
	 * Fetch the partial information, for all posts of a specific topic
	 */
	async getPostItemsOfTopic(
		topicID: number,
		opts: FetchOptions = {}
	): Promise<PostItem[]> {
		const response = await this.getPostItemsOfTopicResponse(topicID, opts)
		const posts: PostItem[] = response.post_stream.posts
		const ids = posts.map((i) => i.id)
		log('topic', topicID, 'contains', ids.length, 'posts', ids)
		return posts
	}

	/**
	 * Fetch the partial information, for all posts of specific topics
	 */
	async getPostItemsOfTopics(
		topicIDs: number[],
		opts: FetchOptions = {}
	): Promise<PostItem[]> {
		// fetch post items for specific topics
		const postItemsOfTopics = await Promise.all(
			topicIDs.map((id) => this.getPostItemsOfTopic(id, opts))
		)

		// @ts-ignore
		return postItemsOfTopics.flat()
	}

	/**
	 * Fetch the partial information, for all posts of a specific category
	 */
	async getPostItemsOfCategory(
		categoryID: number,
		opts: FetchOptions = {}
	): Promise<PostItem[]> {
		// fetch topics for the category
		const topics = await this.getTopicItemsOfCategory(categoryID, opts)
		const topicIDs = topics.map((i) => i.id)

		// fetch
		const posts = await this.getPostItemsOfTopics(topicIDs)
		const ids = posts.map((i) => i.id)
		log('category', categoryID, 'has', ids.length, 'posts', ids)
		return posts
	}

	/**
	 * Fetch the partial information, for all posts of specific categories
	 */
	async getPostItemsOfCategories(
		categoryIDs: number[],
		opts: FetchOptions = {}
	): Promise<PostItem[]> {
		// fetch post items for specific categories
		const postItemsOfCategories = await Promise.all(
			categoryIDs.map((id) => this.getPostItemsOfCategory(id, opts))
		)

		// @ts-ignore
		return postItemsOfCategories.flat()
	}

	/**
	 * Fetch the partial information, for all posts of the forum
	 */
	async getPostItems(opts: FetchOptions = {}): Promise<PostItem[]> {
		const categories = await this.getCategories()
		const categoryIDs = categories.map((i) => i.id)
		return this.getPostItemsOfCategories(categoryIDs, opts)
	}

	/**
	 * Fetch the whole information, for a specific post of the forum
	 */
	getPost(id: number, opts: FetchOptions = {}): Promise<PostResponse> {
		const url = `${this.host}/posts/${id}.json`
		return this.fetch<PostResponse>({ url, ...opts })
	}

	/**
	 * Fetch the whole information, for all posts, or specific posts, of the forum
	 */
	async getPosts(
		postIDs?: number[] | null,
		opts: FetchOptions = {}
	): Promise<PostResponse[]> {
		// if no posts, use all
		if (!postIDs) {
			const posts = await this.getPostItems(opts)
			postIDs = posts.map((i) => i.id)
		}

		// fetch whole posts
		return await Promise.all(postIDs.map((id) => this.getPost(id, opts)))
	}

	// =================================
	// POSTS: UPDATING

	/**
	 * Update a post with the content
	 * @param postID the identifier of the post to update
	 * @param content the new raw content for the post
	 * @param reason the reason, if provided, for modifying the post
	 * @param old if the old raw content is provided, then the update verified that you are working with the latest post content before applying the update
	 */
	async updatePost(
		postID: number,
		content: string,
		reason: string = 'api update',
		old?: string
	): Promise<PostUpdateItem> {
		// prepare the request
		const data: PostUpdateRequest = {
			post: {
				raw: content,
				edit_reason: reason,
			},
		}
		if (old) {
			data.post.raw_old = old
		}

		// send the update
		log('updating', postID, 'with', data)
		const url = `${this.host}/posts/${postID}.json`
		const response = await this.fetch<PostUpdateResponse>({
			url,
			request: {
				method: 'put',
				body: JSON.stringify(data),
			},
		})

		// return the response
		log('updated', postID)
		return response.post
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

	/**
	 * Modify a post using a modifier
	 */
	async modifyPost(
		post: PostResponse,
		modifier: PostModifier
	): Promise<PostUpdateItem | null> {
		// check if we received a post item, insted of a post response
		if (post.raw == null) {
			log('post had no raw, fetching it', post.id)
			post = await this.getPost(post.id)
		}

		// check
		if (!post.raw) {
			log('post had empty raw, skipping', post.id)
			return Promise.resolve(null)
		}

		// replace
		const { result, reason } = modifier(post)
		if (result === post.raw) {
			log('replace had no effect on raw post', post.id)
			// if (post.cooked) {
			// 	const { result, reason } = modifier(post.cooked)
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

		// dry
		if (this.dry) {
			log('skipping update on dry mode')
			return Promise.resolve({
				...((post as unknown) as PostUpdateItem),
				result,
				reason,
			})
		}

		// update
		try {
			return await this.updatePost(post.id, result, reason, post.raw)
		} catch (err) {
			if (
				err.message.includes(
					'That post was edited by another user and your changes can no longer be saved.'
				)
			) {
				log('trying post', post.id, 'again with invalidated cache')
				return this.modifyPost(
					await this.getPost(post.id, { useCache: false }),
					modifier
				)
			}

			return Promise.reject(new Errlop(`modifying post ${post.id} failed`, err))
		}
	}

	/**
	 * Modify a post (via its post identifier) using a modifier
	 */
	async modifyPostID(post: number, modifier: PostModifier) {
		return this.modifyPost(await this.getPost(post), modifier)
	}

	/**
	 * Modify a post (via fetching the whole post from the partial post identifier) using a modifier
	 */
	async modifyPostItem(post: PostItem, modifier: PostModifier) {
		return this.modifyPost(await this.getPost(post.id), modifier)
	}

	/**
	 * Run the post modifier on all specified posts
	 */
	async modifyPosts(
		posts: PostResponse[],
		modifier: PostModifier
	): Promise<PostUpdateItem[]> {
		const updates = await Promise.all(
			posts.map((post) => this.modifyPost(post, modifier))
		)
		const updated = updates.filter((i) => i) as PostUpdateItem[]
		return updated
	}
}
