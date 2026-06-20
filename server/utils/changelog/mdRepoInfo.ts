import type { MarkdownRepoInfo } from './markdown'

export function createGithubRepoInfo(owner: string, repo: string, path?: string): MarkdownRepoInfo {
  return {
    blobBaseUrl: `https://github.com/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`,
    path,
    commitBaseUrl: `https://github.com/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `https://github.com/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `https://github.com/${owner}/${repo}/pull`,
    compareBaseUrl: `https://github.com/${owner}/${repo}/compare`,
  }
}

export function createForgejoRepoInfo(
  host: string,
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  return {
    blobBaseUrl: `https://${host}/${owner}/${repo}/src/branch/HEAD`,
    rawBaseUrl: `https://${host}/${owner}/${repo}/raw/branch/HEAD`,
    path,
    commitBaseUrl: `https://${host}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `https://${host}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `https://${host}/${owner}/${repo}/pulls`,
    compareBaseUrl: `https://${host}/${owner}/${repo}/compare`,
  }
}
