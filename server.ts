import { serveFile } from 'jsr:@std/http/file-server'
import tsBlankSpace from 'npm:ts-blank-space'
import * as path from 'jsr:@std/path'
import { expandGlob } from 'jsr:@std/fs/expand-glob'

const Backends = await getPageBackends()

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
				return await renderPage('~/pages/index.ts', {
					layout: '~/layouts/default.ts',
				})
			}
			if (req.method === 'POST') {
				return await getPageData('~/pages/index.ts')
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

	// Serve static files.
	{
		if (!import.meta.dirname) throw TypeError('Bad import.meta.dirname')
		const staticDir = path.join(import.meta.dirname, '..', 'static')
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

	// Serve 404 page.
	return new Response('404: Not Found', {
		status: 404,
	})
}

async function renderPage(pagepath: string, options: { layout: string }) {
	const serverpath = pagepath.replace(/\.(t|j)s$/u, '.server.$1s')
	const [PageResult, ServerResult] = await Promise.allSettled([
		import(pagepath),
		import(serverpath),
	])

	if (PageResult.status === 'rejected') {
		return new Response(`Failed to find page: "${pagepath}"\n${PageResult.reason}\n`, {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	}
	if (typeof PageResult.value?.Page !== 'function') {
		return new Response(`No "Page" function found in file: "${pagepath}"`, {
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	}

	const imports = JSON.parse(await Deno.readTextFile('./deno.jsonc')).imports
	for (const id in imports) {
		if (imports[id].startsWith('./')) {
			imports[id] = imports[id].slice(1)
		}
	}

	const layoutFile = options.layout ? options.layout : '~/layouts/default.ts'
	const layoutFn = (await import(layoutFile)).Layout
	const text = layoutFn(
		pagepath,
		PageResult.value.Page,
		JSON.stringify(imports, null, '\t'),
		ServerResult.status === 'fulfilled' ? ((await ServerResult.value?.PageData?.()) ?? {}) : {},
	)

	return new Response(text, {
		headers: {
			'Content-Type': 'text/html',
		},
	})
}

async function getPageData(pagepath: string) {
	const serverpath = pagepath.replace(/\.(t|j)s$/u, '.server.ts')
	const fn = (await import(serverpath)).PageData
	return new Response(JSON.stringify(await fn()), {
		headers: {
			'Content-Type': 'application/json',
		},
	})
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
