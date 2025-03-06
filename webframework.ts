#!/usr/bin/env -S deno run --config ./deno.jsonc --allow-all
import { parseArgs } from 'jsr:@std/cli/parse-args'
import * as path from 'jsr:@std/path'

const { command, options } = parseCli(Deno.args)
if (command == 'init') {
	await commandInit()
} else if (command === 'new') {
	await commandNew()
} else if (command === 'serve') {
	await commandServe()
} else {
	console.error(`Unknown command: ${command}`)
	console.error(
		`Commands: ${
			new Intl.ListFormat().format(['init', 'new', 'serve'].map((item) => `"${item}"`))
		}`,
	)
	Deno.exit(1)
}

function parseCli(args: string[]) {
	const flags = parseArgs(args, {
		boolean: ['help', 'color'],
		string: ['version'],
		default: { color: true },
	})

	return {
		command: flags._[0],
		options: flags,
	}
}

async function commandInit() {
	if ((await Array.fromAsync(Deno.readDir('./'))).length !== 0) {
		console.error('Current directory is not empty')
		Deno.exit(1)
	}
	const serverTs = path.join(import.meta.dirname, './server.ts')
	await Promise.all([
		Deno.mkdir('./components', { recursive: true }),
		Deno.mkdir('./layouts', { recursive: true }),
		Deno.mkdir('./pages', { recursive: true }),
		Deno.mkdir('./static', { recursive: true }),
		Deno.mkdir('./utilities', { recursive: true }),
		Deno.writeTextFile(
			'./deno.jsonc',
			`{
	"imports": {
		"htm": "https://esm.sh/v135/htm@3.1.1",
		"htm/": "https://esm.sh/v135/htm@3.1.1/",
		"preact-render-to-string": "https://esm.sh/v135/*preact-render-to-string@6.5.12",
		"preact-render-to-string/": "https://esm.sh/v135/*preact-render-to-string@6.5.12/",
		"preact": "https://esm.sh/v135/preact@10.25.3",
		"preact/": "https://esm.sh/v135/preact@10.25.3/",
		"preact/hooks": "https://esm.sh/v135/preact@10.25.3/hooks",
		"~/components/": "./components/",
		"~/layouts/": "./layouts/",
		"~/pages/": "./pages/",
		"~/utilities/": "./utilities/"
	}
}\n`,
		),
		Deno.copyFile(serverTs, './server.ts'),
	])
	console.info('Initialized project')
}
async function commandNew() {
	const filetype = options._[1]
	const filename = options._[2]
	if (!filetype) {
		console.error('Must specify file type')
		Deno.exit(1)
	}
	if (!filename) {
		console.error('Must specify file name')
		Deno.exit(1)
	}

	if (filetype === 'component') {
		await Deno.mkdir('./components', { recursive: true })
		await Deno.writeTextFile(
			`./components/${filename}.ts`,
			`import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";

export const function ${filename}() {

}\n`,
		)
	} else if (filetype === 'layout') {
		await Deno.mkdir('./layouts', { recursive: true })
		await Deno.writeTextFile(
			`./layouts/${filename}.ts`,
			`import { renderToString } from 'preact-render-to-string'
import { h } from 'preact'

export function Layout(pagePath, Page, imports, serverData) {
	const content = renderToString(h(() => Page(serverData.data), {}))

	return \`<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Site</title>
				<script type="importmap">
					{
						"imports": \${imports}
					}
				</script>
				<script type="module">
					import { h, hydrate, render } from "preact";
					import { Page } from "\${pagePath}";
					fetch((new URL(document.URL)).pathname, { method: "POST" })
						.then((res) => res.json())
						.then((json) => {
							hydrate(
								h(() => Page(json.data), {}),
								document.querySelector("body")
							);
						});
				</script>
				\${serverData.head}
			</head>
			<body>
				\${content}
			</body>
		</html>\`
}\n`,
		)
	} else if (filetype === 'page') {
		await Deno.mkdir('./pages', { recursive: true })
		await Deno.writeTextFile(
			`./pages/${filename}.ts`,
			`import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";

export function Page() {
}\n`,
		)
	} else if (filetype === 'page/server') {
		await Deno.mkdir('./pages', { recursive: true })
		await Deno.writeTextFile(
			`./pages/${filename}.server.ts`,
			`export function PageData() {
	return {
		head: \`\`,
		data: {},
	};
}

export function Server() {
			return {
				head: \`\`,
				data: {},
			};
}\n`,
		)
	} else {
		console.info(`Bad filetype: "${filetype}"`)
		Deno.exit(1)
	}
}

async function commandServe() {
	const { requestHandler } = await import('./server.ts')
	Deno.serve(requestHandler)
}
