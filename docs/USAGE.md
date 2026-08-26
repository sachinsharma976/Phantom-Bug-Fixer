# Usage

## CLI

```
phantom-bug-fixer <command>

Commands:
  list                    List assigned JIRA bugs phantom-bug-fixer would attempt
  run                      Fetch assigned bugs and attempt to fix all of them
  fix <issueKey>           Attempt to fix a single JIRA issue, e.g. BUG-123
```

### `list`

```bash
phantom-bug-fixer list --max 10
```

Prints every issue the configured JQL returns, marking ones already carrying
`JIRA_PROCESSED_LABEL` as `[attempted]`. Useful for sanity-checking JIRA auth and JQL before
running the full loop.

### `run`

```bash
phantom-bug-fixer run --max 5
phantom-bug-fixer run --dry-run
```

Processes every matching, unattempted ticket sequentially. Prints a summary line per ticket at the
end:

```
Summary
✅  BUG-12: pr-opened — https://github.com/acme/webapp/pull/42
❌  BUG-14: failed
➖  BUG-15: no-changes
```

### `fix <issueKey>`

```bash
phantom-bug-fixer fix BUG-123
phantom-bug-fixer fix BUG-123 --dry-run
```

Runs the full loop against a single ticket regardless of its label state — use this to retry a
previously failed ticket, or to test a specific bug end-to-end.

`--dry-run` runs test generation, the fix loop, and test execution, but stops before committing,
pushing, or opening a PR — nothing on GitHub or JIRA is touched except reading the ticket.

## As a library

```js
const { loadConfig, Orchestrator } = require('phantom-bug-fixer');

const config = loadConfig(); // reads from process.env / .env
const orchestrator = new Orchestrator(config);

const result = await orchestrator.runOne('BUG-123');
console.log(result); // { issueKey, status, iterations, prUrl? }
```

`loadConfig(overrides)` accepts the same values as the environment variables (camelCased) if you'd
rather not use `.env` — e.g. `loadConfig({ jiraProjectKey: 'BUG', maxIterations: 3 })`.

Individual clients are also exported for standalone use:

```js
const { JiraClient, GitHubClient, ClaudeClient } = require('phantom-bug-fixer');
```

## Exit codes

The CLI sets a non-zero `process.exitCode` if the command itself throws (bad config, network
failure, etc). A ticket ending in `status: 'failed'` after exhausting `MAX_FIX_ITERATIONS` is
still a *successful CLI run* — check the summary/return value per ticket, not just the process
exit code.
