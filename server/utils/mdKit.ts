import type { Tokens, RendererApi, Renderer } from 'marked'
import { highlightCodeSync, getShikiHighlighter } from './shiki'
import { decodeHtmlEntities, stripHtmlTags, slugify } from '#shared/utils/html'

/// for marked

// constands
const npmJsHosts = new Set(['www.npmjs.com', 'npmjs.com', 'www.npmjs.org', 'npmjs.org'])

/** These path on npmjs.com don't belong to packages or search, so we shouldn't try to replace them with npmx.dev urls */
const reservedPathsNpmJs = [
  'products',
  'login',
  'signup',
  'advisories',
  'blog',
  'about',
  'press',
  'policies',
]

// blockquote & code

/**
 * GitHub-style callouts: > [!NOTE], > [!TIP], etc.
 */
export const blockquote: RendererApi['blockquote'] = function (
  this: Renderer<string, string>,
  { tokens },
) {
  const body = this.parser.parse(tokens)

  const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i)

  if (calloutMatch?.[1]) {
    const calloutType = calloutMatch[1].toLowerCase()
    const cleanedBody = body.replace(calloutMatch[0], '<p>')
    return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`
  }

  return `<blockquote>${body}</blockquote>\n`
}

// link

export type ProcessLinkFn = (
  href: string,
  label: string,
  // readme.ts also needs the extraAttrs for more things, so can't be a boolean
) => { resolvedHref: string; extraAttrs: string }

const EMAIL_REGEX = /^[\w+\-.]+@[\w\-.]+\.[a-z]+$/i

/**
 * Resolve link URLs, add security attributes, and collect playground links
 *
 * — all in a single pass during marked rendering (no deferred processing)
 */
export function createLink(processLink: ProcessLinkFn): RendererApi['link'] {
  return function (this: Renderer<string, string>, { href, title, tokens }: Tokens.Link) {
    const eTitle = escapeHtml(title ?? '')
    const text = this.parser.parseInline(tokens)
    const titleAttr = eTitle ? ` title="${eTitle}"` : ''
    let plainText = stripHtmlTags(text).trim()

    // If plain text is empty, check if we have an image with alt text
    if (!plainText && tokens.length === 1 && tokens[0]?.type === 'image') {
      plainText = tokens[0].text
    }

    const { resolvedHref, extraAttrs } = processLink(href, plainText || eTitle || '')

    if (!resolvedHref) return text

    // prevents package@1.0.0 being made into an email
    if (href.startsWith('mailto:') && !EMAIL_REGEX.test(plainText)) {
      return text
    }

    return `<a href="${resolvedHref}"${titleAttr}${extraAttrs}>${text}</a>`
  }
}

export const isNpmJsUrlThatCanBeRedirected = (url: URL) => {
  if (!npmJsHosts.has(url.host)) {
    return false
  }

  if (
    url.pathname === '/' ||
    reservedPathsNpmJs.some(path => url.pathname.startsWith(`/${path}`))
  ) {
    return false
  }

  return true
}

/**
 * created code highlighter with Shiki for Marked
 */
export async function createCodeHighlighter(): Promise<RendererApi['code']> {
  const shiki = await getShikiHighlighter()

  // Syntax highlighting for code blocks (uses shared highlighter)
  return ({ text, lang }: Tokens.Code) => {
    const html = highlightCodeSync(shiki, text, lang || 'text')
    // Add copy button
    return `<div class="readme-code-block" >
  <button type="button" class="readme-copy-button" aria-label="Copy code" check-icon="i-lucide:check" copy-icon="i-lucide:copy" data-copy>
  <span class="i-lucide:copy" aria-hidden="true"></span>
  <span class="sr-only">Copy code</span>
  </button>
  ${html}
  </div>`
  }
}

// heading

const USER_CONTENT_PREFIX = 'user-content-'

// README h1 always becomes h3
// For deeper levels, ensure sequential order
// Don't allow jumping more than 1 level deeper than previous
export function calculateSemanticDepth(depth: number, lastSemanticLevel: number) {
  if (depth === 1) return 3
  const maxAllowed = Math.min(lastSemanticLevel + 1, 6)
  return Math.min(depth + 2, maxAllowed)
}

function getHeadingPlainText(text: string): string {
  return decodeHtmlEntities(stripHtmlTags(text).trim())
}

function getHeadingSlugSource(text: string): string {
  return stripHtmlTags(text).trim()
}

function toUserContentId(value: string, idPrefix?: string): string {
  return idPrefix ? `${USER_CONTENT_PREFIX}${idPrefix}-${value}` : `${USER_CONTENT_PREFIX}${value}`
}

const anchorTokenRegex = /^<a(\s.+)?\/?>$/
const htmlAnchorRe = /<a(\s[^>]*?)href=(["'])([^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi

export function createHeading(options: { lastSemanticLevel?: number; idPrefix?: string } = {}) {
  let { lastSemanticLevel = 2, idPrefix } = options
  const toc: TocItem[] = []
  const usedSlugs = new Map<string, number>()

  const heading: RendererApi['heading'] = function (
    this: Renderer<string, string>,
    { tokens, depth },
  ) {
    const isAnchorHeading =
      anchorTokenRegex.test(tokens[0]?.raw ?? '') && tokens[tokens.length - 1]?.raw === '</a>'

    // for anchor headings, we will ignore user-added id and add our own
    const tokensWithoutAnchor = isAnchorHeading ? tokens.slice(1, -1) : tokens
    const displayHtml = this.parser.parseInline(tokensWithoutAnchor)
    const plainText = getHeadingPlainText(displayHtml)
    const slugSource = getHeadingSlugSource(displayHtml)
    return processHeading(depth, displayHtml, plainText, slugSource)
  }

  function processHeading(
    depth: number,
    displayHtml: string,
    plainText: string,
    slugSource: string,
    preservedAttrs = '',
  ) {
    const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
    lastSemanticLevel = semanticLevel

    let slug = slugify(slugSource)
    if (!slug) slug = 'heading'

    const count = usedSlugs.get(slug) ?? 0
    usedSlugs.set(slug, count + 1)
    const uniqueSlug = count === 0 ? slug : `${slug}-${count}`
    const id = toUserContentId(uniqueSlug, idPrefix)

    if (plainText) {
      toc.push({ text: plainText, id, depth })
    }

    // The browser doesn't support anchors within anchors and automatically extracts them from each other,
    // causing a hydration error. To prevent this from happening in such cases, we use the anchor separately
    if (htmlAnchorRe.test(displayHtml)) {
      return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}>${displayHtml}<a href="#${id}"></a></h${semanticLevel}>\n`
    }

    return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}><a href="#${id}">${displayHtml}</a></h${semanticLevel}>\n`
  }

  return { heading, toc, processHeading }
}

///! readme
// renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
//   const isAnchorHeading =
//     anchorTokenRegex.test(tokens[0]?.raw ?? '') && tokens[tokens.length - 1]?.raw === '</a>'

//   // for anchor headings, we will ignore user-added id and add our own
//   const tokensWithoutAnchor = isAnchorHeading ? tokens.slice(1, -1) : tokens
//   const displayHtml = this.parser.parseInline(tokensWithoutAnchor)
//   const plainText = getHeadingPlainText(displayHtml)
//   const slugSource = getHeadingSlugSource(displayHtml)
//   return processHeading(depth, displayHtml, plainText, slugSource)
// }

// function processHeading(
//   depth: number,
//   displayHtml: string,
//   plainText: string,
//   slugSource: string,
//   preservedAttrs = '',
// ) {
//   const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
//   lastSemanticLevel = semanticLevel

//   let slug = slugify(slugSource)
//   if (!slug) slug = 'heading'

//   const count = usedSlugs.get(slug) ?? 0
//   usedSlugs.set(slug, count + 1)
//   const uniqueSlug = count === 0 ? slug : `${slug}-${count}`
//   const id = toUserContentId(uniqueSlug)

//   if (plainText) {
//     toc.push({ text: plainText, id, depth })
//   }

//   // The browser doesn't support anchors within anchors and automatically extracts them from each other,
//   // causing a hydration error. To prevent this from happening in such cases, we use the anchor separately
//   if (htmlAnchorRe.test(displayHtml)) {
//     return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}>${displayHtml}<a href="#${id}"></a></h${semanticLevel}>\n`
//   }

