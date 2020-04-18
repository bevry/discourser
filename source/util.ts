import { inspect } from 'util'
export function log(...args: any[]) {
	console.log(
		...args.map((arg) =>
			inspect(arg, {
				depth: 5,
				colors: true,
			})
		)
	)
}
