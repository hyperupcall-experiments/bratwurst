# Bratwurst

A yummy, minimal, web framework.

## Summary

Built on [Deno](https://deno.com) and [Preact](https://preactjs.com), Bratwurst empowers developers to build web applications that use the platform without the complexity of popular metaframeworks.

## Features

- Minimal & simple
- SSR (server-side rendering)
- Fully-typed & validating `getStaticProps`-like API
- Fully-typed & validating `trpc`-like API
- Fully typed `URLSearchParams`-like API (TODO: validate)
- Layouts

### Roadmap?

- Websockets
- File-based routing
- Great error feedback

### API

- Client: `URLParamSchema()`, `Page(data, params)`
- Server: `Head()`, `DataSchema()`, `Data()`
