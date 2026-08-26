'use strict';

/**
 * Example: drive phantom-bug-fixer from your own script instead of the CLI.
 * Run with: node examples/programmatic-usage.js BUG-123
 */

const { loadConfig, Orchestrator } = require('../src/index');

async function main() {
  const issueKey = process.argv[2];
  if (!issueKey) {
    console.error('Usage: node examples/programmatic-usage.js <ISSUE-KEY>');
    process.exit(1);
  }

  const config = loadConfig({ dryRun: true });
  const orchestrator = new Orchestrator(config);

  const result = await orchestrator.runOne(issueKey);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
