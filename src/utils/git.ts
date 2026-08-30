import { execSync } from 'node:child_process';

export interface GitInfo {
  branch: string;
  commitHash: string;
  shortCommit: string;
  commitMessage: string;
}

let cachedGitInfo: GitInfo | null = null;

/**
 * Retrieves the active git branch, commit hash, and latest commit message.
 * Supports environment overrides (GIT_BRANCH, GIT_COMMIT) with fallback to local git CLI.
 */
export function getGitInfo(): GitInfo {
  if (cachedGitInfo) {
    return cachedGitInfo;
  }

  try {
    const branch =
      process.env.GIT_BRANCH ||
      execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();

    const commitHash =
      process.env.GIT_COMMIT ||
      execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();

    const shortCommit = commitHash ? commitHash.slice(0, 7) : 'unknown';

    const commitMessage =
      process.env.GIT_MESSAGE ||
      execSync('git log -1 --pretty=%B', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
        .split('\n')[0];

    cachedGitInfo = {
      branch: branch || 'unknown',
      commitHash: commitHash || 'unknown',
      shortCommit: shortCommit || 'unknown',
      commitMessage: commitMessage || '',
    };
  } catch {
    cachedGitInfo = {
      branch: process.env.GIT_BRANCH || 'unknown',
      commitHash: process.env.GIT_COMMIT || 'unknown',
      shortCommit: process.env.GIT_COMMIT ? process.env.GIT_COMMIT.slice(0, 7) : 'unknown',
      commitMessage: process.env.GIT_MESSAGE || '',
    };
  }

  return cachedGitInfo;
}
