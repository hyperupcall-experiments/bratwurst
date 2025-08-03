import { IClient, IServer, renderLayout } from './lib.ts'
import { expandGlob, fs, jsonc, path, serveFile, tsBlankSpace } from './mod.ts'
import { h } from 'preact'
import { renderToString } from 'preact-render-to-string'
import * as v from 'valibot'

const _dirname = import.meta.dirname
if (!_dirname) throw new Error(`import.meta.dirname not truthy`)

const Backends = await getPageBackends()
const { SearchParams } = await import(path.join(_dirname, './lib.ts'))
const apiModule = fs.existsSync(path.join(Deno.cwd(), './api.ts'))
	? await import(path.join(Deno.cwd(), './api.ts'))
	: {}

export async function requestHandler(req: Request) {
	if (!_dirname) throw new Error(`import.meta.dirname not truthy`)
	const url = new URL(req.url)

	// if (req.headers.get('upgrade') === 'websocket') {
	// 	const { socket, response } = Deno.upgradeWebSocket(req)
	// 	socket.addEventListener('open', () => {
	// 		console.log('connected')
	// 	})
	// 	socket.addEventListener('message', () => {
	// 	})
	// }

	// Pages.
	switch (url.pathname) {
		case '/':
			if (req.method === 'GET') {
				return await renderPage(url, './pages/index.ts')
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
	for (const slug of ['dependencies']) {
		if (url.pathname.startsWith(`/${slug}`)) {
			const filepath = path.join(Deno.cwd(), url.pathname)
			if (!filepath.startsWith(filepath)) {
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
	}
	if (
		req.method === 'GET' &&
		(url.pathname === '/lib.ts')
	) {
		const tsFile = path.join(_dirname, url.pathname)
		const text = await Deno.readTextFile(tsFile)
		const output = tsBlankSpace(text)
		return new Response(output, {
			headers: {
				'Content-Type': 'application/javascript',
			},
		})
	}
	if (
		req.method === 'GET' &&
		(url.pathname === '/api.ts')
	) {
		const tsFile = path.join(Deno.cwd(), url.pathname)
		const text = await Deno.readTextFile(tsFile)
		const output = tsBlankSpace(text)
		return new Response(output, {
			headers: {
				'Content-Type': 'application/javascript',
			},
		})
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
		const result = await apiModule?.api?.[json.fn]?.resolve?.(json.data ?? {})

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

async function renderPage(url: URL, clientPath: string) {
	const serverPath = clientPath.replace(/\.(t|j)s$/u, '.server.$1s')
	const clientPathAbs = path.join(Deno.cwd(), clientPath)
	const serverPathAbs = path.join(Deno.cwd(), serverPath)
	const [ClientResult, ServerResult] = await Promise.allSettled([
		import(clientPathAbs),
		import(serverPathAbs),
	])
	if (ClientResult.status === 'rejected') {
		return new Response(
			`Failed to find page: "${clientPath}"\n${ClientResult.reason}\n`,
			{
				status: 404,
				headers: {
					'Content-Type': 'text/plain',
				},
			},
		)
	}
	const Client: IClient = ClientResult.value
	if (Client.URLParamSchema !== undefined && typeof Client.URLParamSchema !== 'function') {
		return error(`"URLParamSchema" must be a function in file: "${clientPath}"`)
	}
	if (typeof Client.Page !== 'function') {
		return error(`"Page" must be a function in file: "${clientPath}"`)
	}

	const Server: IServer = ServerResult.status === 'fulfilled' ? ServerResult.value : {}
	if (Server.Head !== undefined && typeof Server.Head !== 'function') {
		return error(`"Head" must be a function in file: "${serverPath}"`)
	}
	if (Server.DataSchema !== undefined && typeof Server.DataSchema !== 'function') {
		return error(`"DataSchema" must be a function in file: "${serverPath}"`)
	}
	if (Server.Data !== undefined && typeof Server.Data !== 'function') {
		return error(`"Data" must be a function in file: "${serverPath}"`)
	}

	const imports =
		jsonc.parse(await Deno.readTextFile(path.join(Deno.cwd(), './deno.jsonc'))).imports
	if (imports['~/lib']) {
		imports['~/lib'] = '/lib.ts'
	}
	if (imports['~/api']) {
		imports['~/api'] = '/api.ts'
	}
	for (const id in imports) {
		if (imports[id].startsWith('./')) {
			imports[id] = imports[id].slice(1)
		}
		if (!imports[id].startsWith('/')) {
			delete imports[id]
		}
	}

	const [serverHeadResult, serverDataSchemaResult, serverDataResult] = await Promise.allSettled([
		Server?.Head?.(),
		Server?.DataSchema?.(),
		Server?.Data?.(),
	])
	if (serverHeadResult.status === 'rejected') {
		return error(serverHeadResult.reason)
	}
	if (serverDataSchemaResult.status === 'rejected') {
		return error(serverDataSchemaResult.reason)
	}
	if (serverDataResult.status === 'rejected') {
		return error(serverDataResult.reason)
	}
	const serverHead = serverHeadResult.value
	const serverDataSchema = serverDataSchemaResult.value
	const serverData = serverDataResult.value
	if (
		serverHead !== undefined && typeof serverHead !== 'string'
	) {
		return error(`"Head()" must return a string in file: "${serverPath}"`)
	}
	if (serverData === undefined) {
		if (serverDataSchema !== undefined) {
			return error(`"DataSchema()" must not exist without Data() in file: "${serverPath}"`)
		}
	} else {
		if (serverDataSchema === undefined) {
			return error(`"DataSchema()" must exist if Data() exists in file: "${serverPath}"`)
		}
		const result = v.safeParse(serverDataSchema, serverData)
		if (!result.success) {
			return error(JSON.stringify(result.issues, null, '\t'))
		}
	}

	const text = renderHtml(
		url,
		clientPath,
		Client,
		imports,
		serverData,
		serverHead,
	)

	return new Response(text, {
		headers: {
			'Content-Type': 'text/html',
		},
	})

	function error(message: string) {
		return new Response(message, {
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	}
}

async function getPageData(url: URL, pagePath: string) {
	const pagePathAbs = path.join(Deno.cwd(), pagePath)
	const serverPathAbs = pagePathAbs.replace(/\.(t|j)s$/u, '.server.ts')
	if (await fs.exists(serverPathAbs)) {
		const fn = (await import(serverPathAbs)).Data
		if (fn) {
			const data = await fn(url)

			return new Response(JSON.stringify({ data }), {
				headers: {
					'Content-Type': 'application/json',
				},
			})
		}
	}

	return new Response('{}', {
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

export function renderHtml(
	url: URL,
	clientPath: string,
	Client: IClient,
	imports: Record<string, string>,
	serverData: Record<PropertyKey, unknown>,
	serverHead: string,
) {
	const searchParams = new SearchParams(url)

	const layoutHtml = renderToString(
		h(() => renderLayout(Client.Page, Client.Layout, serverData, searchParams), {}),
	)

	const html = String.raw
	let headContent = html`
		<meta charset="utf-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0"
		/>
		<script type="importmap">
		{
			"imports": ${JSON.stringify(imports, null, '\t').replaceAll('\n', '\n\t\t\t')}
		}
		</script>
		<script type="module">
		import { h, hydrate, render } from "preact";
		import { SearchParams, renderLayout } from '~/lib'
		import * as module from "${clientPath.replace(/^\./, '~')}"

		const searchParams = new SearchParams()
		fetch(new URL(window.location).pathname, { method: "POST" })
			.then((res) => res.json())
			.then((json) => {
				const Page = module.Page
				const Layout = module.Layout

				hydrate(
					h(() => renderLayout(Page, Layout, json.data, searchParams), {}),
					document.querySelector("body"),
				);
			});
		const ws = new WebSocket("ws://localhost:8000");
		ws.onopen = (event) => {
		  console.log("Connected to the server");
			 ws.send("Hello Server!");
		};

		ws.onmessage = (event) => {
			console.log("Received: ", event.data);
		};

		ws.onerror = (event) => {
		 	console.error("WebSocket error observed:", event);
		};
		</script>
		<!-- Head() start -->
		${serverHead ? serverHead : ''}
		<!-- Head() end -->
		<title>Site</title>
	`
	headContent = headContent.trim()
	if (Client.Layout) {
		headContent = headContent.replaceAll(/\n/g, '\n\t\t')
	} else {
		headContent = headContent.replaceAll(/\n/g, '\n\t\t\t')
	}

	return html`
		<!DOCTYPE html>
		<html>
			<head>
				${headContent}
			</head>
			<body>
				${layoutHtml}
			</body>
		</html>
	`.replace(/^\n\t{3}/, '').replaceAll(/\n\t{3}/g, '\n')
}
