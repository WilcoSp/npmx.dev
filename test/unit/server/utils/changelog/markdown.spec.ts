import type { MarkdownRepoInfo } from '~~/server/utils/changelog/markdown'
import { describe, expect, it, vi, beforeAll } from 'vitest'

// testing changelog specific needs, others things are tested at ../readme.spec.ts

beforeAll(() => {
  vi.stubGlobal(
    'getShikiHighlighter',
    vi.fn().mockResolvedValue({
      getLoadedLanguages: () => [],
      codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
    }),
  )
  vi.stubGlobal(
    'useRuntimeConfig',
    vi.fn().mockReturnValue({
      imageProxySecret: 'test-secret-for-readme-tests',
    }),
  )
})

const { changelogRenderer } = await import('#server/utils/changelog/markdown')

function changelogMdinfo(): MarkdownRepoInfo {
  return {
    blobBaseUrl: `https://github.com/test-owner/test-repo/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/test-owner/t-repo/HEAD`,
  }
}

describe('Markdown File URL Resolution', () => {
  describe('resolves from /markdown.md', () => {
    it('resolves relative .md links to blob URL for rendered viewing', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        `href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md"`,
      )
    })

    it('resolves without ./ or / .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Guide](GUIDE.MD)`
      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/GUIDE.MD"',
      )
    })

    it('resolves absolute .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Security](/SECURITY.MD)`

      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/SECURITY.MD"',
      )
    })

    it('resolves nested relative .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[API Docs](./docs/api/reference.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/docs/api/reference.md"',
      )
    })

    it('resolves relative .md links with query strings to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[FAQ](./FAQ.md?ref=main)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/FAQ.md?ref=main"',
      )
    })

    it('resolves relative .md links with anchors to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Install Section](./CONTRIBUTING.md#installation)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md#installation"',
      )
    })
  })
})
