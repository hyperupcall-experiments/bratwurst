import { html } from 'htm/preact'
import type { DataSchema } from './index.server.ts'
import { inferProps } from '~/lib'

export function Page({ message }: inferProps<typeof DataSchema>) {
	return html`
		<h1>${message}</h1>
	`
}
