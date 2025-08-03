import { html } from 'htm/preact'
import type { DataSchema } from './index.server.ts'
import { inferProps } from '~/lib'
import * as v from 'valibot'
import { defaultLayout } from '~/layouts/default.ts'
import { Fragment } from 'preact'

export const Layout = defaultLayout

export function Page(
	{}: inferProps<typeof DataSchema>,
) {
	return html`
		<${Fragment}>
			<h1>Welcome!</h1>
			<p>This page has multiple tags</p>
		</${Fragment}>
	`
}
