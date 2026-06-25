// Cloudflare Pages Function — serves /article/[slug]
// Per-article SEO page: NewsArticle JSON-LD, Open Graph, Twitter cards.
// Branded 404 on missing slug, missing article, invalid slug, or Supabase error.
// All HTML and JSON-LD values are escaped at the boundary.

const SUPABASE_URL = 'https://khpnsigvensxkxdntgqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocG5zaWd2ZW5zeGt4ZG50Z3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ2MDQsImV4cCI6MjA2ODI1MDYwNH0.3HAuhNTsKk6CzmhJ2X3tVgpP_BaRdXhFIwq3DxeCBVs';

const SITE = 'https://ninet.io';
const IOS_URL = 'https://apps.apple.com/app/id6751162074';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=io.ninet.newsapp';
const FALLBACK_OG_IMAGE = 'https://ninet.io/logo.png';
const TWITTER_HANDLE = '@NineTOfficial';

// ─── escaping helpers ───────────────────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON.stringify handles standard JSON quoting. This pass blocks the four
// characters that would otherwise allow a </script> breakout from string
// values embedded inside <script type="application/ld+json">.
function escapeJsonString(jsonStr) {
  return String(jsonStr)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ─── validation + small utils ───────────────────────────────────────────────

function isValidSlug(slug) {
  return typeof slug === 'string'
    && slug.length > 0
    && slug.length <= 200
    && /^[a-zA-Z0-9_-]+$/.test(slug);
}

function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : null;
  } catch { return null; }
}

function safeHttpsUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? url : null;
  } catch { return null; }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoOrNull(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function truncate(str, n) {
  if (!str) return '';
  const s = String(str).trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

// ─── shared CSS / nav / footer ──────────────────────────────────────────────

const SHARED_CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
.nav{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:rgba(10,10,10,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.08)}
.logo{font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#fff}
.logo em{font-style:italic;background:linear-gradient(90deg,#00C6FF,#3B82F6,#7C3AED);-webkit-background-clip:text;background-clip:text;color:transparent}
.nav-cta{padding:9px 16px;border-radius:999px;background:#00D9FF;color:#000;font-weight:600;font-size:13px;transition:transform .2s}
.nav-cta:hover{transform:translateY(-1px)}
.nav-right{display:flex;align-items:center;gap:24px}
.nav-link{color:rgba(255,255,255,0.7);font-size:14px;font-weight:500;transition:color .2s}
.nav-link:hover{color:#fff}
.wrap{max-width:720px;margin:0 auto;padding:32px 24px 64px}
.cat-pill{display:inline-block;padding:5px 12px;border-radius:999px;border:1px solid rgba(0,217,255,0.4);color:#00D9FF;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:20px}
h1.title{font-family:Georgia,serif;font-size:34px;line-height:1.25;letter-spacing:-0.01em;margin-bottom:16px;color:#fff;font-weight:400}
.meta{color:#888;font-size:14px;margin-bottom:28px}
.hero{width:100%;aspect-ratio:16/9;background:#181818;border-radius:12px;overflow:hidden;margin-bottom:28px}
.hero img{width:100%;height:100%;object-fit:cover}
.summary{font-size:18px;line-height:1.7;color:#e5e5e5;margin-bottom:36px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;margin-bottom:20px}
.cta-primary{flex:1 1 280px;display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:12px;background:linear-gradient(90deg,#00C6FF,#3B82F6,#7C3AED);color:#fff;font-weight:600;font-size:15px;text-align:center;transition:transform .2s,box-shadow .2s}
.cta-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(59,130,246,0.5)}
.cta-secondary{flex:1 1 240px;display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:12px;background:transparent;border:1px solid #333;color:#fff;font-size:15px;font-weight:500;text-align:center;transition:border-color .2s,background .2s}
.cta-secondary:hover{border-color:#00D9FF;background:rgba(0,217,255,0.06)}
.play-link{display:inline-block;color:#888;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:1px;transition:color .2s}
.play-link:hover{color:#00D9FF}
.footer{margin-top:80px;padding:28px 24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#888;font-size:13px}
.footer .tag{margin-bottom:10px;color:#aaa}
.footer .links{display:flex;gap:18px;justify-content:center;flex-wrap:wrap}
.footer a{color:#888;transition:color .2s}
.footer a:hover{color:#00D9FF}
.err{max-width:540px;margin:0 auto;padding:80px 24px;text-align:center}
.err h1{font-family:Georgia,serif;font-size:36px;margin-bottom:12px;color:#fff;font-weight:400}
.err p{color:#888;margin-bottom:28px}
.err-back{display:inline-flex;align-items:center;padding:12px 24px;border-radius:12px;background:linear-gradient(90deg,#00C6FF,#3B82F6,#7C3AED);color:#fff;font-weight:600;font-size:14px;transition:transform .2s}
.err-back:hover{transform:translateY(-2px)}
@media (max-width:600px){
  h1.title{font-size:28px}
  .wrap{padding:24px 18px 48px}
  .cta-primary,.cta-secondary{flex:1 1 100%}
  .nav-right{gap:12px}
  .nav-link{display:none}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}`;

const NAV_HTML = `<nav class="nav">
  <a class="logo" href="${SITE}/">Nine<em>T</em></a>
  <div class="nav-right">
    <a class="nav-link" href="${SITE}/">Feed</a>
    <a class="nav-link" href="${SITE}/#subscribe">Subscribe</a>
    <a class="nav-cta" href="${SITE}/#app">Get the app</a>
  </div>
</nav>`;

const FOOTER_HTML = `<footer class="footer"><div class="tag">NineT — Less Reading. More Knowing.</div><div class="links"><a href="${SITE}/">Feed</a><a href="${SITE}/about-ninet">About</a><a href="${SITE}/privacy-policy">Privacy</a><a href="${SITE}/terms-of-service">Terms</a></div></footer>`;

// ─── templates ──────────────────────────────────────────────────────────────

function renderArticleHtml(article, slug) {
  const canonical = `${SITE}/article/${slug}`;
  const titleRaw = article.title || 'Untitled';
  const summaryRaw = article.summary || '';
  const categoryRaw = article.category || 'AI';
  const sourceRaw = article.source || '';

  const title = escapeHtml(titleRaw);
  const summary = escapeHtml(summaryRaw);
  const summaryShort = escapeHtml(truncate(summaryRaw, 155));
  const category = escapeHtml(categoryRaw);
  const source = escapeHtml(sourceRaw);

  const heroImage = safeHttpsUrl(article.image_url);
  const ogImage = heroImage || FALLBACK_OG_IMAGE;
  const heroImageEsc = heroImage ? escapeHtml(heroImage) : '';
  const ogImageEsc = escapeHtml(ogImage);

  const originalUrlRaw = safeHttpUrl(article.original_url);
  const originalUrl = originalUrlRaw ? escapeHtml(originalUrlRaw) : '';

  const dateNice = escapeHtml(formatDate(article.published_at));
  const published = isoOrNull(article.published_at);
  const modified = isoOrNull(article.updated_at) || published;

  let metaLine = '';
  if (source && dateNice) metaLine = `Source: ${source} · ${dateNice}`;
  else if (source) metaLine = `Source: ${source}`;
  else if (dateNice) metaLine = dateNice;

  const heroBlock = heroImage
    ? `<div class="hero"><img src="${heroImageEsc}" alt="${title}" loading="eager" fetchpriority="high" decoding="async" referrerpolicy="no-referrer"></div>`
    : '';

  const secondaryCta = originalUrl
    ? `<a class="cta-secondary" href="${originalUrl}" target="_blank" rel="nofollow noopener noreferrer">↗ Read original${sourceRaw ? ` on ${source}` : ''}</a>`
    : '';

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: titleRaw,
    description: truncate(summaryRaw, 200),
    datePublished: published || '',
    dateModified: modified || '',
    image: ogImage,
    author: { '@type': 'Organization', name: 'NineT', url: SITE },
    publisher: {
      '@type': 'Organization',
      name: 'NineT',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` },
    },
    articleSection: categoryRaw,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };
  const jsonLd = escapeJsonString(JSON.stringify(ld));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | NineT</title>
<meta name="description" content="${summaryShort}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${summaryShort}">
<meta property="og:image" content="${ogImageEsc}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:site_name" content="NineT">
${published ? `<meta property="article:published_time" content="${escapeHtml(published)}">\n` : ''}<meta property="article:section" content="${category}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${TWITTER_HANDLE}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${summaryShort}">
<meta name="twitter:image" content="${ogImageEsc}">
<link rel="preconnect" href="https://ninet.zerodegrees.cloud">
<script type="application/ld+json">${jsonLd}</script>
<style>${SHARED_CSS}</style>
</head>
<body>
${NAV_HTML}
<main class="wrap">
<span class="cat-pill">${category}</span>
<h1 class="title">${title}</h1>
${metaLine ? `<div class="meta">${metaLine}</div>` : ''}
${heroBlock}
<p class="summary">${summary}</p>
<div class="cta-row">
<a class="cta-primary" href="${SITE}/#app">Get NineT — Read AI news in 60 seconds</a>
${secondaryCta}
</div>
</main>
${FOOTER_HTML}
</body>
</html>`;
}

function render404Html() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Article not found | NineT</title>
<meta name="description" content="This article was not found on NineT.">
<meta name="robots" content="noindex, follow">
<style>${SHARED_CSS}</style>
</head>
<body>
${NAV_HTML}
<main class="err">
<h1>Article not found</h1>
<p>This story may have been moved or removed.</p>
<a class="err-back" href="${SITE}/">Back to feed</a>
</main>
${FOOTER_HTML}
</body>
</html>`;
}

function notFoundResponse() {
  return new Response(render404Html(), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

// ─── data fetch ─────────────────────────────────────────────────────────────

async function fetchArticleBySlug(slug) {
  const url = `${SUPABASE_URL}/rest/v1/articles`
    + `?slug=eq.${encodeURIComponent(slug)}`
    + `&is_published=eq.true`
    + `&select=*`
    + `&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// ─── handler ────────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const slug = context && context.params ? context.params.slug : null;
  if (!isValidSlug(slug)) return notFoundResponse();

  try {
    const article = await fetchArticleBySlug(slug);
    if (!article) return notFoundResponse();
    return new Response(renderArticleHtml(article, slug), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (err) {
    return notFoundResponse();
  }
}
