<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app'

defineOptions({
  inheritAttrs: false,
})

const { text, fetchMarkdown, markdown, status } = defineProps<{
  text: string
  fetchMarkdown: () => Promise<void>
  markdown: string | undefined
  status: AsyncDataRequestStatus
}>()

function prefetchMarkdown() {
  if (status === 'idle') {
    fetchMarkdown()
  }
}

const {
  copied: copiedReadme,
  copy,
  copyPending: copyReadmePending,
} = useClipboard({
  copiedDuring: 2000,
})

function copyMarkdown() {
  copy(async () => {
    if (status === 'idle' || status === 'pending') {
      await fetchMarkdown()
    }
    return markdown ?? ''
  })
}
</script>
<template>
  <TooltipApp :text position="bottom">
    <ButtonBase
      @mouseenter="prefetchMarkdown"
      @focus="prefetchMarkdown"
      @click="copyMarkdown"
      :aria-pressed="copiedReadme"
      :aria-label="copiedReadme ? $t('common.copied') : text"
      :classicon="copiedReadme ? 'i-lucide:check' : 'i-simple-icons:markdown'"
      v-bind="$attrs"
    >
      <span>{{ copiedReadme ? $t('common.copied') : $t('common.copy') }}</span>
      <span v-if="copyReadmePending" class="i-lucide:loader-circle animate-spin size-4"></span>
    </ButtonBase>
  </TooltipApp>
</template>
