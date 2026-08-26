'use strict';

const axios = require('axios');

const DEFAULT_JQL = 'status = "To Do" AND assignee = currentUser() ORDER BY priority DESC';

class JiraClient {
  /**
   * @param {{baseUrl: string, email: string, apiToken: string, projectKey?: string, jql?: string}} config
   */
  constructor(config) {
    this.config = config;
    this.http = axios.create({
      baseURL: `${config.baseUrl.replace(/\/$/, '')}/rest/api/3`,
      auth: { username: config.email, password: config.apiToken },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  }

  buildJql() {
    if (this.config.jql) return this.config.jql;
    if (this.config.projectKey) {
      return `project = "${this.config.projectKey}" AND ${DEFAULT_JQL}`;
    }
    return DEFAULT_JQL;
  }

  /** Fetches bug tickets assigned to the authenticated user (or matching the configured JQL). */
  async fetchAssignedBugs({ maxResults = 20 } = {}) {
    const jql = this.buildJql();
    const { data } = await this.http.get('/search', {
      params: {
        jql,
        maxResults,
        fields: 'summary,description,status,priority,labels,issuetype,assignee',
      },
    });

    return data.issues.map(mapIssue);
  }

  async getIssue(issueKey) {
    const { data } = await this.http.get(`/issue/${issueKey}`, {
      params: { fields: 'summary,description,status,priority,labels,issuetype,assignee' },
    });
    return mapIssue(data);
  }

  async addComment(issueKey, body) {
    return this.http.post(`/issue/${issueKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
      },
    });
  }

  async addLabel(issueKey, label) {
    return this.http.put(`/issue/${issueKey}`, {
      update: { labels: [{ add: label }] },
    });
  }

  async transitionIssue(issueKey, transitionId) {
    return this.http.post(`/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }
}

function mapIssue(issue) {
  return {
    key: issue.key,
    summary: issue.fields?.summary ?? '',
    description: extractPlainText(issue.fields?.description),
    status: issue.fields?.status?.name ?? 'Unknown',
    priority: issue.fields?.priority?.name ?? 'Unknown',
    labels: issue.fields?.labels ?? [],
    issueType: issue.fields?.issuetype?.name ?? 'Bug',
    url: issue.self ? issue.self.split('/rest/api')[0] + `/browse/${issue.key}` : null,
  };
}

/** JIRA's v3 API returns Atlassian Document Format; flatten it to plain text. */
function extractPlainText(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;

  let text = '';
  function walk(node) {
    if (!node) return;
    if (node.type === 'text') {
      text += node.text;
    } else if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      if (node.type === 'paragraph' || node.type === 'heading') text += '\n';
    }
  }
  walk(adf);
  return text.trim();
}

module.exports = { JiraClient, extractPlainText };
