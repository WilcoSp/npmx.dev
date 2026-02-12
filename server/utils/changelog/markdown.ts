import { marked } from 'marked'
import { ALLOWED_ATTR, ALLOWED_TAGS } from '../readme'
import sanitizeHtml from 'sanitize-html'

export async function changelogRenderer() {
  const renderer = new marked.Renderer()

  // settings will need to be added still

  return (markdown: string) =>
    marked.parse(markdown, {
      renderer,
    })
}

export function sanitizeRawHTML(rawHtml: string) {
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
      // img: (tagName, attribs) => {
      //   if (attribs.src) {
      //     attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
      //   }
      //   return { tagName, attribs }
      // },
      // source: (tagName, attribs) => {
      //   if (attribs.src) {
      //     attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
      //   }
      //   if (attribs.srcset) {
      //     attribs.srcset = attribs.srcset
      //       .split(',')
      //       .map(entry => {
      //         const parts = entry.trim().split(/\s+/)
      //         const url = parts[0]
      //         if (!url) return entry.trim()
      //         const descriptor = parts[1]
      //         const resolvedUrl = resolveImageUrl(url, packageName, repoInfo)
      //         return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
      //       })
      //       .join(', ')
      //   }
      //   return { tagName, attribs }
      // },
      // a: (tagName, attribs) => {
      //   if (!attribs.href) {
      //     return { tagName, attribs }
      //   }

      //   const resolvedHref = resolveUrl(attribs.href, packageName, repoInfo)

      //   const provider = matchPlaygroundProvider(resolvedHref)
      //   if (provider && !seenUrls.has(resolvedHref)) {
      //     seenUrls.add(resolvedHref)

      //     collectedLinks.push({
      //       url: resolvedHref,
      //       provider: provider.id,
      //       providerName: provider.name,
      //       /**
      //        * We need to set some data attribute before hand because `transformTags` doesn't
      //        * provide the text of the element. This will automatically be removed, because there
      //        * is an allow list for link attributes.
      //        * */
      //       label: attribs['data-title-intermediate'] || provider.name,
      //     })
      //   }

      //   // Add security attributes for external links
      //   if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
      //     attribs.rel = 'nofollow noreferrer noopener'
      //     attribs.target = '_blank'
      //   }
      //   attribs.href = resolvedHref
      //   return { tagName, attribs }
      // },
      // div: prefixId,
      // p: prefixId,
      // span: prefixId,
      // section: prefixId,
      // article: prefixId,
    },
  })
}
