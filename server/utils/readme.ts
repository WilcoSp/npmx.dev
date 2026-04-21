import type { ReadmeResponse } from '#shared/types/readme'
import type { Tokens } from 'marked'
import {
  type ProcessLinkFn,
  blockquote,
  createCodeHighlighter,
  isNpmJsUrlThatCanBeRedirected,
  // calculateSemanticDepth,
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  createLink,
  createHeading,
  createHtml,
  USER_CONTENT_PREFIX,
  MarkedHeadingExtension,
} from './mdKit'
import matter from 'gray-matter'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'
import { convertBlobOrFileToRawUrl, type RepositoryInfo } from '#shared/utils/git-providers'
import { decodeHtmlEntities, slugify } from '#shared/utils/html'
import { convertToEmoji } from '#shared/utils/emoji'
import { toProxiedImageUrl } from '#server/utils/image-proxy'
import { escapeHtml } from './docs/text'

/**
 * Playground provider configuration
 */
interface PlaygroundProvider {
  id: string // Provider identifier
  name: string
  domains: string[] // Associated domains
  paths?: string[]
  icon?: string // Provider icon name
}

/**
 * Known playground/demo providers
 */
const PLAYGROUND_PROVIDERS: PlaygroundProvider[] = [
  {
    id: 'stackblitz',
    name: 'StackBlitz',
    domains: ['stackblitz.com', 'stackblitz.io'],
    icon: 'stackblitz',
  },
  {
    id: 'codesandbox',
    name: 'CodeSandbox',
    domains: ['codesandbox.io', 'githubbox.com', 'csb.app'],
    icon: 'codesandbox',
  },
  {
    id: 'codepen',
    name: 'CodePen',
    domains: ['codepen.io'],
    icon: 'codepen',
  },
  {
    id: 'jsfiddle',
    name: 'JSFiddle',
    domains: ['jsfiddle.net'],
    icon: 'jsfiddle',
  },
  {
    id: 'replit',
    name: 'Replit',
    domains: ['repl.it', 'replit.com'],
    icon: 'replit',
  },
  {
    id: 'gitpod',
    name: 'Gitpod',
    domains: ['gitpod.io'],
    icon: 'gitpod',
  },
  {
    id: 'vue-playground',
    name: 'Vue Playground',
    domains: ['play.vuejs.org', 'sfc.vuejs.org'],
    icon: 'vue',
  },
  {
    id: 'nuxt-new',
    name: 'Nuxt Starter',
    domains: ['nuxt.new'],
    icon: 'nuxt',
  },
  {
    id: 'vite-new',
    name: 'Vite Starter',
    domains: ['vite.new'],
    icon: 'vite',
  },
  {
    id: 'typescript-playground',
    name: 'TypeScript Playground',
    domains: ['typescriptlang.org'],
    paths: ['/play'],
    icon: 'typescript',
  },
  {
    id: 'solid-playground',
    name: 'Solid Playground',
    domains: ['playground.solidjs.com'],
    icon: 'solid',
  },
  {
    id: 'svelte-playground',
    name: 'Svelte Playground',
    domains: ['svelte.dev'],
    paths: ['/repl', '/playground'],
    icon: 'svelte',
  },
  {
    id: 'tailwind-playground',
    name: 'Tailwind Play',
    domains: ['play.tailwindcss.com'],
    icon: 'tailwindcss',
  },
  {
    id: 'marko-playground',
    name: 'Marko Playground',
    domains: ['markojs.com'],
    paths: ['/playground'],
    icon: 'marko',
  },
]

/**
 * Check if a URL is a playground link and return provider info
 */
