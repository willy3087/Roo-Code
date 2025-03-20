# Benchmark Harness

Install nvm:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
# Reload shell.
nvm install
```

Install pnpm:

```sh
npm install --global corepack@latest
corepack enable pnpm
corepack use pnpm@latest-10
```

Install dependencies:

```sh
pnpm install
```

Configure database:

```sh
cp packages/server/.env.sample packages/server/.env
# Update BENCHMARKS_DB_PATH as needed in `packages/server/.env`.
pnpm --filter @benchmark/server db:migrate
```

Run the web ui:

```sh
pnpm web
```
