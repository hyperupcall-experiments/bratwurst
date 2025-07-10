import { html } from 'htm/preact'
import type { DataSchema } from './index.server.ts'
import { inferProps, rpc } from '~/lib'
import { useEffect, useState } from 'preact/hooks'

export function Page(
	{ message: messageDefault }: inferProps<typeof DataSchema>,
) {
	const [message, setMessage] = useState(messageDefault)
	useEffect(() => {
		const aborter = new AbortController()
		rpc.getMessage().then((text) => {
			setMessage(text)
		})
		return aborter.abort
	}, [])

	return html`
		<h1>${message}</h1>
	`
}
