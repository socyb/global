/* ==========================================================================
   Globalización y Empleo · Clase prueba didáctica
   Tema, QR, presentación (teclado, clicker, deslizamiento, pantalla completa),
   ficha del ejercicio 1 y tarjetas de palabras clave. Sin dependencias.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = document.documentElement;
  const body = document.body;
  const isPdf = root.classList.contains("is-pdf");
  const params = new URLSearchParams(location.search);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
  };

  /* ── Tema claro / oscuro ────────────────────────────────────────────── */
  const themeBtn = $("#themeToggle");
  const applyTheme = (t) => {
    root.setAttribute("data-theme", t);
    if (themeBtn) {
      themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
      themeBtn.setAttribute("aria-label", t === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    }
  };
  applyTheme(root.getAttribute("data-theme") || "light");
  themeBtn?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store.set("global-cp-theme", next);
    applyTheme(next);
  });

  $("#printBtn")?.addEventListener("click", () => window.print());

  // En papel siempre se imprime en claro
  let themeBeforePrint = null;
  window.addEventListener("beforeprint", () => {
    themeBeforePrint = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light");
  });
  window.addEventListener("afterprint", () => {
    if (themeBeforePrint) root.setAttribute("data-theme", themeBeforePrint);
  });

  /* ── Aviso flotante ─────────────────────────────────────────────────── */
  const toast = $("#toast");
  let toastTimer;
  const say = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2400);
  };

  /* ══════════════════════════════════════════════════════════════════════
     Definiciones al pasar el ratón, tocar o enfocar (glosario.js)
     ══════════════════════════════════════════════════════════════════════ */
  const GLOS = window.GLOSARIO_CP || {};
  const TERMS = window.TERMINOS_CP || [];
  // Dónde se busca, qué se salta y qué cuenta como un bloque (una sola marca por término)
  const SCOPE = ".slide-in, .hero-in, .section-head, .task, .vcard, .biblio li, #fDeal";
  const SKIP = "a, button, label, select, option, textarea, input, script, style, svg, h1, h2, .t, .kicker, .s-kicker, .s-agenda, .s-foot, .vtag, .check-tag, .tip-pop, .ficha-card";
  const BLOCK = ".slide, .hero, .section-head, .task, .vcard, .biblio li, #fDeal";
  const ABBR = /^[A-ZÁÉÍÓÚ0-9.\- ]+$/;
  const termRe = TERMS.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${TERMS.map(([p]) => `(${p})`).join("|")})(?![\\p{L}\\p{N}])`, "gu")
    : null;
  const usedIn = new WeakMap();

  function annotate(scope) {
    if (!termRe) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || n.parentElement.closest(SKIP))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const block = node.parentElement.closest(BLOCK) || scope;
      if (!usedIn.has(block)) usedIn.set(block, new Set());
      const used = usedIn.get(block);
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0, hit = false, m;
      termRe.lastIndex = 0;
      while ((m = termRe.exec(text))) {
        const gi = m.slice(1).findIndex((g) => g !== undefined);
        const key = TERMS[gi][1];
        if (used.has(key) || !GLOS[key]) continue;
        used.add(key);
        hit = true;
        frag.append(text.slice(last, m.index));
        const el = document.createElement(ABBR.test(m[0]) ? "abbr" : "span");
        el.className = "t";
        el.dataset.t = key;
        el.textContent = m[0];
        frag.append(el);
        last = m.index + m[0].length;
      }
      if (!hit) return;
      frag.append(text.slice(last));
      node.replaceWith(frag);
    });
    wireTerms(scope);
  }

  function wireTerms(scope) {
    $$("[data-t]", scope).forEach((el) => {
      if (el.dataset.tWired) return;
      el.dataset.tWired = "1";
      el.classList.add("t");
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-expanded", "false");
      el.setAttribute("aria-controls", "tipPop");
      const g = GLOS[el.dataset.t];
      const name = el instanceof SVGElement && g ? g[0] : el.textContent.trim();
      if (g) el.setAttribute("aria-label", `${name}: ver definición`);
    });
  }

  const pop = document.createElement("div");
  pop.className = "tip-pop";
  pop.id = "tipPop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  body.appendChild(pop);

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let tipEl = null, pinned = false, showTimer, hideTimer;

  function placeTip(el) {
    const r = el.getBoundingClientRect();
    pop.style.left = "0px";
    pop.style.top = "0px";
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), innerWidth - pw - 8);
    let top = r.bottom + 10;
    if (top + ph > innerHeight - 8 && r.top - ph - 10 > 8) top = r.top - ph - 10;
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, top)}px`;
  }
  function openTip(el, pin) {
    const g = GLOS[el.dataset.t];
    if (!g) return;
    clearTimeout(hideTimer);
    if (tipEl && tipEl !== el) tipEl.setAttribute("aria-expanded", "false");
    tipEl = el;
    pinned = !!pin;
    pop.innerHTML = `<p class="tip-name">${esc(g[0])}</p>${g[2] ? `<p class="tip-orig">${esc(g[2])}</p>` : ""}${g[1] ? `<p class="tip-def">${esc(g[1])}</p>` : ""}`;
    pop.classList.toggle("is-pinned", pinned);
    pop.hidden = false;
    placeTip(el);
    el.setAttribute("aria-expanded", "true");
  }
  function closeTip() {
    clearTimeout(showTimer);
    pop.hidden = true;
    if (tipEl) tipEl.setAttribute("aria-expanded", "false");
    tipEl = null;
    pinned = false;
  }
  const tipOpen = () => !pop.hidden;

  document.addEventListener("mouseover", (e) => {
    if (!canHover) return;
    const el = e.target.closest?.(".t");
    if (el) {
      clearTimeout(hideTimer);
      if (pinned && tipEl !== el) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => openTip(el, pinned && tipEl === el), 90);
    } else if (e.target.closest?.(".tip-pop")) {
      clearTimeout(hideTimer);
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (!canHover || pinned) return;
    if (!e.target.closest?.(".t, .tip-pop")) return;
    if (e.relatedTarget?.closest?.(".tip-pop") || e.relatedTarget?.closest?.(".t") === tipEl) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(closeTip, 180);
  });
  // Clic o toque: fija la definición; otro clic en el término o fuera la cierra
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.(".t");
    if (el) {
      e.preventDefault();
      if (tipEl === el && pinned) closeTip();
      else openTip(el, true);
      return;
    }
    if (tipOpen() && !e.target.closest?.(".tip-pop")) closeTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.(".t");
    if (el && !pinned) openTip(el, false);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target.closest?.(".t") && !pinned) hideTimer = setTimeout(closeTip, 120);
  });
  // Teclado: Enter o espacio fijan la definición; Esc la cierra (antes que nada más)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && tipOpen()) {
      closeTip();
      e.stopImmediatePropagation();
      return;
    }
    const el = e.target.closest?.(".t");
    if (el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (tipEl === el && pinned) closeTip();
      else openTip(el, true);
    }
  }, true);
  addEventListener("scroll", () => { if (tipOpen()) (pinned ? placeTip(tipEl) : closeTip()); }, true);
  addEventListener("resize", () => { if (tipOpen()) placeTip(tipEl); });

  $$(SCOPE).forEach((s) => annotate(s));
  wireTerms(document);

  /* ── Código QR ──────────────────────────────────────────────────────── */
  const qrModal = $("#qrModal");
  if (qrModal) {
    $("#qrBtn")?.addEventListener("click", () => qrModal.showModal());
    qrModal.addEventListener("click", (e) => {
      const r = qrModal.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) qrModal.close();
    });
    const copyBtn = $("#qrCopyBtn");
    let t;
    copyBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("#qrUrl").textContent.trim());
        copyBtn.textContent = "Liga copiada ✓";
      } catch {
        copyBtn.textContent = "No se pudo copiar";
      }
      clearTimeout(t);
      t = setTimeout(() => { copyBtn.textContent = "Copiar liga"; }, 2000);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Presentación
     ══════════════════════════════════════════════════════════════════════ */
  const stage = $("#deckStage");
  if (stage) {
    const slides = $$(".slide", stage);
    const N = slides.length;
    const SUBS = ["La red", "El instrumento", "Cuatro casos", "Comercio y trabajo", "Cierre"];

    // Ruta (arriba a la derecha) y pie de cada diapositiva
    slides.forEach((s, i) => {
      const inner = $(".slide-in", s);
      s.setAttribute("aria-label", `Diapositiva ${i + 1} de ${N}`);
      const sub = Number(s.dataset.sub || 0);
      if (sub) {
        const ol = document.createElement("ol");
        ol.className = "s-agenda";
        ol.setAttribute("aria-hidden", "true");
        SUBS.forEach((txt, k) => {
          const li = document.createElement("li");
          li.textContent = txt;
          if (k + 1 === sub) li.className = "is-here";
          else if (k + 1 < sub) li.className = "is-done";
          ol.appendChild(li);
        });
        inner.appendChild(ol);
      }
      if (i > 0) {
        const f = document.createElement("div");
        f.className = "s-foot";
        f.setAttribute("aria-hidden", "true");
        f.innerHTML = `<span>Globalización y Empleo · FCA UNAM</span><span>${i + 1} / ${N}</span>`;
        inner.appendChild(f);
      }
    });

    const pips = $("#deckPips");
    const count = $("#deckCount");
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `Diapositiva ${i + 1}`);
      b.addEventListener("click", () => show(i));
      pips?.appendChild(b);
    });

    let cur = 0;
    const presenting = () => body.classList.contains("is-presenting");

    function show(i) {
      cur = Math.max(0, Math.min(N - 1, i));
      slides.forEach((s, k) => s.classList.toggle("is-active", k === cur));
      $$("button", pips).forEach((b, k) => b.setAttribute("aria-selected", String(k === cur)));
      if (count) count.textContent = `${cur + 1} / ${N}`;
      if (presenting()) history.replaceState(null, "", `#d${cur + 1}`);
    }

    const pending = () => $$("[data-frag]", slides[cur]).filter((f) => !f.classList.contains("is-on"));
    function next() {
      const p = pending();
      if (p.length) { p[0].classList.add("is-on"); return; }
      if (cur < N - 1) show(cur + 1);
    }
    function prev() { if (cur > 0) show(cur - 1); }

    $("#deckNext")?.addEventListener("click", next);
    $("#deckPrev")?.addEventListener("click", prev);

    // Reloj del expositor: se ve con la tecla T, en modo presentación
    const clock = $("#deckClock");
    let t0 = null, tick = null;
    function startClock() {
      if (t0) return;
      t0 = Date.now();
      tick = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        clock.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        clock.classList.toggle("is-late", s >= 15 * 60);
      }, 500);
    }

    function present(on) {
      body.classList.toggle("is-presenting", on);
      if (on) {
        startClock();
        if (!document.fullscreenElement && root.requestFullscreen && !params.has("presentar")) {
          root.requestFullscreen().catch(() => {});
        }
        history.replaceState(null, "", `#d${cur + 1}`);
      } else {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        history.replaceState(null, "", "#presentacion");
        $("#presentacion")?.scrollIntoView({ block: "start" });
      }
    }
    $$("[data-present]").forEach((b) => b.addEventListener("click", () => present(true)));
    $("#deckExit")?.addEventListener("click", () => present(false));
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && presenting()) {
        body.classList.remove("is-presenting");
        history.replaceState(null, "", "#presentacion");
      }
    });

    // La barra de control aparece al mover el ratón
    let barTimer;
    document.addEventListener("mousemove", () => {
      if (!presenting()) return;
      body.classList.add("show-bar");
      clearTimeout(barTimer);
      barTimer = setTimeout(() => body.classList.remove("show-bar"), 1800);
    });

    // Clic sobre la diapositiva (fuera de ligas y botones) avanza en modo presentación
    stage.addEventListener("click", (e) => {
      if (!presenting()) return;
      if (e.target.closest("a,button,input,textarea,select,label,.t,.tip-pop")) return;
      next();
    });

    // ¿Está la presentación a la vista? (para no secuestrar las flechas del resto de la página)
    let inView = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => { inView = ents[0].isIntersecting; }, { threshold: 0.45 })
        .observe(stage);
    }

    document.addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (presenting()) {
        if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].includes(k)) { e.preventDefault(); next(); }
        else if (["ArrowLeft", "PageUp", "Backspace", "ArrowUp"].includes(k)) { e.preventDefault(); prev(); }
        else if (k === "Home") show(0);
        else if (k === "End") show(N - 1);
        else if (k === "Escape") present(false);
        else if (k === "t" || k === "T") body.classList.toggle("show-clock");
        return;
      }
      if (!inView) return;
      if (k === "ArrowRight") { e.preventDefault(); next(); }
      else if (k === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (k === "f" || k === "F") present(true);
    });

    // Deslizar con el dedo
    let x0 = null, y0 = null;
    stage.addEventListener("touchstart", (e) => {
      // dentro de la red, la tabla o la gráfica el dedo desplaza la figura, no la diapositiva
      if (e.target.closest(".net-frame,.tablebox,.chart")) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next : prev)();
      x0 = y0 = null;
    }, { passive: true });

    // Arranque: #d5 abre la diapositiva 5; ?presentar=1 entra en modo presentación
    const m = location.hash.match(/^#d(\d+)$/);
    show(m ? Number(m[1]) - 1 : 0);
    if (params.has("presentar")) present(true);
    if (params.has("todo")) $$("[data-frag]").forEach((f) => f.classList.add("is-on"));

    if (isPdf) {
      const st = document.createElement("style");
      st.textContent = "@page{size:1280px 720px;margin:0}";
      document.head.appendChild(st);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Ejercicio 1 · ficha de un socio comercial
     ══════════════════════════════════════════════════════════════════════ */
  const form = $("#fichaForm");
  if (form) {
    const TIPAT = "TIPAT (2018) · capítulo laboral: sí, cap. 19";
    const UE = "TLCUEM (2000), modernizado en 2026 · capítulo laboral: en el acuerdo modernizado";
    const AELC = "TLC México-AELC (2001) · capítulo laboral: no";
    const CA = "TLC único México-Centroamérica (2013) · capítulo laboral: no";
    const GRUPOS = [
      ["América del Norte", { "Canadá": ["T-MEC (2020; antes TLCAN, 1994) y TIPAT (2018) · capítulo laboral: sí", "Bamber, cap. 4"] }],
      ["Unión Europea", Object.fromEntries([
        ["Austria", "SLC, cap. 5"], ["Bélgica", "SLC, cap. 5"], ["Bulgaria"], ["Chipre"], ["Croacia"],
        ["Dinamarca", "SLC, cap. 4"], ["Eslovaquia"], ["Eslovenia"], ["Estonia"], ["Finlandia", "SLC, cap. 4"],
        ["Francia", "Bamber, cap. 7 · SLC, cap. 3"], ["Grecia", "SLC, cap. 3"], ["Hungría"], ["Irlanda", "SLC, cap. 6"],
        ["Italia", "Bamber, cap. 6 · SLC, cap. 3"], ["Letonia"], ["Lituania"], ["Luxemburgo"], ["Malta"],
        ["Países Bajos", "SLC, cap. 5"], ["Polonia"], ["Portugal", "SLC, cap. 3"], ["República Checa"], ["Rumania"],
        ["Suecia", "Bamber, cap. 9 · SLC, cap. 4"],
      ].map(([n, lib]) => [n, [UE, lib]]))],
      ["Asociación Europea de Libre Comercio", {
        "Islandia": [AELC, "SLC, cap. 4"], "Liechtenstein": [AELC], "Noruega": [AELC, "SLC, cap. 4"], "Suiza": [AELC],
      }],
      ["Reino Unido", { "Reino Unido": ["Acuerdo de Continuidad Comercial (2021) y TIPAT (2026) · capítulo laboral: sí, por el TIPAT", "Bamber, cap. 2 · SLC, cap. 6"] }],
      ["Asia-Pacífico (TIPAT)", Object.fromEntries([
        ["Australia", "Bamber, cap. 5"], ["Brunéi"], ["Malasia"], ["Nueva Zelandia"], ["Singapur"], ["Vietnam"],
      ].map(([n, lib]) => [n, [TIPAT, lib]]))],
      ["América Latina", {
        "Chile": ["TLC (1999), Alianza del Pacífico (2016) y TIPAT (2018) · capítulo laboral: sí, por el TIPAT"],
        "Colombia": ["TLC (1995) y Alianza del Pacífico (2016) · capítulo laboral: no"],
        "Costa Rica": [CA], "El Salvador": [CA], "Guatemala": [CA], "Honduras": [CA], "Nicaragua": [CA],
        "Panamá": ["TLC (2015) · capítulo laboral: no"],
        "Perú": ["Acuerdo de Integración Comercial (2012), Alianza del Pacífico (2016) y TIPAT (2018) · capítulo laboral: sí, por el TIPAT"],
        "Uruguay": ["TLC (2004) · capítulo laboral: no"],
      }],
      ["Medio Oriente", { "Israel": ["TLC (2000) · capítulo laboral: no"] }],
      ["Acuerdos parciales (ALADI)", {
        "Argentina": ["ACE 6 y ACE 55, de alcance parcial · capítulo laboral: no", "SLC, cap. 7"],
        "Brasil": ["ACE 53 y ACE 55, de alcance parcial · capítulo laboral: no", "SLC, cap. 7"],
        "Bolivia": ["ACE 66, de alcance parcial · capítulo laboral: no"],
        "Cuba": ["ACE 51, de alcance parcial · capítulo laboral: no"],
        "Ecuador": ["AAP 29, de alcance parcial · capítulo laboral: no"],
        "Paraguay": ["AAP.R 38, de alcance parcial · capítulo laboral: no"],
      }],
    ];
    const INFO = {};
    const sel = $("#fPais");
    GRUPOS.forEach(([grupo, paises]) => {
      const og = document.createElement("optgroup");
      og.label = grupo;
      Object.entries(paises).forEach(([n, info]) => {
        INFO[n] = info;
        const o = document.createElement("option");
        o.value = o.textContent = n;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });

    const KEY = "global-cp-ficha";
    const card = {
      pais: $("#cPais"), deal: $("#cDeal"), afil: $("#cAfil"), cob: $("#cCob"),
      q1: $("#cQ1"), q2: $("#cQ2"), q3: $("#cQ3"), q4: $("#cQ4"), dif: $("#cDif"), conv: $("#cConv"), nombre: $("#cNombre"),
    };
    const dealOut = $("#fDeal");
    const savedOut = $("#fSaved");

    const read = () => Object.fromEntries(new FormData(form).entries());
    const pct = (v, y) => (v ? `${v.replace(",", ".")} %${y ? ` (${y})` : ""}` : "—");

    function render(d) {
      const info = INFO[d.pais];
      card.pais.textContent = d.pais || "País";
      card.deal.textContent = info ? `Acuerdo con México: ${info[0]}` : "Acuerdo con México";
      dealOut.innerHTML = info
        ? `<b>Acuerdo con México:</b> ${info[0]}${info[1] ? ` · <b>En el curso:</b> ${info[1]}` : ""}`
        : "";
      card.afil.textContent = pct(d.afil, d.afilY);
      card.cob.textContent = pct(d.cob, d.cobY);
      ["q1", "q2", "q3", "q4", "dif"].forEach((k) => { card[k].textContent = (d[k] || "").trim() || "—"; });
      card.conv.textContent = d.conv ? `${d.conv[0].toUpperCase()}${d.conv.slice(1)}${d.porque ? `. ${d.porque.trim()}` : ""}` : "—";
      card.nombre.textContent = (d.nombre || "").trim() || "Tu nombre";
      if (info) { usedIn.delete(dealOut); annotate(dealOut); }
    }

    function load() {
      let d = {};
      try { d = JSON.parse(store.get(KEY) || "{}"); } catch { d = {}; }
      Object.entries(d).forEach(([k, v]) => {
        const el = form.elements[k];
        if (!el) return;
        if (el instanceof RadioNodeList) { $$(`[name="${k}"]`, form).forEach((r) => { r.checked = r.value === v; }); }
        else el.value = v;
      });
      render(read());
    }

    let saveTimer;
    form.addEventListener("input", () => {
      const d = read();
      render(d);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        store.set(KEY, JSON.stringify(d));
        savedOut.textContent = "Guardado en este dispositivo ✓";
      }, 400);
    });

    function asText(d) {
      const info = INFO[d.pais];
      return [
        `FICHA · SISTEMA DE EMPLEO`,
        `País: ${d.pais || "—"}`,
        `Acuerdo con México: ${info ? info[0] : "—"}`,
        `Afiliación sindical: ${pct(d.afil, d.afilY)}`,
        `Cobertura de la negociación colectiva: ${pct(d.cob, d.cobY)}`,
        ``,
        `1. ¿Cómo se negocia? ${d.q1 || "—"}`,
        `2. ¿Cómo se organizan los trabajadores? ${d.q2 || "—"}`,
        `3. ¿Cómo se organizan los empleadores? ${d.q3 || "—"}`,
        `4. ¿Qué papel juega el Estado? ${d.q4 || "—"}`,
        ``,
        `Una diferencia con México: ${d.dif || "—"}`,
        `Frente a México, este sistema: ${d.conv || "—"}. ${d.porque || ""}`,
        ``,
        `${d.nombre || ""} · Globalización y Empleo · FCA UNAM`,
      ].join("\n");
    }

    $("#fCopy")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(asText(read())); say("Ficha copiada ✓"); }
      catch { say("No se pudo copiar"); }
    });
    // El correo sale con la ficha escrita en el cuerpo
    const mail = $("#fMail");
    mail?.addEventListener("click", () => {
      const d = read();
      const asunto = `Tarea · Clase prueba · Ficha de ${d.pais || "un socio comercial"}${d.nombre ? ` · ${d.nombre}` : ""}`;
      mail.href = `mailto:semsocan2019@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(asText(d))}`;
    });
    $("#fPrint")?.addEventListener("click", () => {
      body.classList.add("print-ficha");
      window.print();
    });
    window.addEventListener("afterprint", () => body.classList.remove("print-ficha"));
    $("#fReset")?.addEventListener("click", () => {
      if (!confirm("¿Borrar todo lo que escribiste en la ficha?")) return;
      form.reset();
      store.del(KEY);
      savedOut.textContent = "";
      render(read());
    });

    load();
  }

  /* ── Tarjetas que se voltean ────────────────────────────────────────── */
  $$(".flip").forEach((b) => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  }));
})();
