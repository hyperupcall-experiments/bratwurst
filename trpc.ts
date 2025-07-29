import { z } from 'zod'

export type ProcedureResolver<TInput, TOutput, TContext> = (opts: {
	input: TInput
	ctx: TContext
}) => Promise<TOutput>

export type MyContext = {
	userId?: string
	db: string
}

export type Procedure<TInput, TOutput, TContext> = {
	input?: z.ZodSchema<TInput>
	output?: z.ZodSchema<TOutput>
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
