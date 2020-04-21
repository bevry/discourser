import { YoutubeVideoData } from '../youtube'
import { PostItem, TopicResponse } from './discourse'

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
	comments: {
		[id: string]: Comment
	}
	notes: {
		[id: string]: Note
	}
	threads: {
		[id: string]: {
			topicID: string
			postID: string
			repliesIDs: string[]
		}
	}
	topics: {
		[id: string]: TopicResponse
	}
	posts: {
		[id: string]: PostItem
	}
	youtube: {
		[id: string]: YoutubeVideoData
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
	name: string
	authorID: string // Author
}

export interface Note {
	videoID: string
	forumURL: string
	content: string
	authorID: string // Author
}

/** A comment is a timestamped note excerpt */
export interface Comment extends Note {
	seconds: number
}

export interface Discussion {
	forumURL: string
	name: string
	datetime: string
	videoID?: string | null
}

export interface Video extends Youtube {
	seriesID?: string | null
	notesIDs: string[]
	discussionsIDs: string[]
	commentIDs: string[]
	threadID: string
}

export interface Series extends Youtube {
	videosIDs: string[]
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
