import { Navigation } from '~/components/Navigation.ts'
import { ILayout } from '~/lib'
import { html } from 'htm/preact'

export function defaultLayout({ page }: ILayout) {
	return html`
		<div>
			<${Navigation} />
			${page}
		</div>
	`
}
