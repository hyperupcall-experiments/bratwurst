import { createRPCClient, t } from "~/lib";

export const api = t.router({
	getMessage: t.procedure({
		resolve: async () => "Hello, Pluto!",
	}),
});

export const rpc = createRPCClient<typeof api>();
