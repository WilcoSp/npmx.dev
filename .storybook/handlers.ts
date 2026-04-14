import { http, HttpResponse } from 'msw'

export const repoStatsHandler = http.get('/api/repo-stats', () => {
  return HttpResponse.json({
    contributors: 123,
    commits: 1234,
    pullRequests: 1234,
  })
})

export const contributorsHandler = http.get('/api/contributors', () => {
  return HttpResponse.json([
    {
      login: 'mock-steward-a',
      id: 1001,
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=steward-a',
      html_url: 'https://github.com/mock-steward-a',
      contributions: 2800,
      role: 'steward',
      sponsors_url: 'https://github.com/sponsors/',
    },
    {
      login: 'mock-steward-b',
      id: 1002,
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=steward-b',
      html_url: 'https://github.com/mock-steward-b',
      contributions: 420,
      role: 'steward',
      sponsors_url: null,
    },
    {
      login: 'mock-maintainer-a',
      id: 1003,
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=maintainer-a',
      html_url: 'https://github.com/mock-maintainer-a',
      contributions: 210,
      role: 'maintainer',
      sponsors_url: null,
    },
    {
      login: 'mock-contributor-a',
      id: 1004,
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=contributor-a',
      html_url: 'https://github.com/mock-contributor-a',
      contributions: 95,
      role: 'contributor',
      sponsors_url: 'https://github.com/sponsors/',
    },
    {
      login: 'mock-contributor-b',
      id: 1005,
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=contributor-b',
      html_url: 'https://github.com/mock-contributor-b',
      contributions: 47,
      role: 'contributor',
      sponsors_url: null,
    },
  ])
})
