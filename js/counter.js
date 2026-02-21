/* ═══════════════════════════════════════════════════════
   Live date display
   
   Shows today's date in Spanish in the header badge.
   Updates automatically every day.
   ═══════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const el = document.getElementById('dateDisplay');
    if (!el) return;

    const now = new Date();
    const formatted = now.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Capitalize first letter (e.g. "jueves 20 de febrero de 2026")
    el.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
})();
