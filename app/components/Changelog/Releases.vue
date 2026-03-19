<script setup lang="ts">
import { slugify } from '~~/shared/utils/html'

const { info, requestedDate, requestedVersion } = defineProps<{
  info: ChangelogReleaseInfo
  requestedDate?: string
  requestedVersion?: string | null | undefined
}>()

const { data: releases, error } = await useFetch<ReleaseData[]>(
  () => `/api/changelog/releases/${info.provider}/${info.repo}`,
)

const route = useRoute()

const matchingDateReleases = computed(() => {
  if (!requestedDate || !releases.value) {
    return []
  }

  return releases.value.filter(release => {
    if (!release.publishedAt) {
      return
    }
    return requestedDate === toIsoDate(new Date(release.publishedAt))
  })
})

if (import.meta.client) {
  // doing this server side can make it that we go to the homepage
  watchEffect(() => {
    const uReleases = releases.value
    if (route.hash && uReleases) {
      navigateTo(route.hash, { replace: true })
      return
    }
    const date = requestedDate?.toLowerCase()
    if (route.hash || !date || !uReleases) {
      return
    }
    const uMatchingDateReleases = matchingDateReleases.value
    if (uMatchingDateReleases?.length < 1) {
      // if no releases have matched the requested version publish date then most likely no release note has been made
      return
    }

    if (requestedVersion) {
      for (const match of uMatchingDateReleases) {
        if (match.title.toLowerCase().includes(requestedVersion)) {
          navigateTo(`#release-${slugify(match.title)}`, { replace: true })
          return
        }
      }
    }
    navigateTo(`#date-${date}`, { replace: true })
  })
}
</script>
<template>
  <div class="flex flex-col gap-2 py-3" v-if="releases">
    <ChangelogCard v-for="release of releases" :release :key="release.id" />
  </div>
  <slot v-else-if="error" name="error"></slot>
</template>
