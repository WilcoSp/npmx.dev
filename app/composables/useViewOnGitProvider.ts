/**
 * Return the text "see on {git provider}" based on the given provider
 */
export function useViewOnGitProvider(
  provider: MaybeRefOrGetter<ProviderId | (string & {}) | null | undefined>,
) {
  const { t } = useI18n()
  return computed(() => {
    const uProvider = toValue(provider)
    // using this switch instead of `view_on.${provider}` to prevent missing future translations
    switch (uProvider) {
      case 'github':
        return t('common.view_on.github')
      case 'gitlab':
        return t('common.view_on.gitlab')
      case 'bitbucket':
        return t('common.view_on.bitbucket')
      case 'codeberg':
        return t('common.view_on.codeberg')
      case 'forgejo':
        return t('common.view_on.forgejo')
      case 'gitea':
        return t('common.view_on.gitea')
      case 'gitee':
        return t('common.view_on.gitee')
      case 'radicle':
        return t('common.view_on.radicle')
      case 'sourcehut':
        return t('common.view_on.sourcehut')
      case 'tangled':
        return t('common.view_on.tangled')
    }
    return t('common.view_on.git_repo')
  })
}
