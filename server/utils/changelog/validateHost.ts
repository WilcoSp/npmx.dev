import { NEED_HOST, type ProviderId } from '~~/shared/utils/git-providers'
import { custom, optional } from 'valibot'
import { ERROR_UNKNOWN_GIT_HOST } from '~~/shared/utils/constants'

export function validateHostWithValibot(provider: ProviderId) {
  return optional(
    custom<string>(host => {
      if (!NEED_HOST.includes(provider)) return true
      if (typeof host !== 'string') return false
      return validateHost(provider, host)
    }, ERROR_UNKNOWN_GIT_HOST),
    '',
  )
}
