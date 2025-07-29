import { html } from 'htm/preact'
import type { DataSchema } from './index.server.ts'
import { inferParams, inferProps } from '~/lib'
import * as v from 'valibot'

export function UrlParamSchema() {
	return v.object({
		color: v.string(),
	})
}

export function Page(
	{}: inferProps<typeof DataSchema>,
	params: inferParams<typeof UrlParamSchema>,
) {
	return html`
		<h1>Color: ${params.get('color')}</h1>
	`
}
