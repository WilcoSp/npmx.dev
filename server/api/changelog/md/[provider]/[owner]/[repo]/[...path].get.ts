import { resolveURL } from 'ufo'
import * as v from 'valibot'
import { getBaseFileUrl } from '~~/server/utils/changelog/baseFileUrl'
import { createForgejoRepoInfo, createGithubRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import {
  ERROR_CHANGELOG_FILE_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    const owner = getRouterParam(event, 'owner')
    const path = getRouterParam(event, 'path')

    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: v.optional(v.string()) }), rawQuery)

    if (!repo || !provider || !owner || !path) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }

    try {
      const baseUrl = getBaseFileUrl({
        owner,
        provider: provider as ProviderId,
        repo,
        host,
      })
      const mdRepoInfo = getRepoInfo(provider, owner, repo, host, path)

      if (!baseUrl || !mdRepoInfo) {
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
      }
      const data = await $fetch(resolveURL(baseUrl.raw, path))
      const markdown = v.parse(v.string(), data)
      return (await changelogRenderer(mdRepoInfo))(markdown)
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_FILE_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR * 2, // 2 hours
    swr: true,
    getKey: event => {
      const provider = getRouterParam(event, 'provider') ?? ''
      const repo = getRouterParam(event, 'repo') ?? ''
      const owner = getRouterParam(event, 'owner') ?? ''
      const path = getRouterParam(event, 'path') ?? ''
      return `changelogMarkdown:v2:${provider}:${owner}:${repo}:${path.replaceAll('/', ':')}`
    },
    shouldBypassCache: () => import.meta.dev,
  },
)

function getRepoInfo(
  provider: ProviderId,
  owner: string,
  repo: string,
  host: string | undefined,
  path?: string,
) {
  switch (provider) {
    case 'github':
      return createGithubRepoInfo(owner, repo, path)
    case 'codeberg':
    case 'forgejo':
      return createForgejoRepoInfo(host ?? 'codeberg.org', owner, repo, path)
    case 'gitlab':
      return createGitLabRepoInfo(host ?? 'gitlab.com', owner, repo, path)
  }
}
