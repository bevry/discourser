import DiscourseAPI from './index.js'
import { log } from './util.js'

async function cli() {
	const api = new DiscourseAPI('https://discuss.bevry.me', 'xxx', 'xxx')

	const results = await api.findAndReplacePosts(
		await api.getPosts(),
		/discuss\.jordanbpeterson\.community/gi,
		'discuss.bevry.me',
		'discuss.jordanbpeterson.community => discuss.bevry.me'
	)

	log('all done')
}

cli()
