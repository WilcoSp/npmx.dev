import type { MarkdownRepoInfo } from './markdown'

export function createGithubRepoInfo(owner: string, repo: string, path?: string): MarkdownRepoInfo {
  const hostBaseUrl = 'https://github.com'

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pull`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}

export function createForgejoRepoInfo(
  host: string,
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = `https://${host}`

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/src/branch/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/branch/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pulls`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}
