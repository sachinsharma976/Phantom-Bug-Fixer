'use strict';

const path = require('path');
require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for the full list.`
    );
  }
  return value;
}

function loadConfig(overrides = {}) {
  const env = process.env;

  return {
    anthropic: {
      apiKey: overrides.anthropicApiKey || requireEnv('ANTHROPIC_API_KEY'),
      model: overrides.model || env.CLAUDE_MODEL || 'claude-sonnet-5',
    },
    jira: {
      baseUrl: overrides.jiraBaseUrl || requireEnv('JIRA_BASE_URL'),
      email: overrides.jiraEmail || requireEnv('JIRA_EMAIL'),
      apiToken: overrides.jiraApiToken || requireEnv('JIRA_API_TOKEN'),
      projectKey: overrides.jiraProjectKey || env.JIRA_PROJECT_KEY || '',
      jql: overrides.jiraJql || env.JIRA_JQL || null,
      processedLabel: env.JIRA_PROCESSED_LABEL || 'phantom-bug-fixer-attempted',
    },
    github: {
      token: overrides.githubToken || requireEnv('GITHUB_TOKEN'),
      owner: overrides.githubOwner || requireEnv('GITHUB_OWNER'),
      repo: overrides.githubRepo || requireEnv('GITHUB_REPO'),
      baseBranch: overrides.githubBaseBranch || env.GITHUB_BASE_BRANCH || 'main',
    },
    workspace: {
      dir: path.resolve(overrides.workspaceDir || env.REPO_WORKSPACE_DIR || './workspace/repo'),
    },
    agent: {
      maxIterations: Number(overrides.maxIterations || env.MAX_FIX_ITERATIONS || 5),
      testCommand: overrides.testCommand || env.TEST_RUNNER_COMMAND || 'npm test',
      dryRun: overrides.dryRun ?? (env.DRY_RUN === 'true'),
    },
    logLevel: overrides.logLevel || env.LOG_LEVEL || 'info',
  };
}

module.exports = { loadConfig, requireEnv };
