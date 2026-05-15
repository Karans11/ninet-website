(function () {
  'use strict';

  /* Supabase anon key is meant to be public — RLS enforces access. */
  const SUPABASE_URL  = 'https://khpnsigvensxkxdntgqz.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocG5zaWd2ZW5zeGt4ZG50Z3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ2MDQsImV4cCI6MjA2ODI1MDYwNH0.3HAuhNTsKk6CzmhJ2X3tVgpP_BaRdXhFIwq3DxeCBVs';

  const client = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { 'X-Client-Info': 'ninet-web/2.0' } }
      })
    : null;

  /* Helpers */
  const escapeHTML = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const safeURL = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url, 'https://ninet.io');
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch { return ''; }
  };
  const safeImage = (url) => { const s = safeURL(url); return /^https?:/i.test(s) ? s : ''; };
  const hostname = (url) => {
    const s = safeURL(url);
    if (!s) return 'ninet.io';
    try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return 'ninet.io'; }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diffH = (Date.now() - d.getTime()) / 36e5;
    if (diffH < 1)  return Math.max(1, Math.round(diffH * 60)) + 'm ago';
    if (diffH < 24) return Math.round(diffH) + 'h ago';
    if (diffH < 24 * 7) return Math.round(diffH / 24) + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const readingTime = (summary) => {
    if (!summary) return '1m read';
    const words = String(summary).split(/\s+/).length;
    return Math.max(1, Math.round(words / 220)) + 'm read';
  };

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

  const RATE_KEY = 'ninet_sub_rate';
  function checkRate() {
    try {
      const now = Date.now();
      const arr = JSON.parse(sessionStorage.getItem(RATE_KEY) || '[]').filter(t => now - t < 60000);
      if (arr.length >= 3) return false;
      arr.push(now); sessionStorage.setItem(RATE_KEY, JSON.stringify(arr));
      return true;
    } catch { return true; }
  }

  async function submitSubscribe(email, msgEl, btn, originalLabel, msgClassPrefix) {
    btn.disabled = true; btn.textContent = 'Subscribing…';
    try {
      const { error } = await client.from('subscribers').insert({ email, source: 'website' });
      if (error) {
        if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
          msgEl.className = msgClassPrefix + ' ok';
          msgEl.textContent = "You're already on the list. See you in your inbox.";
          return true;
        }
        throw error;
      } else {
        msgEl.className = msgClassPrefix + ' ok';
        msgEl.textContent = 'Subscribed. Check your inbox to confirm.';
        return true;
      }
    } catch (err) {
      console.error('[NineT] subscribe error:', err);
      msgEl.className = msgClassPrefix + ' err';
      msgEl.textContent = 'Something went wrong. Please try again.';
      return false;
    } finally {
      btn.disabled = false; btn.textContent = originalLabel;
    }
  }

  /* ─────────────────────────────────────────
     WELCOME MODAL (runs on every page)
     ───────────────────────────────────────── */
  const welcomeOverlay = document.getElementById('welcomeOverlay');
  if (welcomeOverlay) {
    const WELCOME_KEY = 'ninet_welcome_seen_v1';
    const welcomeClose = document.getElementById('welcomeClose');
    const welcomeSkip  = document.getElementById('welcomeSkip');
    const welcomeForm  = document.getElementById('welcomeForm');
    const welcomeEmail = document.getElementById('welcomeEmail');
    const welcomeBtn   = document.getElementById('welcomeBtn');
    const welcomeMsg   = document.getElementById('welcomeMsg');
    const welcomeHp    = document.getElementById('welcomeHp');

    const showWelcome = () => {
      welcomeOverlay.style.display = 'grid';
      document.body.classList.add('modal-open');
      setTimeout(() => welcomeEmail && welcomeEmail.focus(), 400);
    };
    const dismissWelcome = () => {
      welcomeOverlay.style.display = 'none';
      document.body.classList.remove('modal-open');
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
    };

    try { if (!localStorage.getItem(WELCOME_KEY)) showWelcome(); } catch { showWelcome(); }

    welcomeClose && welcomeClose.addEventListener('click', dismissWelcome);
    welcomeSkip  && welcomeSkip.addEventListener('click', dismissWelcome);
    welcomeOverlay.addEventListener('click', (e) => { if (e.target === welcomeOverlay) dismissWelcome(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && welcomeOverlay.style.display !== 'none') dismissWelcome(); });

    welcomeForm && welcomeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      welcomeMsg.textContent = ''; welcomeMsg.className = 'welcome-msg';
      if (welcomeHp.value) { dismissWelcome(); return; }
      if (!checkRate()) { welcomeMsg.className = 'welcome-msg err'; welcomeMsg.textContent = 'Too many attempts. Please wait a moment.'; return; }
      const email = welcomeEmail.value.trim().toLowerCase();
      if (!isValidEmail(email)) { welcomeMsg.className = 'welcome-msg err'; welcomeMsg.textContent = 'Please enter a valid email address.'; return; }
      if (!client) { welcomeMsg.className = 'welcome-msg err'; welcomeMsg.textContent = 'Service unavailable. Please refresh.'; return; }
      const ok = await submitSubscribe(email, welcomeMsg, welcomeBtn, 'Subscribe', 'welcome-msg');
      if (ok) { welcomeForm.reset(); setTimeout(dismissWelcome, 1400); }
    });
  }

  /* ─────────────────────────────────────────
     NAV SCROLL EFFECT (runs on every page)
     ───────────────────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('compact', window.scrollY > 30);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     REVEAL ON SCROLL (runs on every page)
     ───────────────────────────────────────── */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  /* ─────────────────────────────────────────
     FOOTER YEAR
     ───────────────────────────────────────── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ─────────────────────────────────────────
     HOMEPAGE-ONLY: feed, hero, search, subscribe
     ───────────────────────────────────────── */
  const cardsEl = document.getElementById('cards');
  if (!cardsEl || !client) return; // not on the homepage

  const PAGE_SIZE = 24;
  const state = { items: [], page: 0, query: '', category: 'all', loading: false, done: false };

  const searchEl    = document.getElementById('search');
  const searchWrap  = document.getElementById('searchWrap');
  const chipsEl     = document.getElementById('chips');
  const loadMoreBtn = document.getElementById('loadMore');
  const heroStack   = document.getElementById('heroStack');

  function skeletonCard() {
    return `
      <div class="card" aria-hidden="true" style="cursor:default">
        <div class="card-img skeleton" style="border-radius:0"></div>
        <div class="card-body">
          <div class="skeleton" style="height:24px;width:85%;margin-bottom:10px"></div>
          <div class="skeleton" style="height:24px;width:60%;margin-bottom:18px"></div>
          <div class="skeleton" style="height:14px;width:100%;margin-bottom:8px"></div>
          <div class="skeleton" style="height:14px;width:90%;margin-bottom:8px"></div>
          <div class="skeleton" style="height:14px;width:70%"></div>
        </div>
      </div>`;
  }
  function showSkeletons(n = 6) { cardsEl.innerHTML = Array.from({ length: n }, skeletonCard).join(''); }

  function articleCard(a) {
    const title    = escapeHTML(a.title || 'Untitled');
    const summary  = escapeHTML(a.summary || '');
    const category = escapeHTML(a.category || 'AI');
    const source   = escapeHTML(a.source || hostname(a.original_url));
    const url      = safeURL(a.original_url) || '#';
    const img      = safeImage(a.image_url);
    const date     = escapeHTML(formatDate(a.published_at));
    const initial  = escapeHTML((a.title || 'N').trim().charAt(0).toUpperCase());

    const imageBlock = img
      ? `<img src="${img}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
         <div class="card-img-fallback" style="display:none">${initial}</div>`
      : `<div class="card-img-fallback">${initial}</div>`;

    return `
      <a class="card" href="${url}" target="_blank" rel="noopener noreferrer nofollow">
        <div class="card-img">
          ${imageBlock}
          <span class="card-cat">${category}</span>
        </div>
        <div class="card-body">
          <h3 class="card-ttl">${title}</h3>
          <p class="card-sum">${summary}</p>
          <div class="card-foot">
            <span class="card-source">${source} · ${date}</span>
            <span class="card-arrow" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </div>
      </a>`;
  }

  function heroCard(a, idx) {
    const cls = ['c1','c2','c3'][idx] || 'c1';
    const url = safeURL(a.original_url) || '#';
    return `
      <a class="stack-card ${cls}" href="${url}" target="_blank" rel="noopener noreferrer nofollow">
        <div class="cat">${escapeHTML(a.category || 'AI')}</div>
        <div class="ttl">${escapeHTML(a.title || 'Untitled')}</div>
        <p class="sum">${escapeHTML(a.summary || '')}</p>
        <div class="meta">
          <span>${escapeHTML(hostname(a.original_url))}</span>
          <span>${escapeHTML(readingTime(a.summary))}</span>
        </div>
      </a>`;
  }

  function render(append = false) {
    if (state.items.length === 0 && !append) {
      cardsEl.innerHTML = `<div class="empty"><h3>No briefings found</h3><p>Try a different search term or category.</p></div>`;
      return;
    }
    const html = state.items.map(articleCard).join('');
    if (append) cardsEl.insertAdjacentHTML('beforeend', html);
    else cardsEl.innerHTML = html;
  }

  async function fetchHeroLatest() {
    try {
      const { data, error } = await client
        .from('public_articles')
        .select('id, title, summary, original_url, image_url, category, published_at, source')
        .order('published_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      const rows = (data || []).slice(0, 3);
      if (rows.length > 0 && heroStack) {
        heroStack.innerHTML = rows.map((a, i) => heroCard(a, i)).join('');
      }
    } catch (err) {
      console.error('[NineT] hero fetch error:', err);
    }
  }

  async function fetchArticles({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    searchWrap && searchWrap.classList.add('searching');

    if (!append) {
      state.page = 0; state.done = false;
      showSkeletons(6);
    } else {
      loadMoreBtn.disabled = true; loadMoreBtn.innerHTML = 'Loading…';
    }

    try {
      let q = client
        .from('public_articles')
        .select('id, title, summary, original_url, image_url, category, published_at, source')
        .order('published_at', { ascending: false })
        .range(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE - 1);

      if (state.category && state.category !== 'all') q = q.eq('category', state.category);
      if (state.query) {
        const safe = state.query.replace(/[%_,*'"\\()]/g, '').trim().slice(0, 80);
        if (safe) q = q.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      if (rows.length < PAGE_SIZE) state.done = true;
      state.items = append ? state.items.concat(rows) : rows;
      render(append);

      loadMoreBtn.style.display = state.done ? 'none' : 'inline-flex';
      loadMoreBtn.disabled = false;
      loadMoreBtn.innerHTML = `Load more briefings <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
    } catch (err) {
      console.error('[NineT] fetch error:', err);
      cardsEl.innerHTML = `<div class="errstate"><h3>Couldn't reach the wire</h3><p>Check your connection and try again. We'll be right back.</p></div>`;
      loadMoreBtn.style.display = 'none';
    } finally {
      state.loading = false;
      searchWrap && searchWrap.classList.remove('searching');
    }
  }

  /* Search + filters + paging */
  if (searchEl) {
    const onSearchInput = debounce(() => { state.query = searchEl.value.trim(); fetchArticles(); }, 320);
    searchEl.addEventListener('input', onSearchInput);
  }
  if (chipsEl) {
    chipsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.cat || 'all';
      fetchArticles();
    });
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => { state.page += 1; fetchArticles({ append: true }); });
  }

  /* Inline subscribe (bottom section) */
  const subForm  = document.getElementById('subForm');
  if (subForm) {
    const subEmail = document.getElementById('subEmail');
    const subBtn   = document.getElementById('subBtn');
    const subMsg   = document.getElementById('subMsg');
    const hp       = document.getElementById('hp');
    subForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      subMsg.textContent = ''; subMsg.className = 'sub-msg';
      if (hp.value) { subMsg.className = 'sub-msg ok'; subMsg.textContent = 'Subscribed.'; subForm.reset(); return; }
      if (!checkRate()) { subMsg.className = 'sub-msg err'; subMsg.textContent = 'Too many attempts. Please wait a moment.'; return; }
      const email = subEmail.value.trim().toLowerCase();
      if (!isValidEmail(email)) { subMsg.className = 'sub-msg err'; subMsg.textContent = 'Please enter a valid email address.'; return; }
      const ok = await submitSubscribe(email, subMsg, subBtn, 'Subscribe', 'sub-msg');
      if (ok) subForm.reset();
    });
  }

  /* Hero count */
  (async () => {
    try {
      const { count } = await client.from('public_articles').select('id', { count: 'exact', head: true });
      if (count) {
        const el = document.getElementById('stat-count');
        if (el) el.textContent = count.toLocaleString();
      }
    } catch {}
  })();

  // Kickoff
  fetchHeroLatest();
  fetchArticles();
})();
