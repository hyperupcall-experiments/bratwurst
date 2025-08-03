import * as v from 'valibot'
import { html } from 'htm/preact'

export class SearchParams<T extends string[]> {
	url: URL

	constructor(url?: URL) {
		this.url = url
	}

	#getSearchParams() {
		if ('Deno' in globalThis) {
			return this.url.searchParams
		} else {
			return new URLSearchParams(new URL(globalThis.location.href).search)
		}
	}

	// readonly size: URLSearchParams["size"];
	append(name: keyof T, value: string) {
		const searchParams = this.#getSearchParams()
		return searchParams.append(name, value)
	}

	delete(name: keyof T, value?: string) {
		const searchParams = this.#getSearchParams()
		return searchParams.delete(name, value)
	}

	get(name: keyof T) {
		const searchParams = this.#getSearchParams()
		return searchParams.get(name)
	}

	getAll(name: keyof T) {
		const searchParams = this.#getSearchParams()
		return searchParams.getAll(name)
	}

	has(name: keyof T, value?: string) {
		const searchParams = this.#getSearchParams()
		return searchParams.has(name, value)
	}

	set(name: keyof T, value: string) {
		const searchParams = this.#getSearchParams()
		globalThis.history.pushState({}, '', newUrl)
		return searchParams.set(name, value)
	}

	sort() {
		const searchParams = this.#getSearchParams()
		return searchParams.sort()
	}

	toString() {
		const searchParams = this.#getSearchParams()
		return searchParams.toString()
	}

	forEach(
		callbackfn: Parameters<URLSearchParams['forEach']>[0],
		thisArg?: Parameters<URLSearchParams['forEach']>[1],
	) {
		return this.searchParams.forEach(callbackfn, thisArg)
	}
}

export const inferProps = null
// deno-lint-ignore no-explicit-any
export type inferProps<T extends (...args: any[]) => any> = v.InferInput<
	ReturnType<T>
>

export const inferParams = null
// deno-lint-ignore no-explicit-any
export type inferParams<T extends (...args: any[]) => any> = SearchParams<
	v.InferInput<ReturnType<T>>
>

export const ITemplate = null
export type ITemplate = {
	headTags: string
	layout: string
}

export const ILayout = null
export type ILayout = {
	page: string
}

export type IClient = {
	URLParamSchema?: () => void
	Layout?: () => void
	Page: () => void
}

export type IServer = {
	Head?: () => Promise<string>
	DataSchema?: () => Promise<v.AnySchema>
	Data?: () => Promise<Record<PropertyKey, unknown>>
}

type ProxyProcedure<TProcedure> = TProcedure extends {
	// deno-lint-ignore no-explicit-any
	resolve: (...args: any[]) => any
} ? (
		arg0?: Parameters<TProcedure['resolve']>[0]['input'],
	) => Promise<Awaited<ReturnType<TProcedure['resolve']>>>
	: {
		[K in keyof TProcedure]: ProxyProcedure<TProcedure[K]>
	}

export function createRPCClient<api>(): ProxyProcedure<api> {
	const createRecursiveProxy = (path: string[] = []): any => {
		return new Proxy(() => {}, {
			get(_target, prop) {
				if (typeof prop === 'string') {
					return createRecursiveProxy([...path, prop])
				}
				return undefined
			},
			apply(_target, _thisArg, args) {
				// This is where the actual HTTP call happens
				const fullPath = path.join('/')
				const [input] = args

				return fetch('/rpc', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(
						{
							fn: fullPath,
							data: input ? input : undefined,
						},
						null,
						'\t',
					),
				})
					.then((res) => {
						if (!res.ok) {
							return res.json().then((err) => {
								throw new Error(err.error || 'API Error')
							})
						}
						return res.json()
					})
					.catch((error) => {
						console.error(`Error calling ${fullPath}:`, error)
						throw error
					})
			},
		})
	}

	return createRecursiveProxy()
}

export type ProcedureResolver<TInput, TOutput, TContext> = (opts: {
	input: TInput
	ctx: TContext
}) => Promise<TOutput>

export type MyContext = {
	userId?: string
	db: string
}

export type Procedure<TInput, TOutput, TContext> = {
	input?: v.InferInput<TInput>
	output?: v.InferInput<TOutput>
	resolve: ProcedureResolver<TInput, TOutput, TContext>
}

export function createTRPCBuilder<TContext>() {
	return {
		procedure<TInput = any, TOutput = any>(
			def: Procedure<TInput, TOutput, TContext>,
		): Procedure<TInput, TOutput, TContext> {
			return {
				input: def.input,
				resolve: def.resolve,
			}
		},
		router<T>(procedures: T): T {
			return procedures
		},
	}
}

export const t = createTRPCBuilder<MyContext>()

export function renderLayout(Page, Layout, serverData, searchParams) {
	if (Layout) {
		return html`
			<${Layout} page="${Page(serverData, searchParams)}" />
		`
	} else {
		return Page(serverData, searchParams)
	}
}
