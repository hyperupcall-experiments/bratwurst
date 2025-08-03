import { html } from 'htm/preact'
import { inferProps } from '~/lib'
import { defaultLayout } from '~/layouts/default.ts'
import { Fragment } from 'preact'

export const Layout = defaultLayout

export function Page(
	{}: inferProps<unknown>,
) {
	return html`
		<${Fragment}>
			<h1>About</h1>
		</${Fragment}>
	`
}
