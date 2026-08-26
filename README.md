# phantom-bug-fixer

An autonomous bug-fixing agent for JIRA tickets. It pulls bugs assigned to you from JIRA, uses
Claude to write a failing test that reproduces each bug, iterates on a fix until the test suite
passes, and opens a GitHub pull request — all without a human in the loop until review time.

```
JIRA (assigned bugs)
      │
      ▼
 fetch ticket ──▶ generate failing test ──▶ run tests ──┐
                                                          │ fail
                                              ┌───────────┘
                                              ▼
                                    generate fix with Claude
                                              │
                                              ▼
                                          run tests ──▶ pass ──▶ commit, push, open PR
```

## Features

- **JIRA integration** — fetches bugs assigned to you (or matching custom JQL) via the JIRA REST API.
- **GitHub integration** — clones/updates a private Next.js repo, branches, commits, and opens PRs via Octokit.
- **Claude-driven fix loop** — generates a Jest reproduction test from the bug description, then
  iterates on source fixes (re-running tests each time) until they pass or a max-iteration budget
  is hit.
- **CLI + library** — use it as `phantom-bug-fixer` / `pbf` on the command line, or `require()` the
  pieces (`JiraClient`, `GitHubClient`, `ClaudeClient`, `Orchestrator`) in your own scripts.
- **Nightly automation** — a ready-to-use GitHub Actions workflow runs the agent on a schedule.

## Installation

```bash
npm install -g phantom-bug-fixer
# or run without installing:
npx phantom-bug-fixer run
```

For local development against this repo:

```bash
npm install
cp .env.example .env   # fill in your credentials
npm link                # optional, exposes `phantom-bug-fixer` / `pbf` globally
```

## Configuration

All configuration is via environment variables (see [.env.example](.env.example) for the full list
and [docs/SETUP.md](docs/SETUP.md) for how to obtain each credential):

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key |
| `CLAUDE_MODEL` | Model id, defaults to `claude-sonnet-5` |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | JIRA Cloud auth |
| `JIRA_PROJECT_KEY` / `JIRA_JQL` | Which tickets to fetch |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BASE_BRANCH` | Target repo + PR auth |
| `REPO_WORKSPACE_DIR` | Local checkout path for the target repo |
| `MAX_FIX_ITERATIONS` | How many fix attempts before giving up (default `5`) |
| `TEST_RUNNER_COMMAND` | Command run inside the target repo, default `npm test` |
| `DRY_RUN` | If `true`, generates fixes and runs tests but never commits/pushes/opens a PR |

## Usage

```bash
# List assigned bugs phantom-bug-fixer would attempt
phantom-bug-fixer list

# Attempt every unattempted assigned bug
phantom-bug-fixer run

# Attempt just one ticket
phantom-bug-fixer fix BUG-123

# Dry run — generate the fix, run tests, but skip commit/push/PR
phantom-bug-fixer fix BUG-123 --dry-run
```

See [docs/USAGE.md](docs/USAGE.md) for detailed CLI docs and library usage, and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the fix loop is structured.

## Nightly automation

[.github/workflows/nightly.yml](.github/workflows/nightly.yml) runs `phantom-bug-fixer run` every
night at 03:00 UTC (and on manual `workflow_dispatch`). Configure the secrets/variables listed at
the top of [docs/SETUP.md](docs/SETUP.md#github-actions-secrets--variables) in the repo running the
workflow.

## Safety notes

- Every generated fix goes through a **pull request** — nothing is merged automatically.
- File writes from Claude are sandboxed to the target repo's workspace directory
  ([src/utils/fs.js](src/utils/fs.js)); path traversal outside of it is rejected.
- `DRY_RUN=true` lets you validate the test/fix loop without touching GitHub or JIRA state.
- Ticket processing is idempotent: successfully or unsuccessfully attempted tickets are labeled
  (`JIRA_PROCESSED_LABEL`) so re-runs don't repeat work.

## Development

```bash
npm test            # run the test suite (Jest + nock)
npm run test:watch
npm run lint
```

## License

MIT — see [LICENSE](LICENSE).
