# Benchmark Harness

## Get Started

Clone the Roo Code repo and run the setup script:

```sh
git clone https://github.com/RooVetGit/Roo-Code.git
cd Roo-Code
git checkout cte/benchmark-monorepo
cd benchmark
./scripts/setup.sh
```

[Install](https://docs.docker.com/desktop/) and run Docker Desktop.

Build a container to run the Roo Code evals:

```sh
cd benchmark
pnpm install
cp .env.sample .env
# Update OPENROUTER_API_KEY=... with your actual API key.
pnpm docker:start
```

Navigate to [localhost:3000](http://localhost:3000/) in your browser.
