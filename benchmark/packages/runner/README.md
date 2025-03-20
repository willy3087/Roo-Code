# Extension Runner

VS Code provides two CLI parameters for running extension tests, `--extensionDevelopmentPath` and `--extensionTestsPath`.

For example:

```sh
# - Launches VS Code Extension Host
# - Loads the extension at <EXTENSION-ROOT-PATH>
# - Executes the test runner script at <TEST-RUNNER-SCRIPT-PATH>
code \
  --extensionDevelopmentPath=<EXTENSION-ROOT-PATH> \
  --extensionTestsPath=<TEST-RUNNER-SCRIPT-PATH>
```

If you make extension code changes then you need to re-build it so that `extensionDevelopmentPath` has the latest version transpiled:

```sh
# From the repository root:
pnpm build:extension
```

If you make changes to `@benchmark/runner` or any of its dependencies then you should rebuild it:

```sh
pnpm build:runner
```
