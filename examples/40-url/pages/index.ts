import { html } from 'htm/preact'
import type { DataSchema } from './index.server.ts'
import { inferParams, inferProps } from '~/lib'
import * as v from 'npm:valibot'

export function UrlParamSchema() {
	return v.object({
		background: v.string(),
	})
}

export function Page(
	{}: inferProps<typeof DataSchema>,
	params: inferParams<typeof UrlParamSchema>,
) {
	return html`
		<h1>Background color: ${params.get('background')}</h1>
	`
}
