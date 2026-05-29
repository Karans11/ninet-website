// Cloudflare Pages Function — serves /robots.txt
// Filename is literally robots.txt.js so the route maps to /robots.txt.
// Only onRequestGet is exported; Pages auto-returns 405 for other methods.

export async function onRequestGet() {
  const body = `User-agent: *
Allow: /

# Block scraping of internal/admin paths if they ever exist
Disallow: /api/
Disallow: /admin/
Disallow: /_/

# Block known aggressive AI training crawlers (allow indexers, block training scrapers)
User-agent: GPTBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

# Welcome search indexers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: YandexBot
Allow: /

# Point all crawlers to the sitemap
Sitemap: https://ninet.io/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