//   return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}><a href="#${id}">${displayHtml}</a></h${semanticLevel}>\n`
// }

///! changelog
// renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
//   // Calculate the target semantic level based on document structure
//   // Start at h3 (since page h1 + section h2 already exist)
//   // But ensure we never skip levels - can only go down by 1 or stay same/go up
//   const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
//   lastSemanticLevel = semanticLevel
//   const text = this.parser.parseInline(tokens)

//   // Generate GitHub-style slug for anchor links
//   // adding release id to prevent conflicts
//   let slug = slugify(text)
//   if (!slug) slug = 'heading' // Fallback for empty headings

//   // Handle duplicate slugs (GitHub-style: foo, foo-1, foo-2)
//   const count = usedSlugs.get(slug) ?? 0
//   usedSlugs.set(slug, count + 1)
//   const uniqueSlug = count === 0 ? slug : `${slug}-${count}`

//   // Prefix with 'user-content-' to avoid collisions with page IDs
//   // (e.g., #install, #dependencies, #versions are used by the package page)
//   const id = `${idPrefix}-${uniqueSlug}`

//   // Collect TOC item with plain text (HTML stripped & emoji's added)
//   const plainText = convertToEmoji(stripHtmlTags(text))
//     .replace(/&nbsp;?/g, '') // remove non breaking spaces
//     .trim()
//   if (plainText) {
//     toc.push({ text: plainText, id, depth })
//   }

//   return `<h${semanticLevel} id="${id}" data-level="${depth}">${text} <a href="#${id}"> </a></h${semanticLevel}>\n`
// }

/// sanatizer

export const ALLOWED_ATTR: Record<string, string[]> = {
  '*': ['id'], // Allow id on all tags
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'align'],
  'source': ['src', 'srcset', 'type', 'media'],
  'button': ['class', 'title', 'type', 'aria-label', 'data-copy'],
  'th': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'td': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'h3': ['data-level', 'align'],
  'h4': ['data-level', 'align'],
  'h5': ['data-level', 'align'],
  'h6': ['data-level', 'align'],
  'blockquote': ['data-callout'],
  'details': ['open'],
  'code': ['class'],
  'pre': ['class', 'style'],
  'span': ['class', 'style'],
  'div': ['class', 'style', 'align'],
  'p': ['align'],
}

// allow h1-h6, but replace h1-h2 later since we shift README headings down by 2 levels
// (page h1 = package name, h2 = "Readme" section, so README h1 → h3)
export const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'strong',
  'em',
  'del',
  's',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'picture',
  'source',
  'details',
  'summary',
  'div',
  'span',
  'sup',
  'sub',
  'kbd',
  'mark',
  'button',
]
