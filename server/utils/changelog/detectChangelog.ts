import type {
  ChangelogMarkdownInfo,
  ChangelogInfo,
  ChangelogReleaseInfo,
} from '~~/shared/types/changelog'
import type { FetchError } from 'ofetch'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { type RepoRef, parseRepoUrl } from '~~/shared/utils/git-providers'
import { ERROR_CHANGELOG_NOT_FOUND, ERROR_PROXY_API_KEY_EXHAUSTED } from '~~/shared/utils/constants'
import * as v from 'valibot'
import { GithubReleaseSchama } from '~~/shared/schemas/changelog/release'
import { resolveURL } from 'ufo'

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
  if (releases) {
    return releases
  }

  const changelog = await checkChangelogFile(repoRef, pkg.repository.directory)
  if (changelog) {
    return changelog
  }

  if (releases === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: ERROR_PROXY_API_KEY_EXHAUSTED,
    })
  }

  throw createError({
    statusCode: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

/**
 * check whether releases are being used with this repo
 * @returns true if in use, 0 in case proxy api (ungh.cc) exhausted api keys, false if not in use
 */
async function checkReleases(ref: RepoRef, directory?: string): Promise<ChangelogInfo | false | 0> {
  switch (ref.provider) {
    case 'github': {
      return checkLatestGithubRelease(ref, directory)
    }
  }

  return false
}

/// releases

const MD_REGEX = /(?<=\[.*?(changelog|releases|changes|history|news)\.md.*?\]\()(.*?)(?=\))/i
const ROOT_ONLY_REGEX = /^\/[^/]+$/

function checkLatestGithubRelease(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogInfo | false | 0> {
  return $fetch(`https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest/notexisting`)
    .then(r => {
      const { release } = v.parse(v.object({ release: GithubReleaseSchama }), r)

      const matchedChangelog = release.markdown?.match(MD_REGEX)?.at(0)

      // if no changelog.md or the url doesn't contain /blob/
      if (!matchedChangelog || !matchedChangelog.includes('/blob/')) {
        return {
          provider: ref.provider,
          type: 'release',
          repo: `${ref.owner}/${ref.repo}`,
          link: `https://github.com/${ref.owner}/${ref.repo}/releases`,
        } satisfies ChangelogReleaseInfo
      }

      const path = matchedChangelog.replace(/^.*\/blob\/[^/]+\//i, '')

      if (directory && !(path.startsWith(directory) || ROOT_ONLY_REGEX.test(path))) {
        return false as const
      }
      return {
        provider: ref.provider,
        type: 'md',
        path,
        repo: `${ref.owner}/${ref.repo}`,
        link: matchedChangelog,
      } satisfies ChangelogMarkdownInfo
    })
    .catch((e: FetchError) => {
      if (e.statusCode == 403) {
        // with 403 ungh.cc has exhausted it's api keys, returning 0 to indicate this
        return 0
      }

      return false as const
    })
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
        raw: `https://ungh.cc/repos/${ref.owner}/${ref.repo}/files/HEAD`,
        blob: `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD`,
      }
  }
  return null
}
