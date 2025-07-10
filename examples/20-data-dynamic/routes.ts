import { t } from "../../trpc.ts";

export const appRouter = t.router({
  getMessage: t.procedure({
    resolve: async () => "Hello, Pluto!",
  }),
});

export type AppRouter = typeof appRouter;
