// Cloudflare Pages Function — serves /sitemap.xml
// Filename is literally sitemap.xml.js so the route maps to /sitemap.xml.
// Fetches all published article slugs from Supabase (paginated) and emits
// sitemap.org-compliant XML. On Supabase failure, falls back to a static-only
// sitemap so the URL never 404s and crawlers always get something valid.

const SUPABASE_URL = 'https://khpnsigvensxkxdntgqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocG5zaWd2ZW5zeGt4ZG50Z3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ2MDQsImV4cCI6MjA2ODI1MDYwNH0.3HAuhNTsKk6CzmhJ2X3tVgpP_BaRdXhFIwq3DxeCBVs';
const PAGE_SIZE = 1000;
const MAX_PAGES = 60; // safety cap = 60,000 articles (well above current scale)

const STATIC_PAGES = [
  { loc: 'https://ninet.io/',                 priority: '1.0', changefreq: 'hourly' },
  { loc: 'https://ninet.io/about-ninet',      priority: '0.5', changefreq: 'monthly' },
  { loc: 'https://ninet.io/privacy-policy',   priority: '0.3', changefreq: 'yearly' },
  { loc: 'https://ninet.io/terms-of-service', priority: '0.3', changefreq: 'yearly' },
];

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchAllArticles() {
  const articles = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const url = `${SUPABASE_URL}/rest/v1/articles`
      + `?is_published=eq.true`
      + `&select=slug,published_at,updated_at`
      + `&order=published_at.desc`
      + `&limit=${PAGE_SIZE}`
      + `&offset=${from}`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    articles.push(...batch);
    if (batch.length < PAGE_SIZE) break; // last page
  }
  return articles;
}

function buildSitemap(articles) {
  const staticXml = STATIC_PAGES.map(p => `  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const articleXml = articles
    .filter(a => a && a.slug)
    .map(a => {
      const lastmod = isoOrNull(a.updated_at) || isoOrNull(a.published_at);
      const lastmodLine = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
      return `  <url>
    <loc>https://ninet.io/article/${escapeXml(a.slug)}</loc>${lastmodLine}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${articleXml ? `\n${articleXml}` : ''}
</urlset>
`;
}

export async function onRequestGet() {
  try {
    const articles = await fetchAllArticles();
    return new Response(buildSitemap(articles), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    // Graceful degradation — emit static-only sitemap so the URL never 404s.
    // Shorter cache so we retry sooner once Supabase recovers.
    return new Response(buildSitemap([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff',
        'X-Sitemap-Status': 'degraded',
      },
    });
  }
}
