# Architecture

## Module layout

```
bin/phantom-bug-fixer.js   CLI entry point (shebang script)
src/
  cli.js                   commander program: list / run / fix commands
  config.js                loads + validates env vars into a single config object
  index.js                 library entry point (exports the pieces below)
  jira/
    client.js              JIRA REST v3 wrapper: fetch/get issues, comment, label
  github/
    client.js               Octokit wrapper: create PR, list PRs, comment, label
    repo.js                 branch naming + PR title/body templates (pure functions)
  claude/
    client.js               Anthropic SDK wrapper: complete() / completeJson()
    prompts.js               prompt templates for test generation and fix generation
    testGenerator.js         drives the "ask Claude for tests, feed it files it requests" loop
    fixGenerator.js          same loop, for source fixes
  agent/
    orchestrator.js          the end-to-end fix loop (see below)
    testRunner.js             shells out to TEST_RUNNER_COMMAND, captures pass/fail + output
    repoTree.js               builds a shallow directory listing for prompt context
  utils/
    git.js                    simple-git wrapper: clone/fetch/branch/commit/push
    fs.js                     sandboxed file writes (Claude's file ops applied here)
    logger.js                 leveled console logger
```

## The fix loop (`Orchestrator.runOne`)

1. **Fetch the ticket** from JIRA (`JiraClient.getIssue`).
2. **Prepare the workspace** — clone the target repo if it isn't already checked out, `fetch` +
   checkout the base branch, then create a fresh branch `phantom-bug-fixer/<issue-key>`.
3. **Generate a reproduction test** (`claude/testGenerator.js`):
   - Sends the ticket + a shallow repo tree to Claude.
   - Claude may respond with `filesNeeded: [...]` instead of tests; the orchestrator reads those
     files from the workspace and re-prompts (up to 3 rounds) so Claude can ground the test in
     real code instead of guessing.
   - Once Claude returns `testFiles`, they're written into the workspace.
4. **Run tests.** If they already pass (rare — usually means the "bug" wasn't reproduced), skip
   straight to step 6.
5. **Fix loop** (`claude/fixGenerator.js`), repeated up to `MAX_FIX_ITERATIONS` times:
   - Send the ticket, the latest test failure output, and (from the second iteration on) the
     previous attempt's reasoning + diff, so Claude doesn't repeat a failed approach.
   - Same `filesNeeded` round-trip as test generation.
   - Apply the returned `fixFiles` (full file contents, not diffs — see below) and re-run tests.
6. **On success:** commit all changes, push the branch, open a PR via Octokit
   (`github/repo.js` builds the title/body), comment the PR link back on the JIRA ticket, and add
   the "attempted" label.
7. **On exhausting iterations:** comment on the JIRA ticket that manual intervention is needed and
   add the "attempted" label — the branch/commits are *not* pushed, since nothing passed.

`Orchestrator.runAll` wraps this in a loop over every ticket JIRA returns, skipping ones already
carrying the processed label, and never lets one ticket's failure stop the batch.

## Design decisions

- **Full file contents, not diffs.** Claude is asked to return the complete new contents of any
  file it touches rather than a unified diff. This trades some token cost for reliability — patch
  application against a diff Claude generated blind (without a fresh hunk-context) is a common
  source of silent corruption. `utils/fs.js` just does `writeFile`.
- **`filesNeeded` round-trip instead of dumping the whole repo.** Only a shallow directory tree is
  sent up front; Claude explicitly asks for file contents it needs, capped at 3 rounds. Keeps
  prompts small for large Next.js repos while still letting Claude ground its output in real code.
- **Sandboxed writes.** `applyFileOps` resolves every path against the workspace root and rejects
  anything that escapes it (`../../etc/passwd`-style paths), since file paths ultimately come from
  a model response.
- **Idempotency via JIRA labels**, not local state, so nightly CI runs (which get a fresh
  checkout every time) don't reprocess the same ticket forever.
- **PRs, never auto-merge.** The agent's job ends at "tests pass locally in the workspace"; a human
  reviews and merges.
- **`@octokit/rest` is pinned to `^18.12.0`.** Versions 19+ are ESM-only and fail to `require()`
  under Jest's default CommonJS transform. v18's dependency tree carries a few moderate ReDoS
  advisories in its HTTP-error-message regexes with no available patch (`npm audit` will flag
  them). If you migrate this project to native ESM, upgrade to the latest `@octokit/rest` at the
  same time and drop this note.
