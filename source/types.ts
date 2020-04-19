/* eslint camelcase:0 */

export interface UpdateRequest {
	post: {
		raw: string
		raw_old?: string
		edit_reason?: string
		cooked?: string
	}
}

export interface Category {
	id: number
	name: string
	color: string
	text_color: string
	slug: string
	topic_count: number
	post_count: number
	position: number
	description: string
	description_text: string
	topic_url: string
	logo_url: string
	background_url: string
	read_restricted: boolean
	permission: number
	notification_level: string
	can_edit: boolean
	topic_template: string
	has_children: boolean
	topics_day: number
	topics_week: number
	topics_month: number
	topics_year: number
	topics_all_time: number
	description_excerpt: string
}

export interface CategoriesResponse {
	category_list: {
		can_create_category: boolean
		can_create_topic: boolean
		draft: boolean
		draft_key: string
		draft_sequence: number
		categories: Category[]
	}
}

export interface User {
	id: number
	username: string
	avatar_template: string
}

export interface Topic {
	id: number
	title: string
	fancy_title: string
	slug: string
	posts_count: number
	reply_count: number
	highest_post_number: number
	image_url: string
	created_at: string
	last_posted_at: string
	bumped: boolean
	bumped_at: string
	unseen: boolean
	pinned: boolean
	unpinned: boolean
	excerpt: string
	visible: boolean
	closed: boolean
	archived: boolean
	bookmarked: {}
	liked: {}
	views: number
	like_count: number
	has_summary: boolean
	archetype: string
	last_poster_username: string
	category_id: number
	pinned_globally: boolean
	posters: [
		{
			extras: string
			description: string
			user_id: number
		}
	]
}

export interface TopicsResponse {
	users: User[]
	topic_list: {
		can_create_topic: boolean
		draft: boolean
		draft_key: string
		draft_sequence: number
		per_page: number
		topics: Topic[]
	}
}

export interface Post {
	id: number
	name: string
	username: string
	avatar_template: string
	created_at: string
	cooked: string
	post_number: number
	post_type: number
	updated_at: string
	reply_count: number
	reply_to_post_number: {}
	quote_count: number
	avg_time: {}
	incoming_link_count: number
	reads: number
	score: number
	yours: true
	topic_id: number
	topic_slug: string
	display_username: string
	primary_group_name: {}
	primary_group_flair_url: {}
	primary_group_flair_bg_color: {}
	primary_group_flair_color: {}
	version: number
	can_edit: true
	can_delete: true
	can_recover: true
	can_wiki: true
	user_title: {}
	raw: string
	actions_summary: [{}]
	moderator: true
	admin: true
	staff: true
	user_id: number
	hidden: true
	hidden_reason_id: {}
	trust_level: number
	deleted_at: {}
	user_deleted: true
	edit_reason: {}
	can_view_edit_history: true
	wiki: true
}

export interface PostsResponse {
	post_stream: {
		posts: Post[]
	}
	id: number
}

export interface PostResponse {
	post: Post
}
