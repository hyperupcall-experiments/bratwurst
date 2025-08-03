import * as v from 'valibot'
import { inferProps } from '~/lib'

export function DataSchema() {
	return v.object({
		message: v.string(),
	})
}

export function Data(): inferProps<typeof DataSchema> {
	return {
		message: 'Hello, Saturn!',
	}
}
