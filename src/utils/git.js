'use strict';

const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');

/**
 * Ensures the target repo is cloned (or already present) at `dir`, checked out
 * on `baseBranch` and up to date with origin.
 */
async function ensureRepo({ owner, repo, token, dir, baseBranch }) {
  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

  await fs.ensureDir(path.dirname(dir));

  if (!(await fs.pathExists(path.join(dir, '.git')))) {
    const git = simpleGit();
    await git.clone(remoteUrl, dir);
  }

  const git = simpleGit(dir);
  // Keep the remote URL fresh in case the token rotated between runs.
  await git.remote(['set-url', 'origin', remoteUrl]);
  await git.fetch('origin');
  await git.checkout(baseBranch);
  await git.pull('origin', baseBranch);

  return git;
}

async function createBranch(git, branchName) {
  await git.checkoutLocalBranch(branchName);
  return branchName;
}

async function commitAll(git, message) {
  await git.add(['-A']);
  const status = await git.status();
  if (status.files.length === 0) {
    return false;
  }
  await git.commit(message);
  return true;
}

async function pushBranch(git, branchName) {
  await git.push(['-u', 'origin', branchName, '--force-with-lease']);
}

module.exports = { ensureRepo, createBranch, commitAll, pushBranch };
