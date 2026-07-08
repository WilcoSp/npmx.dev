<script setup lang="ts">
const { text, disableFrefetch, fetchMarkdown, markdown } = defineProps<{
  text: string
  disableFrefetch?: boolean
  fetchMarkdown: () => Promise<void>
  markdown: string | undefined
}>()

function prefetchMarkdown() {
  if (disableFrefetch || !!markdown) {
    return
  }
  fetchMarkdown()
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
    if (!markdown) {
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
    >
      <span>{{ copiedReadme ? $t('common.copied') : $t('common.copy') }}</span>
      <span v-if="copyReadmePending" class="i-lucide:loader-circle animate-spin size-4"></span>
    </ButtonBase>
  </TooltipApp>
</template>
