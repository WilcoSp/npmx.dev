import * as v from 'valibot'

export const GithubReleaseSchama = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.nullable(v.string()),
  tag: v.string(),
  draft: v.boolean(),
  prerelease: v.boolean(),
  markdown: v.nullable(v.string()), // can be null if no descroption was made
  publishedAt: v.pipe(v.string(), v.isoTimestamp()),
})

export const GithubReleaseCollectionSchama = v.object({
  releases: v.array(GithubReleaseSchama),
})

// keeping this here in case it's needed
// export type GithubRelease = v.InferOutput<typeof GithubReleaseSchama>
// export type GithubReleaseCollection = v.InferOutput<typeof GithubReleaseCollectionSchama>

export const forgejoReleaseSchama = v.object({
  id: v.number(),
  tag_name: v.string(),
  name: v.string(),
  body: v.string(),
  html_url: v.pipe(v.string(), v.url()),
  draft: v.boolean(),
  prerelease: v.boolean(),
  published_at: v.pipe(v.string(), v.isoTimestamp()),
})
