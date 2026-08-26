'use strict';

jest.mock('../src/jira/client');
jest.mock('../src/github/client');
jest.mock('../src/claude/client');
jest.mock('../src/utils/git');
jest.mock('../src/agent/testRunner');
jest.mock('../src/agent/repoTree');
jest.mock('../src/utils/fs');

const { JiraClient } = require('../src/jira/client');
const { GitHubClient } = require('../src/github/client');
const { ClaudeClient } = require('../src/claude/client');
const gitUtils = require('../src/utils/git');
const { runTests } = require('../src/agent/testRunner');
const { buildRepoTree } = require('../src/agent/repoTree');
const fsUtils = require('../src/utils/fs');
const { Orchestrator } = require('../src/agent/orchestrator');

const baseConfig = {
  anthropic: { apiKey: 'x', model: 'claude-sonnet-5' },
  jira: { baseUrl: 'https://x', email: 'a@b.com', apiToken: 'x', processedLabel: 'phantom-bug-fixer-attempted' },
  github: { token: 'x', owner: 'acme', repo: 'webapp', baseBranch: 'main' },
  workspace: { dir: '/tmp/workspace' },
  agent: { maxIterations: 3, testCommand: 'npm test', dryRun: false },
  logLevel: 'silent',
};

const issue = {
  key: 'BUG-1',
  summary: 'Login button does nothing',
  description: 'Clicking login does nothing',
  labels: [],
  priority: 'High',
  issueType: 'Bug',
  url: 'https://x/browse/BUG-1',
};

describe('Orchestrator.runOne', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildRepoTree.mockResolvedValue('src/\n  index.js');
    gitUtils.ensureRepo.mockResolvedValue({ fake: 'git' });
    gitUtils.createBranch.mockResolvedValue('phantom-bug-fixer/bug-1');
    gitUtils.commitAll.mockResolvedValue(true);
    gitUtils.pushBranch.mockResolvedValue(undefined);
    fsUtils.applyFileOps.mockResolvedValue([]);

    JiraClient.mockImplementation(() => ({
      getIssue: jest.fn().mockResolvedValue(issue),
      addComment: jest.fn().mockResolvedValue(undefined),
      addLabel: jest.fn().mockResolvedValue(undefined),
    }));

    GitHubClient.mockImplementation(() => ({
      createPullRequest: jest.fn().mockResolvedValue({ number: 7, html_url: 'https://github.com/acme/webapp/pull/7' }),
    }));
  });

  test('opens a PR once tests pass on the first try', async () => {
    ClaudeClient.mockImplementation(() => ({
      completeJson: jest.fn().mockResolvedValue({
        reasoning: 'reproduces the bug',
        filesNeeded: [],
        testFiles: [{ path: 'src/__tests__/login.test.js', content: 'test content' }],
      }),
    }));
    runTests.mockResolvedValue({ passed: true, exitCode: 0, output: 'PASS' });

    const orchestrator = new Orchestrator(baseConfig);
    const result = await orchestrator.runOne('BUG-1');

    expect(result.status).toBe('pr-opened');
    expect(result.prUrl).toBe('https://github.com/acme/webapp/pull/7');
    expect(result.iterations).toBe(0);
  });

  test('iterates fix generation until tests pass', async () => {
    let call = 0;
    ClaudeClient.mockImplementation(() => ({
      completeJson: jest.fn().mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.resolve({
            reasoning: 'reproduces the bug',
            filesNeeded: [],
            testFiles: [{ path: 'src/__tests__/login.test.js', content: 'test content' }],
          });
        }
        return Promise.resolve({
          reasoning: `fix attempt ${call}`,
          filesNeeded: [],
          fixFiles: [{ path: 'src/lib/login.js', action: 'write', content: `attempt ${call}` }],
        });
      }),
    }));

    runTests
      .mockResolvedValueOnce({ passed: false, exitCode: 1, output: 'FAIL first run' })
      .mockResolvedValueOnce({ passed: false, exitCode: 1, output: 'FAIL second run' })
      .mockResolvedValueOnce({ passed: true, exitCode: 0, output: 'PASS' });

    const orchestrator = new Orchestrator(baseConfig);
    const result = await orchestrator.runOne('BUG-1');

    expect(result.status).toBe('pr-opened');
    expect(result.iterations).toBe(2);
    expect(runTests).toHaveBeenCalledTimes(3);
  });

  test('reports failure after exhausting max iterations', async () => {
    ClaudeClient.mockImplementation(() => ({
      completeJson: jest.fn().mockResolvedValue({
        reasoning: 'attempt',
        filesNeeded: [],
        testFiles: [{ path: 'src/__tests__/login.test.js', content: 'x' }],
        fixFiles: [{ path: 'src/lib/login.js', action: 'write', content: 'x' }],
      }),
    }));
    runTests.mockResolvedValue({ passed: false, exitCode: 1, output: 'still failing' });

    const orchestrator = new Orchestrator(baseConfig);
    const result = await orchestrator.runOne('BUG-1');

    expect(result.status).toBe('failed');
    expect(result.iterations).toBe(baseConfig.agent.maxIterations);
  });

  test('dry run skips commit, push, and PR creation', async () => {
    ClaudeClient.mockImplementation(() => ({
      completeJson: jest.fn().mockResolvedValue({
        reasoning: 'reproduces the bug',
        filesNeeded: [],
        testFiles: [{ path: 'src/__tests__/login.test.js', content: 'test content' }],
      }),
    }));
    runTests.mockResolvedValue({ passed: true, exitCode: 0, output: 'PASS' });

    const orchestrator = new Orchestrator({ ...baseConfig, agent: { ...baseConfig.agent, dryRun: true } });
    const result = await orchestrator.runOne('BUG-1');

    expect(result.status).toBe('dry-run');
    expect(gitUtils.commitAll).not.toHaveBeenCalled();
    expect(gitUtils.pushBranch).not.toHaveBeenCalled();
  });
});
