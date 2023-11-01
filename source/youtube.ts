export async function getYoutubeVideo(
	videoID: string,
): Promise<YoutubeVideoData> {
	const eurl = `https://youtube.googleapis.com/v/${videoID}`
	const response = await fetch(
		`https://www.youtube.com/get_video_info?video_id=${videoID}&el=embedded&eurl=${eurl}&sts=18333`,
	)
	const text = await response.text()
	const params = new URLSearchParams(text)
	const data = JSON.parse(Object.fromEntries(params).player_response)
	return data as YoutubeVideoData
}

// generated using the json from the above
// https://app.quicktype.io/?l=ts
export interface YoutubeVideoData {
	playabilityStatus: PlayabilityStatus
	streamingData: StreamingData
	playbackTracking: PlaybackTracking
	captions: Captions
	videoDetails: VideoDetails
	playerConfig: PlayerConfig
	storyboards: Storyboards
	microformat: Microformat
	trackingParams: string
	attestation: Attestation
	videoQualityPromoSupportedRenderers: VideoQualityPromoSupportedRenderers
}

export interface Attestation {
	playerAttestationRenderer: PlayerAttestationRenderer
}

export interface PlayerAttestationRenderer {
	challenge: string
	botguardData: BotguardData
}

export interface BotguardData {
	program: string
	interpreterUrl: string
}

export interface Captions {
	playerCaptionsRenderer: PlayerCaptionsRenderer
	playerCaptionsTracklistRenderer: PlayerCaptionsTracklistRenderer
}

export interface PlayerCaptionsRenderer {
	baseUrl: string
	visibility: string
	contribute: Contribute
}

export interface Contribute {
	captionsMetadataRenderer: CaptionsMetadataRenderer
}

export interface CaptionsMetadataRenderer {
	addSubtitlesText: AddSubtitlesText
	noSubtitlesText: Description
	promoSubtitlesText: Description
}

export interface AddSubtitlesText {
	runs: AddSubtitlesTextRun[]
}

export interface AddSubtitlesTextRun {
	text: string
	navigationEndpoint: NavigationEndpoint
}

export interface NavigationEndpoint {
	clickTrackingParams: string
	urlEndpoint: NavigationEndpointURLEndpoint
}

export interface NavigationEndpointURLEndpoint {
	url: string
}

export interface Description {
	simpleText: string
}

export interface PlayerCaptionsTracklistRenderer {
	captionTracks: CaptionTrack[]
	audioTracks: AudioTrack[]
	translationLanguages: TranslationLanguage[]
	defaultAudioTrackIndex: number
	contribute: Contribute
}

export interface AudioTrack {
	captionTrackIndices: number[]
}

export interface CaptionTrack {
	baseUrl: string
	name: Description
	vssId: string
	languageCode: string
	kind: string
	isTranslatable: boolean
}

export interface TranslationLanguage {
	languageCode: string
	languageName: Description
}

export interface Microformat {
	playerMicroformatRenderer: PlayerMicroformatRenderer
}

export interface PlayerMicroformatRenderer {
	thumbnail: PlayerMicroformatRendererThumbnail
	embed: Embed
	title: Description
	description: Description
	lengthSeconds: string
	ownerProfileUrl: string
	externalChannelId: string
	availableCountries: string[]
	isUnlisted: boolean
	hasYpcMetadata: boolean
	viewCount: string
	category: string
	publishDate: Date
	ownerChannelName: string
	uploadDate: Date
}

export interface Embed {
	iframeUrl: string
	flashUrl: string
	width: number
	height: number
	flashSecureUrl: string
}

export interface PlayerMicroformatRendererThumbnail {
	thumbnails: ThumbnailElement[]
}

export interface ThumbnailElement {
	url: string
	width: number
	height: number
}

export interface PlayabilityStatus {
	status: string
	playableInEmbed: boolean
	contextParams: string
}

export interface PlaybackTracking {
	videostatsPlaybackUrl: PtrackingURLClass
	videostatsDelayplayUrl: PtrackingURLClass
	videostatsWatchtimeUrl: PtrackingURLClass
	ptrackingUrl: PtrackingURLClass
	qoeUrl: PtrackingURLClass
	setAwesomeUrl: AtrURLClass
	atrUrl: AtrURLClass
}

export interface AtrURLClass {
	baseUrl: string
	elapsedMediaTimeSeconds: number
}

export interface PtrackingURLClass {
	baseUrl: string
}

export interface PlayerConfig {
	audioConfig: AudioConfig
	streamSelectionConfig: StreamSelectionConfig
	mediaCommonConfig: MediaCommonConfig
}

export interface AudioConfig {
	loudnessDb: number
	perceptualLoudnessDb: number
	enablePerFormatLoudness: boolean
}

export interface MediaCommonConfig {
	dynamicReadaheadConfig: DynamicReadaheadConfig
}

export interface DynamicReadaheadConfig {
	maxReadAheadMediaTimeMs: number
	minReadAheadMediaTimeMs: number
	readAheadGrowthRateMs: number
}

export interface StreamSelectionConfig {
	maxBitrate: string
}

export interface Storyboards {
	playerStoryboardSpecRenderer: PlayerStoryboardSpecRenderer
}

export interface PlayerStoryboardSpecRenderer {
	spec: string
}

export interface StreamingData {
	expiresInSeconds: string
	formats: Format[]
	adaptiveFormats: Format[]
}

export interface Format {
	itag: number
	url: string
	mimeType: string
	bitrate: number
	width?: number
	height?: number
	initRange?: Range
	indexRange?: Range
	lastModified: string
	contentLength?: string
	quality: string
	fps?: number
	qualityLabel?: string
	projectionType: ProjectionType
	averageBitrate?: number
	approxDurationMs: string
	colorInfo?: ColorInfo
	highReplication?: boolean
	audioQuality?: string
	audioSampleRate?: string
	audioChannels?: number
}

export interface ColorInfo {
	primaries: string
	transferCharacteristics: string
	matrixCoefficients: string
}

export interface Range {
	start: string
	end: string
}

export enum ProjectionType {
	Rectangular = 'RECTANGULAR',
}

export interface VideoDetails {
	videoId: string
	title: string
	lengthSeconds: string
	keywords: string[]
	channelId: string
	isOwnerViewing: boolean
	shortDescription: string
	isCrawlable: boolean
	thumbnail: PlayerMicroformatRendererThumbnail
	averageRating: number
	allowRatings: boolean
	viewCount: string
	author: string
	isPrivate: boolean
	isUnpluggedCorpus: boolean
	isLiveContent: boolean
}

export interface VideoQualityPromoSupportedRenderers {
	videoQualityPromoRenderer: VideoQualityPromoRenderer
}

export interface VideoQualityPromoRenderer {
	triggerCriteria: TriggerCriteria
	text: Text
	endpoint: Endpoint
	trackingParams: string
	closeButton: CloseButton
}

export interface CloseButton {
	videoQualityPromoCloseRenderer: VideoQualityPromoCloseRenderer
}

export interface VideoQualityPromoCloseRenderer {
	trackingParams: string
}

export interface Endpoint {
	clickTrackingParams: string
	urlEndpoint: EndpointURLEndpoint
}

export interface EndpointURLEndpoint {
	url: string
	target: string
}

export interface Text {
	runs: TextRun[]
}

export interface TextRun {
	text: string
	bold?: boolean
}

export interface TriggerCriteria {
	connectionWhitelists: string[]
	joinLatencySeconds: number
	rebufferTimeSeconds: number
	watchTimeWindowSeconds: number
	refractorySeconds: number
}
