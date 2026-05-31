import type { ChangelogMarkdownInfo, ChangelogInfo } from '~~/shared/types/changelog'
import { FetchError } from 'ofetch'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { type RepoRef, parseRepoUrl } from '~~/shared/utils/git-providers'
import { ERROR_CHANGELOG_NOT_FOUND, ERROR_UNGH_API_KEY_EXHAUSTED } from '~~/shared/utils/constants'
import { GithubReleaseSchama, ForgejoReleaseSchama } from '~~/shared/schemas/changelog/release'
import { resolveURL } from 'ufo'
import * as v from 'valibot'

/**
 * Detect whether changelogs/releases are available for this package
 *
 * first checks if releases are available and then changelog.md
 */
export async function detectChangelog(pkg: ExtendedPackageJson) {
  if (!pkg.repository?.url) {
    return false
  }

  const repoRef = parseRepoUrl(pkg.repository.url)
  if (!repoRef) {
    return false
  }

  const releases = await checkReleases(repoRef, pkg.repository.directory)
  if (releases && !isError(releases)) {
    return releases
  }

  const changelog = await checkChangelogFile(repoRef, pkg.repository.directory)
  if (changelog) {
    return changelog
  }

  if (isError(releases)) {
    throw releases
  }

  throw createError({
    statusCode: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

/**
 * check whether releases are being used with this repo
 * @returns true if in use, false if not in use or an NuxtError in case of ungh's api keys being exhausted
 */
async function checkReleases(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogInfo | false | Error> {
  console.log('host', ref.host)

  switch (ref.provider) {
    case 'github': {
      return checkLatestGithubRelease(ref, directory)
    }
    case 'codeberg':
    case 'forgejo': {
      return checkLatestForgejoRelease(ref, directory)
    }
  }

  return false
}

/// releases

const MD_REGEX = /(?<=\[.*?(changelog|releases|changes|history|news)\.md.*?\]\()(.*?)(?=\))/i
const ROOT_ONLY_REGEX = /^\/[^/]+$/

async function checkLatestGithubRelease(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogInfo | false | Error> {
  try {
    const response = await $fetch(`https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest`)

    const { release } = v.parse(v.object({ release: GithubReleaseSchama }), response)

    const matchedChangelog = release.markdown?.match(MD_REGEX)?.at(0)

    // if no changelog.md or the url doesn't contain /blob/
    if (!matchedChangelog || !matchedChangelog.includes('/blob/')) {
      return {
        provider: ref.provider,
        type: 'release',
        repo: `${ref.owner}/${ref.repo}`,
        link: `https://github.com/${ref.owner}/${ref.repo}/releases`,
      }
    }

    const path = matchedChangelog.replace(/^.*\/blob\/[^/]+\//i, '')

    // makes sure that the correct directory is matched
    if (
      directory &&
      !(
        path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(path)
      )
    ) {
      return false as const
    }
    return {
      provider: ref.provider,
      type: 'md',
      path,
      repo: `${ref.owner}/${ref.repo}`,
      link: matchedChangelog,
    }
  } catch (e) {
    if (e instanceof FetchError && (e.statusCode === 403 || e.statusCode === 429)) {
      return createError({
        statusCode: 502,
        statusMessage: ERROR_UNGH_API_KEY_EXHAUSTED,
      })
    }
  }

  return false as const
}

/// changelog markdown

const EXTENSIONS = ['.md', ''] as const

const CHANGELOG_FILENAMES = ['changelog', 'releases', 'changes', 'history', 'news']
  .map(fileName => {
    const fileNameUpperCase = fileName.toUpperCase()
    return EXTENSIONS.map(ext => [`${fileNameUpperCase}${ext}`, `${fileName}${ext}`])
  })
  .flat(3)

async function checkChangelogFile(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogMarkdownInfo | false> {
  const baseUrl = getBaseFileUrl(ref)
  if (!baseUrl) {
    return false
  }

  if (directory) {
    const inDir = await checkFiles(ref, baseUrl, directory)
    if (inDir) {
      return inDir
    }
  }
  return checkFiles(ref, baseUrl)
}

async function checkFiles(ref: RepoRef, baseUrl: RepoFileUrl, dir?: string) {
  for (const fileName of CHANGELOG_FILENAMES) {
    const exists = await fetch(resolveURL(baseUrl.raw, dir ?? '', fileName), {
      headers: {
        // GitHub API requires User-Agent
        'User-Agent': 'npmx.dev',
      },
      method: 'HEAD', // we just need to know if it exists or not
    })
      .then(r => r.ok)
      .catch(() => false)
    if (exists) {
      return {
        type: 'md',
        provider: ref.provider,
        path: resolveURL(dir ?? '', fileName),
        repo: `${ref.owner}/${ref.repo}`,
        link: resolveURL(baseUrl.blob, dir ?? '', fileName),
        host: ref.host,
      } satisfies ChangelogMarkdownInfo
    }
  }
  return false
}

interface RepoFileUrl {
  raw: string
  blob: string
}

function getBaseFileUrl(ref: RepoRef): RepoFileUrl | null {
  switch (ref.provider) {
    case 'github':
      return {
        raw: `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD`,
        blob: `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD`,
      }
    case 'codeberg':
    case 'forgejo': {
      const host = ref.host ?? 'codeberg.org'
      return {
        blob: `https://${host}/${ref.owner}/${ref.repo}/src/branch/HEAD`,
        raw: `https://${host}/${ref.owner}/${ref.repo}/raw/branch/HEAD`,
      }
    }
  }
  return null
}

// codeberg / forgejo

async function checkLatestForgejoRelease(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogInfo | false> {
  console.log('hallo')
  try {
    const host = ref.host ?? 'codeberg.org'
    const response = await $fetch(
      `https://${host}/api/v1/repos/${ref.owner}/${ref.repo}/releases/latest`,
      {
        headers: {
          'User-Agent': 'npmx.dev',
          'accept': 'application/json',
        },
      },
    )

    const release = v.parse(ForgejoReleaseSchama, response)

    const matchedChangelog = release.body?.match(MD_REGEX)?.at(0)

    // /src/branch/ can be similar to /blob/
    if (!matchedChangelog || !matchedChangelog.includes('/src/branch/')) {
      return {
        type: 'release',
        link: `https://${host}/${ref.owner}/${ref.repo}/releases`,
        provider: ref.provider,
        repo: `${ref.owner}/${ref.repo}`,
        host: ref.host,
      }
    }

    const path = matchedChangelog.replace(/^.*\/src\/branch\/[^/]+\//i, '')
    if (
      directory &&
      !(
        path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(path)
      )
    ) {
      return false as const
    }
    return {
      provider: ref.provider,
      type: 'md',
      path,
      repo: `${ref.owner}/${ref.repo}`,
      link: matchedChangelog,
      host: ref.host,
    }
  } catch {}
  return false
}
