import { type prefixId as prefixIdFn } from '../readme'
import { marked } from 'marked'
import { slugify } from '#shared/utils/html'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'
import {
  type ProcessLinkFn,
  blockquote,
  createCodeHighlighter,
  isNpmJsUrlThatCanBeRedirected,
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  createHeading,
  createLink,
  createHtml,
  MarkedHeadingExtension,
  renderToRawHtml,
  createImage,
} from '../mdKit'

// const EMAIL_REGEX = /^[\w+\-.]+@[\w\-.]+\.[a-z]+$/i

export async function changelogRenderer(mdRepoInfo: MarkdownRepoInfo) {
  const renderer = new marked.Renderer({
    gfm: true,
  })

  marked.use({
    tokenizer: {
      heading: MarkedHeadingExtension,
    },
  })

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = blockquote

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = await createCodeHighlighter()

  return (markdownBody: string | null, releaseId?: string | number) => {
    // Collect table of contents items during parsing
    // const toc: TocItem[] = []

    if (!markdownBody) {
      return {
        html: null,
        toc: [],
      }
    }

    const idPrefix = releaseId ? `user-content-${releaseId}` : `user-content`

    const processLink: ProcessLinkFn = (href: string, _label: string) => {
      const resolvedHref = resolveUrl(href, mdRepoInfo, idPrefix)

      // Security attributes for external links
      let extraAttrs =
        resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
          ? ' rel="nofollow noreferrer noopener" target="_blank"'
          : ''

      return { resolvedHref, extraAttrs }
    }

    renderer.link = createLink(processLink)

    const { heading, toc, processHeading } = createHeading({
      lastSemanticLevel: releaseId ? 2 : 1,
      idPrefix: releaseId?.toString(),
    })
    renderer.heading = heading

    renderer.html = createHtml({ processHeading, processLink })

    renderer.image = createImage(href => resolveImageUrl(href, mdRepoInfo, idPrefix))

    // Helper to prefix id attributes with 'user-content-'
    const prefixId: typeof prefixIdFn = (tagName: string, attribs: sanitizeHtml.Attributes) => {
      if (attribs.id && !attribs.id.startsWith('user-content-')) {
        attribs.id = `${idPrefix}-${attribs.id}`
      }
      return { tagName, attribs }
    }

    const rawHtml = renderToRawHtml({ renderer, markdownBody })

    return {
      html: sanitizeRawHTML(convertToEmoji(rawHtml), mdRepoInfo, prefixId, idPrefix),
      toc,
    }
  }
}

export function sanitizeRawHTML(
  rawHtml: string,
  mdRepoInfo: MarkdownRepoInfo,
  prefixId: typeof prefixIdFn,
  idPrefix: string,
) {
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // Transform img src URLs (GitHub blob → raw, relative → GitHub raw)
    transformTags: {
      h1: (_, attribs) => {
        return { tagName: 'h3', attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        return { tagName: 'h4', attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs: attribs }
        return { tagName: 'h5', attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '6' } }
      },
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, mdRepoInfo, idPrefix)
        }
        return { tagName, attribs }
      },
      source: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, mdRepoInfo, idPrefix)
        }
        if (attribs.srcset) {
          attribs.srcset = attribs.srcset
            .split(',')
            .map(entry => {
              const parts = entry.trim().split(/\s+/)
              const url = parts[0]
              if (!url) return entry.trim()
              const descriptor = parts[1]
              const resolvedUrl = resolveUrl(url, mdRepoInfo, idPrefix)
              return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
            })
            .join(', ')
        }
        return { tagName, attribs }
      },
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        const resolvedHref = resolveUrl(attribs.href, mdRepoInfo, idPrefix)

        // Add security attributes for external links
        if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
          attribs.rel = 'nofollow noreferrer noopener'
          attribs.target = '_blank'
        } else {
          attribs.target = ''
        }
        attribs.href = resolvedHref
        return { tagName, attribs }
      },
      div: prefixId,
      p: prefixId,
      span: prefixId,
      section: prefixId,
      article: prefixId,
    },
  })
}

interface MarkdownRepoInfo {
  /** Raw file URL base (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl: string
  /** Blob/rendered file URL base (e.g., https://github.com/owner/repo/blob/HEAD) */
  blobBaseUrl: string
  /**
   * path to the markdown file, can't start with /
   */
  path?: string
}

function resolveUrl(url: string, repoInfo: MarkdownRepoInfo, idPrefix: string) {
  if (!url) return url
  if (url.startsWith('#')) {
    if (url.startsWith('#user-content')) {
      return url
    }
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    return `#${idPrefix}-${slugify(url.slice(1))}`
  }
  if (hasProtocol(url, { acceptRelative: true })) {
    try {
      const parsed = new URL(url, 'https://example.com')
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Redirect npmjs urls to ourself
        if (isNpmJsUrlThatCanBeRedirected(parsed)) {
          return parsed.pathname + parsed.search + parsed.hash
        }
        return url
      }
    } catch {
      // Invalid URL, fall through to resolve as relative
    }
    // return protocol-relative URLs (//example.com) as-is
    if (url.startsWith('//')) {
      return url
    }
    // for non-HTTP protocols (javascript:, data:, etc.), don't return, treat as relative
  }

  // Check if this is a markdown file link
  const isMarkdownFile = /\.md$/i.test(url.split('?')[0]?.split('#')[0] ?? '')
  const baseUrl = isMarkdownFile ? repoInfo.blobBaseUrl : repoInfo.rawBaseUrl

  if (url.startsWith('/')) {
    return checkResolvedUrl(new URL(`${baseUrl}${url}`).href, baseUrl)
  }

  if (!hasProtocol(url)) {
    // the '/' ensure bare relative links stay after "....../HEAD"
    return checkResolvedUrl(new URL(url, `${baseUrl}/${repoInfo.path ?? '/'}`).href, baseUrl)
  }

  return url
}

function resolveImageUrl(url: string, repoInfo: MarkdownRepoInfo, idPrefix: string): string {
  // Skip already-proxied URLs (from a previous resolveImageUrl call in the
  // marked renderer — sanitizeHtml transformTags may call this again)
  if (url.startsWith('/api/registry/image-proxy')) {
    return url
  }
  const rawUrl = resolveUrl(url, repoInfo, idPrefix)
  const { imageProxySecret } = useRuntimeConfig()
  return toProxiedImageUrl(rawUrl, imageProxySecret)
}

/**
 * check resolved url that it still contains the base url
 * @returns the resolved url if starting with baseUrl else baseUrl
 */
function checkResolvedUrl(resolved: string, baseUrl: string) {
  if (resolved.startsWith(baseUrl)) {
    return resolved
  }
  return baseUrl
}
