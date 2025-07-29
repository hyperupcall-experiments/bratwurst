import { appRouter } from './examples/20-data-dynamic/routes.ts'
import { expandGlob, fs, jsonc, path, serveFile, tsBlankSpace } from './mod.ts'
import { h } from 'preact'
import { renderToString } from 'preact-render-to-string'

const Backends = await getPageBackends()
const { SearchParams } = await import(path.join(import.meta.dirname, './lib.ts'))

/**
 * There are five directories:
 * - components, layouts, pages, utilities
 * - static
 */
export async function requestHandler(req: Request) {
	const url = new URL(req.url)

	// Pages.
	switch (url.pathname) {
		case '/':
			if (req.method === 'GET') {
				return await renderPage(url, './pages/index.ts', {
					layout: './layouts/default.ts',
				})
			}
			if (req.method === 'POST') {
				return await getPageData(url, './pages/index.ts')
			}
	}

	// API.
	for (const backend of Backends) {
		const res = await backend(req, url)
		if (res !== undefined) {
			return res
		}
	}

	// Serve JavaScript files.
	for (const slug of ['components', 'layouts', 'pages', 'utilities']) {
		if (url.pathname.startsWith(`/${slug}`)) {
			if (!import.meta.dirname) throw TypeError('Bad import.meta.dirname')
			const tsFile = path.join(Deno.cwd(), url.pathname)
			const text = await Deno.readTextFile(tsFile)
			const output = tsBlankSpace(text)
			return new Response(output, {
				headers: {
					'Content-Type': 'application/javascript',
				},
			})
		}
	}
	if (
		req.method === 'GET' &&
		(url.pathname === '/lib.ts' || url.pathname === '/trpc.ts')
	) {
		if (!import.meta.dirname) throw TypeError('Bad import.meta.dirname')
		const tsFile = path.join(import.meta.dirname, url.pathname)
		const text = await Deno.readTextFile(tsFile)
		const output = tsBlankSpace(text)
		return new Response(output, {
			headers: {
				'Content-Type': 'application/javascript',
			},
		})
	}
	for (const slug of ['dependencies']) {
		if (url.pathname.startsWith(`/${slug}`)) {
			const filepath = path.join(Deno.cwd(), url.pathname)
			// if (!filepath.startsWith(staticDir)) {
			// 	throw new Error('Bad path')
			// }
			const stat = await Deno.stat(filepath).catch((err) => {
				if (err instanceof Deno.errors.NotFound) return null
				throw err
			})
			if (stat) {
				// if (filepath.endsWith('.ts')) {
				// 	const text = await Deno.readTextFile(filepath)
				// 	const output = tsBlankSpace(text)
				// 	return new Response(output, {
				// 		headers: {
				// 			'Content-Type': 'application/javascript',
				// 		},
				// 	})
				// } else {
				return serveFile(req, filepath, {
					fileInfo: stat,
				})
				// }
			}
		}
	}

	// Serve static files.
	{
		const staticDir = path.join(Deno.cwd(), 'static')
		const filepath = path.join(staticDir, url.pathname)
		if (!filepath.startsWith(staticDir)) {
			throw new Error('Bad path')
		}
		const stat = await Deno.stat(filepath).catch((err) => {
			if (err instanceof Deno.errors.NotFound) return null
			throw err
		})
		if (stat) {
			return serveFile(req, filepath, {
				fileInfo: stat,
			})
		}
	}

	// RPC.
	if (req.method === 'POST' && url.pathname === '/rpc') {
		const json = await req.json()
		const result = await appRouter[json.fn].resolve(json.data ?? {})

		return new Response(JSON.stringify(result, null, '\t'), {
			headers: {
				'Content-Type': 'application/json',
			},
		})
	}

	// Serve 404 page.
	return new Response('404: Not Found', {
		status: 404,
	})
}

