<script setup lang="ts">
const { info, tpTarget } = defineProps<{
  info: ChangelogMarkdownInfo
  tpTarget?: HTMLElement | null
}>()

const { data } = useLazyFetch(() => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}`)
</script>
<template>
  <Teleport
    v-if="data?.toc && data.toc.length > 1 && !!tpTarget"
    :to="tpTarget"
    class="flex justify-end mt-3"
  >
    <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
  </Teleport>
  <Readme v-if="data?.html" :html="data.html"></Readme>
</template>
