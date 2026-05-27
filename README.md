# NineT Website

The public website for [NineT](https://ninet.io) — AI news, briefed by AI.

## Stack
- Single-file HTML/CSS/JS (no build step)
- Supabase for articles & newsletter signups
- Cloudflare Pages for hosting

## Deploy
Push to `main` → Cloudflare Pages auto-deploys.

## SEO: IndexNow Verification

The file `411091f40da502c415a24696430e09d4.txt` at the repo root is the IndexNow domain ownership token. It is served as plain text by Cloudflare Pages and read by Bing, Yandex, Seznam, and Naver to verify that we own ninet.io before accepting URL submissions. Do not delete or modify this file. To rotate the key, generate a new one (`openssl rand -hex 16`), create a new file with that name, update the key constant in whichever Worker references it, and only then delete the old file.
