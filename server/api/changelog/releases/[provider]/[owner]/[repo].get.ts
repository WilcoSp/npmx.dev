import type { ProviderId } from '~~/shared/utils/git-providers'
import type { ReleaseData } from '~~/shared/types/changelog'
import * as v from 'valibot'
import {
  ERROR_CHANGELOG_RELEASES_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'
import {
  GithubReleaseCollectionSchama,
  ForgejoReleaseCollectionSchema,
} from '~~/shared/schemas/changelog/release'
import { parse } from 'valibot'
import { changelogRenderer } from '~~/server/utils/changelog/markdown'

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider')
    const repo = getRouterParam(event, 'repo')
    const owner = getRouterParam(event, 'owner')

    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: v.optional(v.string()) }), rawQuery)

    if (!repo || !provider || !owner) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }

    try {
      switch (provider as ProviderId) {
        case 'github':
          return await getReleasesFromGithub(owner, repo)
        case 'codeberg':
        case 'forgejo':
          return await getReleasesFromForgejo(owner, repo, host ?? 'codeberg.org')

        default:
          throw createError({
            status: 404,
            statusMessage: ERROR_CHANGELOG_NOT_FOUND,
          })
      }
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_RELEASES_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR * 2, // 2 hours
    swr: true,
    getKey: event => {
      const provider = getRouterParam(event, 'provider')
      const repo = getRouterParam(event, 'repo')
      const owner = getRouterParam(event, 'owner')
      return `changelogRelease:v2:${provider}:${owner}:${repo}`
    },
    shouldBypassCache: () => import.meta.dev,
  },
)

async function getReleasesFromGithub(owner: string, repo: string) {
  const data = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/releases`, {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'npmx.dev',
    },
  })

  const { releases } = parse(GithubReleaseCollectionSchama, data)

  const render = await changelogRenderer({
    blobBaseUrl: `https://github.com/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`,
  })

  return releases.map(r => {
    const { html, toc } = render(r.markdown, r.id)
    return {
      id: r.id,
      // replace single \n within <p> like with Vue's releases
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: r.name || r.tag,
      draft: r.draft,
      prerelease: r.prerelease,
      toc,
      publishedAt: r.publishedAt,
      link: `https://github.com/${owner}/${repo}/releases/tag/${r.tag}`,
    } satisfies ReleaseData
  })
}

async function getReleasesFromForgejo(owner: string, repo: string, host: string) {
  const data = await $fetch(`https://${host}/api/v1/repos/${owner}/${repo}/releases?draft=false`)
  const releases = parse(ForgejoReleaseCollectionSchema, data)

  const render = await changelogRenderer({
    blobBaseUrl: `https://${host}/${owner}/${repo}/src/branch/HEAD`,
    rawBaseUrl: `https://${host}/${owner}/${repo}/raw/branch/HEAD`,
  })

  return releases.map(r => {
    const { html, toc } = render(r.body, r.id)
    return {
      id: r.id,
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: r.name || r.tag_name,
      prerelease: r.prerelease,
      toc,
      link: r.html_url,
      publishedAt: r.published_at,
      draft: r.draft,
    } satisfies ReleaseData
  })
}
