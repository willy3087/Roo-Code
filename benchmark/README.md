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

Run the benchmark server:

```sh
pnpm dev
```

################################################################################

Configure ENV vars (OpenRouter, PostHog, etc):

```sh
cp .env.local.sample .env.local
# Update ENV vars as needed.
```

Build and run a Docker image with the development environment needed to run the
benchmarks (C++, Go, Java, Node.js, Python & Rust):

```sh
npm run docker:start
```

Run an exercise:

```sh
npm run docker:benchmark -- -e exercises/javascript/binary
```

Select and run an exercise:

```sh
npm run cli
```

Select and run an exercise for a specific language:

```sh
npm run cli -- run rust
```

Run all exercises for a language:

```sh
npm run cli -- run rust all
```

Run all exercises:

```sh
npm run cli -- run all
```

Run all exercises using a specific runId (useful for re-trying when an unexpected error occurs):

```sh
npm run cli -- run all --runId 1
```
