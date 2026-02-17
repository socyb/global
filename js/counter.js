/* ═══════════════════════════════════════════════════════
   Simple view counter
   
   Uses localStorage for a lightweight client-side counter.
   For a shared counter across all visitors, you can replace
   this with a free service like:
     - https://api.countapi.xyz (or similar)
     - A simple Firebase Realtime Database counter
     - A Cloudflare Worker + KV
   
   Currently: each browser keeps its own count (useful for
   GitHub Pages where there's no backend).
   ═══════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const STORAGE_KEY = 'global_page_views';

    // Get current count
    let count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

    // Increment
    count += 1;
    localStorage.setItem(STORAGE_KEY, count);

    // Update DOM
    const el = document.getElementById('viewCount');
    if (el) {
        el.textContent = count.toLocaleString('es-MX');
    }

    // ── Update "last updated" with build/deploy info ──
    // If you want to auto-update this from git, you can inject the date
    // during a CI/CD step. For now we leave the static date from HTML.
})();
