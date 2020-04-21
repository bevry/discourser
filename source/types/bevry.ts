import { YoutubeVideoData } from '../youtube'
import { PostItem, TopicResponse } from './discourse'

export interface Database {
	users: User[]
	youtube: {
		videos: Video[]
		series: Series[]
	}
}

export interface Youtube {
	youtubeID: string
	youtubeURL: string
	/** for videos, this is the video topic, for series, this is the tag, for meetings, this is null for now */
	forumURL?: string | null
	studyURL?: string | null
	/** utc iso string */
	datetime: string
	author: User
	name: string
}

export interface Note {
	video: Video
	forumURL: string
	content: string
	author: User
}

export interface TimestampedNote extends Note {
	seconds: number
}

export interface Discussion {
	forumURL: string
	name: string
	datetime: string
	video?: Video | null
}

export interface Video extends Youtube {
	series?: Series | null
	notes: Note[]
	discussions: Discussion[]
	timestampedNotes: TimestampedNote[]
	// @todo, consider removing
	youtube: YoutubeVideoData
	thread: Thread
}

export interface Series extends Youtube {
	videos: Video[]
}

export interface User {
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
