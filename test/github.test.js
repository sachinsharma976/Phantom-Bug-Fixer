'use strict';

const nock = require('nock');
const { GitHubClient } = require('../src/github/client');
const { branchNameForIssue, prTitleForIssue, prBodyForIssue } = require('../src/github/repo');

describe('GitHubClient', () => {
  afterEach(() => nock.cleanAll());

  function makeClient() {
    return new GitHubClient({ token: 'gh-token', owner: 'acme', repo: 'webapp' });
  }

  test('createPullRequest posts to the pulls endpoint', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/acme/webapp/pulls', (body) => body.head === 'phantom-bug-fixer/bug-1')
      .reply(201, { number: 42, html_url: 'https://github.com/acme/webapp/pull/42' });

    const client = makeClient();
    const pr = await client.createPullRequest({
      head: 'phantom-bug-fixer/bug-1',
      base: 'main',
      title: 'fix(BUG-1): login button',
      body: 'body',
    });

    expect(scope.isDone()).toBe(true);
    expect(pr.number).toBe(42);
  });

  test('findOpenPullRequestByBranch returns null when none exist', async () => {
    nock('https://api.github.com')
      .get('/repos/acme/webapp/pulls')
      .query(true)
      .reply(200, []);

    const client = makeClient();
    const pr = await client.findOpenPullRequestByBranch('phantom-bug-fixer/bug-1');
    expect(pr).toBeNull();
  });
});

describe('repo helpers', () => {
  test('branchNameForIssue slugifies the issue key', () => {
    expect(branchNameForIssue('BUG-123')).toBe('phantom-bug-fixer/bug-123');
  });

  test('prTitleForIssue includes the key and summary', () => {
    const title = prTitleForIssue({ key: 'BUG-1', summary: 'Login button does nothing' });
    expect(title).toBe('fix(BUG-1): Login button does nothing');
  });

  test('prBodyForIssue lists test and fix files', () => {
    const body = prBodyForIssue({
      issue: { key: 'BUG-1', url: 'https://x/browse/BUG-1', summary: 'Login broken' },
      summary: 'Fixed a null check.',
      testFiles: ['src/__tests__/login.test.js'],
      fixFiles: ['src/lib/login.js'],
      iterations: 2,
    });

    expect(body).toContain('BUG-1');
    expect(body).toContain('src/__tests__/login.test.js');
    expect(body).toContain('src/lib/login.js');
    expect(body).toContain('**2** fix iteration');
  });
});
