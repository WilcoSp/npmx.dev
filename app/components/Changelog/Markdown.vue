<script setup lang="ts">
const { info, requestedVersion, tpTarget } = defineProps<{
  info: ChangelogMarkdownInfo
  requestedVersion: string | null | undefined
  tpTarget?: HTMLElement | null
}>()

const route = useRoute()

const { data, error } = await useFetch(
  () => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}`,
)

if (import.meta.client) {
  // doing this server side can make it that we go to the homepage
  watchEffect(() => {
    const toc = data.value?.toc

    if (toc && route.hash) {
      navigateTo(route.hash)
      return
    }
    if (!toc || !requestedVersion || route.hash) {
      return
    }
    // lc = lower case
    const lcRequestedVersion = requestedVersion.toLowerCase()
    for (const item of toc) {
      if (item.text.toLowerCase().includes(lcRequestedVersion)) {
        navigateTo(`#${item.id}`)
        return
      }
    }
  })
}
</script>
<template>
  <Teleport v-if="data?.toc && data.toc.length > 1 && !!tpTarget" :to="tpTarget">
    <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
  </Teleport>
  <Readme v-if="data?.html" :html="data.html"></Readme>
  <slot v-else-if="error" name="error"></slot>
</template>
