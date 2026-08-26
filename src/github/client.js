'use strict';

const { Octokit } = require('@octokit/rest');

class GitHubClient {
  /** @param {{token: string, owner: string, repo: string}} config */
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.token });
  }

  async createPullRequest({ head, base, title, body, draft = false }) {
    const { data } = await this.octokit.pulls.create({
      owner: this.config.owner,
      repo: this.config.repo,
      head,
      base,
      title,
      body,
      draft,
    });
    return data;
  }

  async findOpenPullRequestByBranch(branchName) {
    const { data } = await this.octokit.pulls.list({
      owner: this.config.owner,
      repo: this.config.repo,
      head: `${this.config.owner}:${branchName}`,
      state: 'open',
    });
    return data[0] || null;
  }

  async addLabelsToPullRequest(pullNumber, labels) {
    return this.octokit.issues.addLabels({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: pullNumber,
      labels,
    });
  }

  async addComment(pullNumber, body) {
    return this.octokit.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: pullNumber,
      body,
    });
  }
}

module.exports = { GitHubClient };
