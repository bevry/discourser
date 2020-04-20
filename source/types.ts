// Attempt at TypeScript Types for the Discourse API
// https://docs.discourse.org

export interface Action {
	can_act: boolean
	id: number
	count?: number
	hidden?: boolean
}
export interface Poster {
	description: string
	extras: string
	user_id: number
}
export interface Person {
	avatar_template: string
	id: number
	username: string
}
export interface Participant extends Person {
	post_count: number
}

/**
 * Update a Post
 * https://docs.discourse.org/#tag/Posts/paths/~1posts~1{id}.json/put
 */
export interface PostUpdateResponse {
	post: PostUpdateItem
}
export interface PostUpdateItem {
	actions_summary: Array<Action>
	admin: boolean
	avatar_template: string
	avg_time: object
	can_delete: boolean
	can_edit: boolean
	can_recover: boolean
	can_view_edit_history: boolean
	can_wiki: boolean
	cooked: string
	created_at: string
	deleted_at: object
	display_username: string
	draft_sequence: number
	edit_reason: object
	hidden_reason_id: object
	hidden: boolean
	id: number
	incoming_link_count: number
	moderator: boolean
	name: string
	post_number: number
	post_type: number
	primary_group_flair_bg_color: object
	primary_group_flair_color: object
	primary_group_flair_url: object
	primary_group_name: object
	quote_count: number
	reads: number
	reply_count: number
	reply_to_post_number: object
	score: number
	staff: boolean
	topic_id: number
	topic_slug: string
	trust_level: number
	updated_at: string
	user_deleted: boolean
	user_id: number
	user_title: object
	username: string
	version: number
	wiki: boolean
	yours: boolean
}
export interface PostUpdateRequest {
	post: {
		raw: string
		raw_old?: string
		edit_reason?: string
		cooked?: string
	}
}

/** https://docs.discourse.org/#tag/Categories/paths/~1categories.json/get */
export interface CategoriesResponse {
	category_list: {
		can_create_category: boolean
		can_create_topic: boolean
		categories: Category[]
		draft_key: string
		draft_sequence: number
		draft: boolean
	}
}
export interface Category {
	background_url: string
	can_edit: boolean
	color: string
	description_excerpt: string
	description_text: string
	description: string
	has_children: boolean
	id: number
	logo_url: string
	name: string
	notification_level: string
	permission: number
	position: number
	post_count: number
	read_restricted: boolean
	slug: string
	text_color: string
	topic_count: number
	topic_template: string
	topic_url: string
	topics_all_time: number
	topics_day: number
	topics_month: number
	topics_week: number
	topics_year: number
}

/**
 * Get Single Topic
 * https://docs.discourse.org/#tag/Topics/paths/~1t~1{id}.json/get
 */
export interface TopicResponse {
	actions_summary: Array<Action>
	archetype: string
	archived: boolean
	bookmarked: object
	category_id: number
	chunk_size: number
	closed: boolean
	created_at: string
	deleted_at: object
	deleted_by: object
	details: TopicDetails
	draft_key: string
	draft_sequence: object
	draft: object
	fancy_title: string
	has_summary: boolean
	highest_post_number: number
	id: number
	last_posted_at: object
	like_count: number
	participant_count: number
	pinned_at: string
	pinned_globally: boolean
	pinned_until: object
	pinned: boolean
	posts_count: number
	reply_count: number
	slug: string
	title: string
	unpinned: object
	user_id: number
	views: number
	visible: boolean
	word_count: object
	post_stream: {
		posts: Array<PostItem>
		// not sure what this is
		stream: Array<object>
	}
	// not sure what this is
	timeline_lookup: [
		{
			'0': Array<object>
		}
	]
}
export interface TopicDetails {
	auto_close_at: object
	auto_close_based_on_last_post: boolean
	auto_close_hours: object
	can_flag_topic: boolean
	created_by: Person
	last_poster: Person
	notification_level: number
	participants: Array<Participant>
	suggested_topics: Array<TopicItem>
}
export interface TopicItem {
	archetype: string
	archived: boolean
	bookmarked: object
	bumped_at: string
	bumped: boolean
	category_id: number
	closed: boolean
	created_at: string
	excerpt: string
	fancy_title: string
	has_summary: boolean
	highest_post_number: number
	id: number
	image_url: string
	last_posted_at: string
	last_poster_username: string
	like_count: number
	liked: object
	pinned_globally: boolean
	pinned: boolean
	posters: Array<Poster>
	posts_count: number
	reply_count: number
	slug: string
	title: string
	unpinned: boolean
	unseen: boolean
	views: number
	visible: boolean
}

/**
 * Get Topics for Category
 * https://docs.discourse.org/#tag/Categories/paths/~1c~1{id}.json/get
 */
export interface CategoryResponse {
	users: Person[]
	topic_list: {
		can_create_topic: boolean
		draft: boolean
		draft_key: string
		draft_sequence: number
		per_page: number
		topics: Array<TopicItem>
	}
}

/**
 * Whole Post Information
 * As returned by getting a single Post
 * https://docs.discourse.org/#tag/Posts/paths/~1posts~1{id}.json/get
 */
export interface PostResponse {
	actions_summary: Array<Action>
	admin: boolean
	avatar_template: string
	avg_time: object
	can_delete: boolean
	can_edit: boolean
	can_recover: boolean
	can_view_edit_history: boolean
	can_wiki: boolean
	cooked: string
	created_at: string
	deleted_at: object
	display_username: string
	edit_reason: object
	hidden_reason_id: object
	hidden: boolean
	id: number
	incoming_link_count: number
	moderator: boolean
	name: string
	post_number: number
	post_type: number
	primary_group_flair_bg_color: object
	primary_group_flair_color: object
	primary_group_flair_url: object
	primary_group_name: object
	quote_count: number
	raw: string
	reads: number
	reply_count: number
	reply_to_post_number: object
	score: number
	staff: boolean
	topic_id: number
	topic_slug: string
	trust_level: number
	updated_at: string
	user_deleted: boolean
	user_id: number
	user_title: object
	username: string
	version: number
	wiki: boolean
	yours: boolean
}

/**
 * Get the Posts of a Topic
 * https://docs.discourse.org/#tag/Topics/paths/~1t~1{id}~1posts.json/get
 */
export interface PostsResponse {
	post_stream: {
		posts: Array<PostItem>
	}
	id: number
}
/**
 * Partial Post Information
 * As returned by a listing
 */
export interface PostItem {
	accepted_answer: boolean
	actions_summary: Array<Action>
	admin: boolean
	avatar_template: string
	can_accept_answer: boolean
	can_delete: boolean
	can_edit: boolean
	can_recover: boolean
	can_unaccept_answer: boolean
	can_view_edit_history: boolean
	can_wiki: boolean
	cooked: string
	created_at: string
	deleted_at: null
	display_username: string
	edit_reason: null
	hidden: boolean
	id: number
	incoming_link_count: number
	moderator: boolean
	name: string
	post_number: number
	post_type: number
	primary_group_flair_bg_color: null | object
	primary_group_flair_color: null | object
	primary_group_flair_url: null | object
	primary_group_name: null | object
	quote_count: number
	read: boolean
	readers_count: number
	reads: number
	reply_count: number
	reply_to_post_number: null | number
	reviewable_id: number
	reviewable_score_count: number
	reviewable_score_pending_count: number
	score: number
	staff: boolean
	topic_id: number
	topic_slug: string
	trust_level: number
	updated_at: string
	user_deleted: boolean
	user_id: number
	user_title: null | object
	username: string
	version: number
	wiki: boolean
	yours: boolean
}
