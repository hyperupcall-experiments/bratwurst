import { html } from 'htm/preact'

export function Navigation() {
	return html`
		<ul>
			<li><a href="/">Home</a></li>
			<li><a href="/about">About</a></li>
		</ul>
	`
}
