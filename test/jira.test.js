'use strict';

const nock = require('nock');
const { JiraClient, extractPlainText } = require('../src/jira/client');

const BASE_URL = 'https://example.atlassian.net';

describe('JiraClient', () => {
  afterEach(() => nock.cleanAll());

  function makeClient(overrides = {}) {
    return new JiraClient({
      baseUrl: BASE_URL,
      email: 'bot@example.com',
      apiToken: 'token',
      projectKey: 'BUG',
      ...overrides,
    });
  }

  test('fetchAssignedBugs maps issues into a flat shape', async () => {
    nock(BASE_URL)
      .get('/rest/api/3/search')
      .query(true)
      .reply(200, {
        issues: [
          {
            key: 'BUG-1',
            self: `${BASE_URL}/rest/api/3/issue/10001`,
            fields: {
              summary: 'Login button does nothing',
              description: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Clicking login is a no-op.' }] },
                ],
              },
              status: { name: 'To Do' },
              priority: { name: 'High' },
              labels: [],
              issuetype: { name: 'Bug' },
            },
          },
        ],
      });

    const client = makeClient();
    const issues = await client.fetchAssignedBugs();

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      key: 'BUG-1',
      summary: 'Login button does nothing',
      description: 'Clicking login is a no-op.',
      priority: 'High',
      url: `${BASE_URL}/browse/BUG-1`,
    });
  });

  test('buildJql falls back to the default JQL scoped to the project', () => {
    const client = makeClient();
    expect(client.buildJql()).toContain('project = "BUG"');
  });

  test('buildJql prefers an explicit jql override', () => {
    const client = makeClient({ jql: 'project = FOO' });
    expect(client.buildJql()).toBe('project = FOO');
  });

  test('addLabel PUTs an update with the label added', async () => {
    const scope = nock(BASE_URL)
      .put('/rest/api/3/issue/BUG-1', (body) => body.update.labels[0].add === 'phantom-bug-fixer-attempted')
      .reply(204);

    const client = makeClient();
    await client.addLabel('BUG-1', 'phantom-bug-fixer-attempted');
    expect(scope.isDone()).toBe(true);
  });
});

describe('extractPlainText', () => {
  test('returns empty string for null/undefined', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
  });

  test('passes through plain strings unchanged', () => {
    expect(extractPlainText('already plain')).toBe('already plain');
  });

  test('flattens nested ADF paragraphs', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line two.' }] },
      ],
    };
    const text = extractPlainText(adf);
    expect(text).toContain('Line one.');
    expect(text).toContain('Line two.');
  });
});
