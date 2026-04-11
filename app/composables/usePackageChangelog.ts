import type { ChangelogInfo } from '~~/shared/types/changelog'

export function usePackageChangelog(
  packageName: MaybeRefOrGetter<string | null | undefined>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<ChangelogInfo | null>(() => {
    const name = toValue(packageName)
    if (!name) return 'data:text/json,null' // returns null
    const ver = toValue(version)
    const base = `/api/changelog/info/${name}`
    return ver ? `${base}/v/${ver}` : base
  })
}
