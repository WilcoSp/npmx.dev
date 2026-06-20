import * as v from 'valibot'
import { createForgejoRepoInfo, createGithubRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import {
  ERROR_CHANGELOG_FILE_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider')
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
      switch (provider as ProviderId) {
        case 'github':
          return await getGithubMarkDown(owner, repo, path)
        case 'codeberg':
        case 'forgejo':
          return await getForgejoMarkdown(owner, repo, path, host ?? 'codeberg.org')

        default:
          throw createError({
            status: 404,
            statusMessage: ERROR_CHANGELOG_NOT_FOUND,
          })
      }
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

async function getGithubMarkDown(owner: string, repo: string, path: string) {
  const data = await $fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`)

  const markdown = v.parse(v.string(), data)

  return (await changelogRenderer(createGithubRepoInfo(owner, repo, path)))(markdown)
}

async function getForgejoMarkdown(owner: string, repo: string, path: string, host: string) {
  const data = await $fetch(`https://${host}/${owner}/${repo}/raw/branch/HEAD/${path}`)

  const markdown = v.parse(v.string(), data)

  return (await changelogRenderer(createForgejoRepoInfo(host, owner, repo, path)))(markdown)
}