function matchPlaygroundProvider(url: string): PlaygroundProvider | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    for (const provider of PLAYGROUND_PROVIDERS) {
      for (const domain of provider.domains) {
        if (
          (hostname === domain || hostname.endsWith(`.${domain}`)) &&
          (!provider.paths || provider.paths.some(path => parsed.pathname.startsWith(path)))
        ) {
          return provider
        }
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

marked.use({
  tokenizer: {
    heading: MarkedHeadingExtension,
  },
})

function withUserContentPrefix(value: string): string {
  return value.startsWith(USER_CONTENT_PREFIX) ? value : `${USER_CONTENT_PREFIX}${value}`
}

// function toUserContentId(value: string): string {
//   return `${USER_CONTENT_PREFIX}${value}`
// }

function toUserContentHash(value: string): string {
  return `#${withUserContentPrefix(value)}`
}

function decodeHashFragment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Resolve a relative URL to an absolute URL.
 * If repository info is available, resolve to provider's raw file URLs.
 * For markdown files (.md), use blob URLs so they render properly.
 * Otherwise, fall back to jsdelivr CDN (except for .md files which are left unchanged).
 */
function resolveUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  if (!url) return url
  if (url.startsWith('#')) {
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    // Normalize markdown-style heading fragments to the same slug format used
    // for generated README heading IDs, but leave already-prefixed values as-is.
    const fragment = url.slice(1)
    if (!fragment) {
      return '#'
    }
    if (fragment.startsWith(USER_CONTENT_PREFIX)) {
      return `#${fragment}`
    }

    const normalizedFragment = slugify(decodeHashFragment(fragment))
    return toUserContentHash(normalizedFragment || fragment)
  }
  // Absolute paths (e.g. /package/foo from a previous npmjs redirect) are already resolved
  if (url.startsWith('/')) return url
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

  // Use provider's URL base when repository info is available
  // This handles assets that exist in the repo but not in the npm tarball
  if (repoInfo?.rawBaseUrl) {
    // Normalize the relative path (remove leading ./)
    let relativePath = url.replace(/^\.\//, '')

    // If package is in a subdirectory, resolve relative paths from there
    // e.g., for packages/ai with ./assets/hero.gif → packages/ai/assets/hero.gif
    // but for ../../.github/assets/banner.jpg → resolve relative to subdirectory
    if (repoInfo.directory) {
      // Split directory into parts for relative path resolution
      const dirParts = repoInfo.directory.split('/').filter(Boolean)

      // Handle ../ navigation
      while (relativePath.startsWith('../')) {
        relativePath = relativePath.slice(3)
        dirParts.pop()
      }

      // Reconstruct the path
      if (dirParts.length > 0) {
        relativePath = `${dirParts.join('/')}/${relativePath}`
      }
    }

    // For markdown files, use blob URL so they render on the provider's site
    // For other files, use raw URL for direct access
    const baseUrl = isMarkdownFile ? repoInfo.blobBaseUrl : repoInfo.rawBaseUrl
    return `${baseUrl}/${relativePath}`
  }

  // For markdown files without repo info, leave unchanged (like npm does)
  // This avoids 404s from jsdelivr which doesn't render markdown
  if (isMarkdownFile) {
    return url
  }

  // Fallback: relative URLs → jsdelivr CDN (may 404 if asset not in npm tarball)
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

// Convert blob/src URLs to raw URLs for images across all providers
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
//
// External images are proxied through /api/registry/image-proxy to prevent
// third-party servers from collecting visitor IP addresses and User-Agent data.
// Proxy URLs are HMAC-signed to prevent open proxy abuse.
// See: https://github.com/npmx-dev/npmx.dev/issues/1138
function resolveImageUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  // Skip already-proxied URLs (from a previous resolveImageUrl call in the
  // marked renderer — sanitizeHtml transformTags may call this again)
  if (url.startsWith('/api/registry/image-proxy')) {
    return url
  }
  const resolved = resolveUrl(url, packageName, repoInfo)
  const rawUrl = repoInfo?.provider
    ? convertBlobOrFileToRawUrl(resolved, repoInfo.provider)
    : resolved
  const { imageProxySecret } = useRuntimeConfig()
  return toProxiedImageUrl(rawUrl, imageProxySecret)
}

// Helper to prefix id attributes with 'user-content-'

export function prefixId(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (attribs.id) {
    attribs.id = withUserContentPrefix(attribs.id)
  }
  return { tagName, attribs }
}

/**
 * Render YAML frontmatter as a GitHub-style key-value table.
 */
function renderFrontmatterTable(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
  if (entries.length === 0) return ''

  const rows = entries
    .map(([key, value]) => {
      const displayValue =
        typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
      return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(displayValue)}</td></tr>`
    })
    .join('\n')
  return `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>\n${rows}\n</tbody></table>\n`
}

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
): Promise<ReadmeResponse> {
  if (!content) return { html: '', playgroundLinks: [], toc: [] }

  // Parse and strip YAML frontmatter, render as table if present
  let markdownBody = content
  let frontmatterHtml = ''
  try {
    const { data, content: body } = matter(content)
    if (data && Object.keys(data).length > 0) {
      frontmatterHtml = renderFrontmatterTable(data)
      markdownBody = body
    }
  } catch {
    // If frontmatter parsing fails, render the full content as-is
  }

  const renderer = new marked.Renderer()

  // Collect playground links during parsing
  const collectedLinks: PlaygroundLink[] = []
  const seenUrls = new Set<string>()

  const { toc, heading, processHeading } = createHeading()

  renderer.heading = heading

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = await createCodeHighlighter()

  function processImage(href: string) {
    return resolveImageUrl(href, packageName, repoInfo)
  }

  // Resolve image URLs (with GitHub blob → raw conversion)
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    const resolvedHref = processImage(href)
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    const altAttr = text ? ` alt="${escapeHtml(text)}"` : ''
    return `<img src="${resolvedHref}"${altAttr}${titleAttr}>`
  }

  // Helper: resolve a link href, collect playground links, and build <a> attributes.
  // Used by both the markdown renderer.link and the HTML <a> interceptor so that
  // all link processing happens in a single pass during marked rendering.
  const processLink: ProcessLinkFn = (href: string, label: string) => {
    const resolvedHref = resolveUrl(href, packageName, repoInfo)

    // Collect playground links
    const provider = matchPlaygroundProvider(resolvedHref)
    if (provider && !seenUrls.has(resolvedHref)) {
      seenUrls.add(resolvedHref)
      collectedLinks.push({
        url: resolvedHref,
        provider: provider.id,
        providerName: provider.name,
        label: decodeHtmlEntities(label || provider.name),
      })
    }

    // Security attributes for external links
    const extraAttrs =
      resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
        ? ' rel="nofollow noreferrer noopener" target="_blank"'
        : ''

    return { resolvedHref, extraAttrs }
  }

  renderer.link = createLink(processLink)
  renderer.html = createHtml({ processHeading, processLink })

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = blockquote

  marked.setOptions({ renderer })

  // Strip trailing whitespace (tabs/spaces) from code block closing fences.
  // While marky-markdown handles these gracefully, marked fails to recognize
  // the end of a code block if the closing fences are followed by unexpected whitespaces.
  const normalizedContent = markdownBody.replace(/^( {0,3}(?:`{3,}|~{3,}))\s*$/gm, '$1')
  const rawHtml = frontmatterHtml + (marked.parse(normalizedContent) as string)

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // disallow styles other than the ones shiki emits
    allowedStyles: {
      span: {
        'color': [/^#[0-9a-f]{3,8}$/i],
        '--shiki-light': [/^#[0-9a-f]{3,8}$/i],
      },
    },
    // Transform img src URLs (GitHub blob → raw, relative → GitHub raw)
    transformTags: {
      // Headings are already processed to correct semantic levels by processHeading()
      // during the marked rendering pass. The sanitizer just needs to preserve them.
      // For any stray headings that didn't go through processHeading (shouldn't happen),
      // we still apply a safe fallback shift.
      h1: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h1', attribs }
        return { tagName: 'h3', attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h2', attribs }
        return { tagName: 'h4', attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs }
        return { tagName: 'h5', attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '6' } }
      },
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
        }
        return { tagName, attribs }
      },
      source: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
        }
        if (attribs.srcset) {
          attribs.srcset = attribs.srcset
            .split(',')
            .map(entry => {
              const parts = entry.trim().split(/\s+/)
              const url = parts[0]
              if (!url) return entry.trim()
              const descriptor = parts[1]
              const resolvedUrl = resolveImageUrl(url, packageName, repoInfo)
              return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
            })
            .join(', ')
        }
        return { tagName, attribs }
      },
      // Markdown links are fully processed in renderer.link (single-pass).
      // However, inline HTML <a> tags inside paragraphs are NOT seen by
      // renderer.html (marked parses them as paragraph tokens, not html tokens).
      // So we still need to collect playground links here for those cases.
      // The seenUrls set ensures no duplicates across both paths.
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        const resolvedHref = resolveUrl(attribs.href, packageName, repoInfo)

        // Collect playground links from inline HTML <a> tags that weren't
        // caught by renderer.link or renderer.html
        const provider = matchPlaygroundProvider(resolvedHref)
        if (provider && !seenUrls.has(resolvedHref)) {
          seenUrls.add(resolvedHref)
          collectedLinks.push({
            url: resolvedHref,
            provider: provider.id,
            providerName: provider.name,
            // sanitize-html transformTags doesn't provide element text content,
            // so we fall back to the provider name for the label
            label: provider.name,
          })
        }

        // Add security attributes for external links (idempotent)
        if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
          attribs.rel = 'nofollow noreferrer noopener'
          attribs.target = '_blank'
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

  return {
    html: convertToEmoji(sanitized),
    mdExists: Boolean(content),
    playgroundLinks: collectedLinks,
    toc,
  }
}
