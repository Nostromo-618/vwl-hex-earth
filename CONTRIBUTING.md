# Contributing

## Setup

1. Install Node 20.19+ (24 in CI) and [pnpm](https://pnpm.io/) 10+.
2. `pnpm install`
3. `pnpm exec playwright install chromium` if you will run e2e tests.

If `@vanduo-oss/vdl-cbun` installs without a `dist/` folder, the GitHub package
did not run `prepack`. Reinstall with scripts enabled once:

```sh
pnpm install --ignore-scripts=false
```

## Checks

Run the same gate as CI:

```sh
pnpm ci
```

Or individually: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`,
`pnpm test:coverage`, `pnpm build`, `pnpm test:e2e`.

Please keep `src/earth/**` at 100% line and branch coverage. Format with
`pnpm format` before sending a change.
