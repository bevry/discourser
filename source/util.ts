import fs from 'fs'
import { inspect as utilInspect } from 'util'

export function inspect(arg: any) {
	return utilInspect(arg, {
		depth: 5,
		colors: true,
	})
}

export function log(...args: any[]) {
	console.log(...args.map((arg) => inspect(arg)))
}

export async function mkdirp(path: string) {
	try {
		await fs.promises.mkdir(path)
	} catch (err) {
		// don't care if it already exists
	}
}

export async function readJSON<T extends object>(path: string): Promise<T> {
	const text = await fs.promises.readFile(path, 'utf8')
	return JSON.parse(text)
}

export function writeJSON(path: string, data: object) {
	return fs.promises.writeFile(path, JSON.stringify(data))
}

export function exists(path: string): Promise<boolean> {
	return new Promise(function (resolve) {
		fs.exists(path, resolve)
	})
}

export function escape(path: string): string {
	return path.replace(/[^\w]/g, '-').replace(/-+/, '-')
}
