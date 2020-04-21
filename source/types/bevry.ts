import { YoutubeVideoData } from '../youtube'
import { PostItem, TopicResponse } from './discourse'

export interface DatabaseJSON {
	users: {
		[id: string]: User
	}
	videos: {
		[id: string]: VideoJSON
	}
	series: {
		[id: string]: SeriesJSON
	}
	youtube: {
		[id: string]: YoutubeVideoData
	}
}

export interface Database {
	users: {
		[id: string]: User
	}
	videos: {
		[id: string]: Video
	}
	series: {
		[id: string]: Series
	}
	youtube: {
		[id: string]: YoutubeVideoData
	}
}

export interface YoutubeBase {
	youtubeID: string
	youtubeURL: string
	/** for videos, this is the video topic, for series, this is the tag, for meetings, this is null for now */
	forumURL?: string | null
	studyURL?: string | null
	/** utc iso string */
	datetime: string
	name: string
}
export interface YoutubeJSON extends YoutubeBase {
	author: string
}
export interface Youtube extends YoutubeBase {
	author: User
	toJSON: () => YoutubeJSON
}

export interface NoteBase {
	forumURL: string
	content: string
}
export interface NoteJSON extends NoteBase {
	video: string
	author: string
}
export interface Note extends NoteBase {
	video: Video
	author: User
	toJSON: () => NoteJSON
}

export interface CommentJSON extends NoteJSON {
	seconds: number
}
export interface Comment extends Note {
	seconds: number
	toJSON: () => CommentJSON
}

export interface DiscussionBase {
	forumURL: string
	name: string
	datetime: string
}
export interface DiscussionJSON extends DiscussionBase {
	video?: string | null
}
export interface Discussion extends DiscussionBase {
	video?: Video | null
	toJSON: () => DiscussionJSON
}

export interface VideoBase {
	notes: Note[]
	discussions: Discussion[]
	comments: Comment[]
	thread: Thread
}
export interface VideoJSON extends VideoBase, YoutubeJSON {
	series?: string | null
	youtube: string
}
export interface Video extends VideoBase, Youtube {
	series?: Series | null
	youtube: YoutubeVideoData
	toJSON: () => VideoJSON
}

export interface SeriesJSON extends YoutubeJSON {
	videos: string[]
}
export interface Series extends Youtube {
	videos: Video[]
	toJSON: () => SeriesJSON
}

export interface User {
	id: string
	name: string
	profiles: Profile[]
}

export interface Profile {
	service: 'bevry' | 'youtube' | 'goodreads' | 'twitter' | 'email'
	value: string
	url?: string
	data?: object
}

export type Thread = {
	topic: TopicResponse
	post: PostItem
	replies: PostItem[]
}
