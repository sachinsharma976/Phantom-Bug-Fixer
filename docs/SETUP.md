# Setup

## 1. Anthropic (Claude)

1. Create an API key at https://console.anthropic.com/settings/keys.
2. Set `ANTHROPIC_API_KEY` in `.env`.
3. Optionally set `CLAUDE_MODEL` (defaults to `claude-sonnet-5`).

## 2. JIRA

1. Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens.
2. Set:
   - `JIRA_BASE_URL` — e.g. `https://your-domain.atlassian.net`
   - `JIRA_EMAIL` — the Atlassian account email the token belongs to
   - `JIRA_API_TOKEN`
3. Choose how tickets are selected:
   - `JIRA_PROJECT_KEY` — scopes the built-in JQL (`status = "To Do" AND assignee = currentUser()`)
     to a single project, or
   - `JIRA_JQL` — a full custom JQL string, used verbatim when set.
4. `JIRA_PROCESSED_LABEL` (default `phantom-bug-fixer-attempted`) is added to a ticket after an
   attempt so repeated runs skip it. Remove the label manually to force a retry.

The JIRA integration needs the following scopes on the API token / OAuth app: **read** issues,
**write** issues (labels + comments), and **transition** issues if you plan to extend the agent to
move tickets between statuses.

## 3. GitHub

1. Create a **fine-grained personal access token** (or a GitHub App installation token) scoped to
   the target Next.js repository with:
   - Contents: Read and write
   - Pull requests: Read and write
   - Metadata: Read-only
2. Set:
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER` — org or user that owns the repo
   - `GITHUB_REPO` — repo name
   - `GITHUB_BASE_BRANCH` — branch PRs are opened against (default `main`)
3. `REPO_WORKSPACE_DIR` controls where the repo is cloned locally (default `./workspace/repo`).
   phantom-bug-fixer clones it on first run and `git pull`s on subsequent runs.

## 4. Test runner

`TEST_RUNNER_COMMAND` (default `npm test`) is executed inside `REPO_WORKSPACE_DIR` after each fix
attempt. Make sure the target repo's `npm test` (or whatever you configure) exits non-zero on
failure and runs non-interactively (no watch mode) — Jest's default CI detection handles this in
most Next.js repos, but double check `package.json`'s `test` script.

## GitHub Actions secrets & variables

For [.github/workflows/nightly.yml](../.github/workflows/nightly.yml), configure on the repo
running phantom-bug-fixer (Settings → Secrets and variables → Actions):

**Secrets**

| Name | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key |
| `JIRA_EMAIL` | JIRA account email |
| `JIRA_API_TOKEN` | JIRA API token |
| `PBF_GITHUB_TOKEN` | Token with write access to the *target* Next.js repo (must be a custom secret — the default `GITHUB_TOKEN` only has access to the repo the workflow runs in) |

**Variables**

| Name | Value |
| --- | --- |
| `CLAUDE_MODEL` | e.g. `claude-sonnet-5` |
| `JIRA_BASE_URL` | e.g. `https://your-domain.atlassian.net` |
| `JIRA_PROJECT_KEY` or `JIRA_JQL` | ticket selection |
| `TARGET_REPO_OWNER`, `TARGET_REPO_NAME`, `TARGET_REPO_BASE_BRANCH` | target Next.js repo |
| `MAX_FIX_ITERATIONS` | e.g. `5` |

## Verifying the setup

```bash
phantom-bug-fixer list        # confirms JIRA auth + JQL are correct
phantom-bug-fixer fix BUG-1 --dry-run   # confirms GitHub clone/test-run without opening a PR
```
