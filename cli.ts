#!/usr/bin/env -S deno run --config ./deno.jsonc --watch-hmr --watch-exclude=./dependencies/ --allow-all
import { jsonc, parseArgs, path } from './mod.ts'
import { nodeResolve } from 'npm:@rollup/plugin-node-resolve'
import { rollup } from 'npm:rollup'
import os from 'node:os'
import fs from 'node:fs/promises'
import { parse } from 'npm:@typescript-eslint/typescript-estree'
import type { RollupBuild } from 'npm:rollup'

addEventListener('hmr', (ev) => {
	console.log('HMR triggered', ev)
})

const { command, options } = parseCli(Deno.args)
if (command == 'init') {
	await commandInit()
} else if (command === 'new') {
	await commandNew()
} else if (command === 'serve') {
	await commandServe()
} else if (command === 'bundle') {
	await commandBundle()
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
		Deno.mkdir('./utilities', { recursive: true }),
		Deno.writeTextFile(
			'./deno.jsonc',
			`{
	"imports": {
		"htm": "https://esm.sh/v135/htm@3.1.1",
		"htm/": "https://esm.sh/v135/htm@3.1.1/",
		"preact": "https://esm.sh/v135/preact@10.26.9",
		"preact/": "https://esm.sh/v135/preact@10.26.9/",
		"preact/hooks": "https://esm.sh/v135/preact@10.26.9/hooks",
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
			`export function Data() {
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
	Deno.serve({
		hostname: 'localhost',
	}, requestHandler)
}

async function commandBundle() {
	// const importMap = {
	// 	imports: {
	// 		'valibot': '/valibot@1.1.0.js',
	// 	},
	// }
	const importMap = jsonc.parse(await Deno.readTextFile(path.join(Deno.cwd(), './deno.jsonc')))

	await bundleDependencies(importMap.imports, './dependencies')
}

// Check if all entries in importMap have been used
export async function checkIfUsed() {}

export async function watchTypeScriptAndBundleDependencies(
	importMap: Record<string, any>,
	staticDir: string,
	watch: string[],
	signal?: AbortSignal,
) {
	if (!signal) ({ signal } = new AbortController())

	try {
		for (const file of watch) {
			const watcher = fs.watch(file, { persistent: true, signal })
			for await (const event of watcher) {
				console.log(event)
				if (!event.filename) {
					continue
				}

				if (
					event.filename.endsWith('.js') ||
					event.filename.endsWith('.ts')
				) {
					const content = await fs.readFile(event.filename, 'utf-8')
					const ast = parse(content, { loc: true, range: true })
					for (const node of ast.body) {
						if (
							node.type === 'ImportDeclaration' &&
							node.importKind === 'value'
						) {
							const importName = node.source.value
							if (
								importName.startsWith('node:') ||
								importName.startsWith('#')
							) {
								continue
							}
						}
					}
					bundleDependencies(importMap, staticDir)
				} else {
					bundleDependencies(importMap, staticDir)
				}
			}
		}
	} catch (err) {
		if (err.name === 'AbortError') return
		throw err
	}
}

export async function watchBundleDependencies(
	importMap: Record<string, any>,
	staticDir: string,
	watch: string[],
	signal?: AbortSignal,
) {
	if (!signal) ({ signal } = new AbortController())

	try {
		for (const file of watch) {
			const watcher = fs.watch(file, { persistent: true, signal })
			for await (const event of watcher) {
				bundleDependencies(importMap, staticDir)
			}
		}
	} catch (err) {
		if (err.name === 'AbortError') return
		throw err
	}
}

export async function bundleDependencies(
	importMap: Record<string, string>,
	staticDir: string,
) {
	const rollupInput = {} as Record<string, string>
	for (
		const [packageNameAndDir, uri] of Object.entries(
			importMap as Record<string, string>,
		)
	) {
		if (!uri.startsWith('./dependencies/') && !uri.startsWith('dependencies/')) {
			continue
		}

		const version = uri.match(
			/^(?:\.\/)?dependencies\/(?<packageName>.*?)@(?<packageVersion>.*)\.js$/,
		)
		let { packageName, packageVersion } = version?.groups ?? {}

		if (!packageName) {
			throw new Error('no package name')
		}
		if (!packageVersion) {
			throw new Error('no package version')
		}

		// TODO: xdg base dir
		const importPath = path.join(
			os.homedir(),
			'.cache/deno/npm/registry.npmjs.org',
			packageNameAndDir.split('/')[0],
			packageVersion,
			packageNameAndDir.split('/')[1] ? packageNameAndDir.split('/')[1] : '',
		)

		rollupInput[`${packageName}@${packageVersion}`] = importPath
	}

	let bundle: RollupBuild | null = null
	try {
		bundle = await rollup({
			input: rollupInput,
			plugins: [nodeResolve()],
		})
		await bundle.write({
			dir: staticDir,
			format: 'es',
		})
	} catch (error) {
		console.error(error)
		process.exit(1)
	}
	if (bundle) {
		await bundle.close()
	}
}
