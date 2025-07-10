import { html } from "htm/preact";
import type { DataSchema } from "./index.server.ts";
import { inferProps } from "~/lib";

export function Head() {
	const html = String.raw;
	return html`
		<title>Hi!</title>
	`;
}

export function Page({ message }: inferProps<typeof DataSchema>) {
	return html`
		<h1>${message}</h1>
	`;
}
