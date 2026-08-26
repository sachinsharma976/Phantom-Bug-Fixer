'use strict';

const { Command } = require('commander');
const ora = require('ora');
const chalk = require('chalk');
const { loadConfig } = require('./config');
const { Orchestrator } = require('./agent/orchestrator');
const { JiraClient } = require('./jira/client');
const pkg = require('../package.json');

function buildProgram() {
  const program = new Command();

  program
    .name('phantom-bug-fixer')
    .description('Autonomous bug-fixing agent for JIRA tickets against a Next.js repo.')
    .version(pkg.version);

  program
    .command('list')
    .description('List assigned JIRA bugs that phantom-bug-fixer would attempt.')
    .option('-n, --max <number>', 'max issues to list', '20')
    .action(async (opts) => {
      const config = loadConfig();
      const jira = new JiraClient(config.jira);
      const issues = await jira.fetchAssignedBugs({ maxResults: Number(opts.max) });
      if (issues.length === 0) {
        console.log('No matching issues found.');
        return;
      }
      for (const issue of issues) {
        const attempted = issue.labels.includes(config.jira.processedLabel) ? chalk.gray(' [attempted]') : '';
        console.log(`${chalk.bold(issue.key)}  ${issue.summary}${attempted}`);
      }
    });

  program
    .command('run')
    .description('Fetch assigned bugs and attempt to fix all of them.')
    .option('-n, --max <number>', 'max issues to process', '20')
    .option('--dry-run', 'generate the fix and run tests but skip commit/push/PR')
    .action(async (opts) => {
      const config = loadConfig({ dryRun: opts.dryRun });
      const orchestrator = new Orchestrator(config);
      const results = await orchestrator.runAll({ maxIssues: Number(opts.max) });
      printSummary(results);
    });

  program
    .command('fix <issueKey>')
    .description('Attempt to fix a single JIRA issue by key, e.g. BUG-123.')
    .option('--dry-run', 'generate the fix and run tests but skip commit/push/PR')
    .action(async (issueKey, opts) => {
      const config = loadConfig({ dryRun: opts.dryRun });
      const orchestrator = new Orchestrator(config);
      const result = await orchestrator.runOne(issueKey);
      printSummary([result]);
    });

  return program;
}

function printSummary(results) {
  console.log('\n' + chalk.bold('Summary'));
  for (const r of results) {
    const icon = { 'pr-opened': '✅', failed: '❌', error: '💥', 'dry-run': '🧪', 'no-changes': '➖' }[r.status] || '•';
    const detail = r.prUrl ? ` — ${r.prUrl}` : r.error ? ` — ${r.error}` : '';
    console.log(`${icon}  ${r.issueKey}: ${r.status}${detail}`);
  }
}

async function main(argv = process.argv) {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const spinner = ora();
    spinner.fail(chalk.red(err.message));
    process.exitCode = 1;
  }
}

module.exports = { buildProgram, main };