async function renderPage(url: URL, pagepath: string, options: { layout: string }) {
	const pagepathabs = path.join(Deno.cwd(), pagepath)

	const serverpath = pagepathabs.replace(/\.(t|j)s$/u, '.server.$1s')
	const [PageResult, ServerResult] = await Promise.allSettled([
		import(pagepathabs),
		import(serverpath),
	])

	if (PageResult.status === 'rejected') {
		return new Response(
			`Failed to find page: "${pagepath}"\n${PageResult.reason}\n`,
			{
				status: 404,
				headers: {
					'Content-Type': 'text/plain',
				},
			},
		)
	}
	if (typeof PageResult.value?.Page !== 'function') {
		return new Response(`No "Page" function found in file: "${pagepath}"`, {
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	}

	const imports = jsonc.parse(await Deno.readTextFile('./deno.jsonc')).imports
	for (const id in imports) {
		if (imports[id].startsWith('./')) {
			imports[id] = imports[id].slice(1)
		}
	}

	const layoutFile = options.layout ?? './examples/10-simple/layouts/default.ts'
	let layoutFn = null
	if (await fs.exists(layoutFile)) {
		layoutFn = (await import(layoutFile)).Layout
	} else {
		layoutFn = defaultLayoutFn
	}

	const text = layoutFn(
		url,
		pagepath,
		PageResult.value.Page,
		imports,
		ServerResult.status === 'fulfilled' ? ((await ServerResult.value?.Data?.()) ?? {}) : {},
		ServerResult.status === 'fulfilled' ? ((await ServerResult.value?.Head?.()) ?? '') : '',
	)

	return new Response(text, {
		headers: {
			'Content-Type': 'text/html',
		},
	})
}

async function getPageData(url: URL, pagepath: string) {
	const pagepathabs = path.join(Deno.cwd(), pagepath)
	const serverpath = pagepathabs.replace(/\.(t|j)s$/u, '.server.ts')
	if (await fs.exists(serverpath)) {
		const fn = (await import(serverpath)).Data
		return new Response(JSON.stringify({ data: await fn(url) }), {
			headers: {
				'Content-Type': 'application/json',
			},
		})
	} else {
		return new Response('{}', {
			headers: {
				'Content-Type': 'application/json',
			},
		})
	}
}

async function getPageBackends(): Promise<
	Array<(req: Request, url: URL) => Promise<Response>>
> {
	const backends = []

	const entries = expandGlob('**/*.server.ts', {
		root: Deno.cwd(),
	})

	for await (const entry of entries) {
		if (!entry.isFile) {
			continue
		}

		const module = await import(entry.path)
		if (typeof module?.PageBackend === 'function') {
			backends.push(module.PageBackend)
		}
	}

	return backends
}

export function defaultLayoutFn(url: URL, pagePath, Page, imports, serverData, serverHead) {
	const searchParams = new SearchParams(url)
	const content = renderToString(h(() => Page(serverData, searchParams), {}))
	if (imports['~/lib']) {
		imports['~/lib'] = '/lib.ts'
	}
	for (const key in imports) {
		if (!imports[key].startsWith('/')) {
			delete imports[key]
		}
	}
	const html = String.raw
	// deno-fmt-ignore
	return html`<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0"
		/>
		<script type="importmap">
		{
			"imports": ${JSON.stringify(imports, null ,'\t').replaceAll('\n', '\n\t\t\t')}
		}
		</script>
		<script type="module">
		import { h, hydrate, render } from "preact";
		import { SearchParams } from '~/lib'
		import { Page } from "${pagePath.replace(/^\./, '~')}"

		const searchParams = new SearchParams()
		fetch(new URL(window.location).pathname, { method: "POST" })
			.then((res) => res.json())
			.then((json) => {
				hydrate(
					h(() => Page(json.data, searchParams), {}),
					document.querySelector("body"),
				);
			});
		</script>
		<!-- Head() start -->
		${serverHead ? serverHead : ''}
		<!-- Head() end -->
		<title>Site</title>
	</head>
	<body>
		${content ?? ''}
	</body>
</html>`
}
