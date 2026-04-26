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
    rawBaseUrl: `https://raw.githubusercontent.com/test-owner/test-repo/HEAD`,
  }
}

function changelogMdInfoWithPath() {
  return {
    blobBaseUrl: `https://github.com/test-owner/test-repo/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/test-owner/test-repo/HEAD`,
    path: 'packages/test/changelog.md',
  }
}

describe('URL Resolution', () => {
  describe('resolves from /markdown.md & releases', () => {
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

    it('resolves non-.md files to raw URL (not blob)', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Image](./assets/logo.png)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/assets/logo.png"',
      )
    })

    it('resolves to the root when going to far back', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[License](../../../LICENSE)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/LICENSE"',
      )
    })
  })

  describe('resolves from a deeper changelog.md', () => {
    it('resolves relative .md links to blob URL for rendered viewing', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        `href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/CONTRIBUTING.md"`,
      )
    })

    it('resolves without ./ or / .md links to a relative blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Guide](GUIDE.MD)`
      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/GUIDE.MD"',
      )
    })

    it('resolves absolute .md links to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Security](/SECURITY.MD)`

      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/SECURITY.MD"',
      )
    })

    it('resolves nested relative .md links to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[API Docs](./docs/api/reference.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/docs/api/reference.md"',
      )
    })

    it('resolves relative .md links with query strings to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[FAQ](./FAQ.md?ref=main)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/FAQ.md?ref=main"',
      )
    })

    it('resolves relative .md links with anchors to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Install Section](./CONTRIBUTING.md#installation)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/CONTRIBUTING.md#installation"',
      )
    })

    it('resolves non-.md files to raw URL (not blob)', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Image](./assets/logo.png)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/packages/test/assets/logo.png"',
      )
    })

    it('resolves to the root when going to far back', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[License](../../../LICENSE)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/LICENSE"',
      )
    })
  })

  describe('resolves full urls', () => {
    it('leaves absolute .md URLs unchanged', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[External Guide](https://example.com/guide.md)`
      const result = renderer(markdown)
      expect(result.html).toContain('href="https://example.com/guide.md"')
    })

    it('leaves absolute non-.md URLs unchanged', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Docs](https://docs.example.com/)`
      const result = renderer(markdown)
      expect(result.html).toContain('href="https://docs.example.com/"')
    })
  })

  describe('anchor links', () => {
    describe('for changelog.md', () => {
      it('prefixes anchor links with user-content-', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)

        const markdown = `[Jump to section](#installation)`
        const result = renderer(markdown)

        expect(result.html).toContain('href="#user-content-installation"')
      })

      it('normalizes mixed-case heading fragments to lowercase slugs', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)
        const markdown = `[Associations section](#Associations)`
        const result = renderer(markdown)

        expect(result.html).toContain('href="#user-content-associations"')
      })
    })

    describe('for releases', () => {
      it('prefixes anchor links with user-content-', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)

        const markdown = `[Jump to section](#installation)`
        const result = renderer(markdown, '123456789')

        expect(result.html).toContain('href="#user-content-123456789-installation"')
      })

      it('normalizes mixed-case heading fragments to lowercase slugs', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)
        const markdown = `[Associations section](#Associations)`
        const result = renderer(markdown, 123456789)

        expect(result.html).toContain('href="#user-content-123456789-associations"')
      })
    })
  })

  describe('npm.js urls', () => {
    it('redirects npmjs.com urls to local', async () => {
      const markdown = `[Some npmjs.com link](https://www.npmjs.com/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.com urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.com link](http://npmjs.com/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('does not redirect npmjs.com to local if they are in the list of exceptions', async () => {
      const markdown = `[Root Contributing](https://www.npmjs.com/products)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="https://www.npmjs.com/products"')
    })

    it('redirects npmjs.org urls to local', async () => {
      const markdown = `[Some npmjs.org link](https://www.npmjs.org/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.org urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.org link](http://npmjs.org/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })
  })
})
