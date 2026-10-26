/* ==========================================================================
   Globalización y Empleo · Clase prueba didáctica
   Tema, QR, presentación (teclado, clicker, deslizamiento, pantalla completa),
   fotos y portadas ampliables, tabla que se desplaza con el clicker, metáforas animadas,
   nube de palabras para la discusión, ficha del ejercicio 1 y tarjetas de
   palabras clave. Sin dependencias.
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
  const SCOPE = ".slide-in, .hero-in, .section-head, .task, .vcard, .biblio li, .nw, #fDeal";
  const SKIP = "a, button, label, select, option, textarea, input, script, style, svg, h1, h2, .t, .kicker, .s-kicker, .s-agenda, .s-foot, .vtag, .check-tag, .tip-pop, .ficha-card";
  const BLOCK = ".slide, .hero, .section-head, .task, .vcard, .biblio li, .nw li, #fDeal";
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
  // La definición se abre solo con clic, toque o Enter; pasar el ratón no la abre
  let tipEl = null;

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
  function openTip(el) {
    const g = GLOS[el.dataset.t];
    if (!g) return;
    if (tipEl && tipEl !== el) tipEl.setAttribute("aria-expanded", "false");
    tipEl = el;
    const im = g[3];
    pop.innerHTML = `<p class="tip-name">${esc(g[0])}</p>${g[2] ? `<p class="tip-orig">${esc(g[2])}</p>` : ""}${g[1] ? `<p class="tip-def">${esc(g[1])}</p>` : ""}`
      + (im ? `<button class="ph tip-img" type="button" data-lb="${im[0]}" data-cap="${esc(im[1]).replace(/"/g, "&quot;")}" data-credit="${esc(im[2]).replace(/"/g, "&quot;")}"><img src="${im[0]}" alt=""></button><p class="tip-credit">${esc(im[2])}</p>` : "");
    pop.classList.add("is-pinned");
    pop.hidden = false;
    placeTip(el);
    // la foto cambia el alto del recuadro: se recoloca cuando termina de cargar
    pop.querySelector("img")?.addEventListener("load", () => { if (tipEl === el) placeTip(el); }, { once: true });
    el.setAttribute("aria-expanded", "true");
  }
  function closeTip() {
    pop.hidden = true;
    if (tipEl) tipEl.setAttribute("aria-expanded", "false");
    tipEl = null;
  }
  const tipOpen = () => !pop.hidden;

  // Con una definición abierta, el primer clic fuera de ella solo la cierra: no avanza la
  // diapositiva, no sigue ligas ni abre fotos. Un clic en otro término cambia de definición.
  document.addEventListener("click", (e) => {
    if (!tipOpen() || e.target.closest?.(".tip-pop, .t")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeTip();
  }, true);

  // Clic o toque: abre la definición; otro clic en el término o fuera la cierra
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.(".t");
    if (el) {
      e.preventDefault();
      if (tipEl === el) closeTip();
      else openTip(el);
      return;
    }
    if (tipOpen() && !e.target.closest?.(".tip-pop")) closeTip();
  });
  // Teclado: Enter o espacio abren la definición; Esc la cierra (antes que nada más)
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
      if (tipEl === el) closeTip();
      else openTip(el);
    }
  }, true);
  addEventListener("scroll", () => { if (tipOpen()) placeTip(tipEl); }, true);
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
    const SUBS = ["La red", "El sistema", "La globalización", "Los casos", "Comercio y trabajo", "Cierre"];

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
      $$("[data-scroll]", slides[cur]).forEach((sc) => { sc.scrollTop = 0; sc.dataset.goal = "0"; checkScroll(sc); });
      document.dispatchEvent(new CustomEvent("cp:slide", { detail: { slide: slides[cur] } }));
    }

    // Tabla que no cabe: el aviso desaparece al llegar abajo
    function checkScroll(sc) {
      const end = sc.scrollHeight - Math.max(sc.scrollTop, Number(sc.dataset.goal || 0)) - sc.clientHeight < 6;
      sc.closest(".tablewrap")?.classList.toggle("is-end", end);
    }
    $$("[data-scroll]").forEach((sc) => sc.addEventListener("scroll", () => checkScroll(sc), { passive: true }));
    addEventListener("resize", () => $$("[data-scroll]", slides[cur]).forEach(checkScroll));

    const pending = () => $$("[data-frag]", slides[cur]).filter((f) => !f.classList.contains("is-on"));
    function next() {
      // una tabla larga se recorre primero; el destino se recuerda por si el clic llega
      // antes de que termine el desplazamiento suave
      const sc = $("[data-scroll]", slides[cur]);
      if (sc) {
        const max = sc.scrollHeight - sc.clientHeight;
        const from = Math.max(sc.scrollTop, Number(sc.dataset.goal || 0));
        if (max - from > 6) {
          const goal = Math.min(max, from + Math.max(80, sc.clientHeight * 0.7));
          sc.dataset.goal = String(goal);
          sc.scrollTo({ top: goal, behavior: "smooth" });
          checkScroll(sc);
          return;
        }
      }
      const p = pending();
      if (p.length) { p[0].classList.add("is-on"); return; }
      if (cur < N - 1) show(cur + 1);
    }
    function prev() { if (cur > 0) show(cur - 1); }
    // si la persona desplaza la tabla con el dedo o la rueda, manda su posición
    $$("[data-scroll]").forEach((sc) => sc.addEventListener("wheel", () => { sc.dataset.goal = "0"; }, { passive: true }));
    $$("[data-scroll]").forEach((sc) => sc.addEventListener("touchstart", () => { sc.dataset.goal = "0"; }, { passive: true }));

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
      if (e.target.closest("a,button,input,textarea,select,label,.t,.tip-pop,[data-scroll]")) return;
      next();
    });

    // ¿Está la presentación a la vista? (para no secuestrar las flechas del resto de la página)
    let inView = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => { inView = ents[0].isIntersecting; }, { threshold: 0.45 })
        .observe(stage);
    }

    const NEXT = ["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"];
    const PREV = ["ArrowLeft", "PageUp", "Backspace", "ArrowUp"];
    document.addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      // con una foto, las portadas o una definición abiertas, el clicker primero las cierra
      const dlg = $("dialog[open]");
      if (dlg) {
        if (NEXT.includes(k) || PREV.includes(k)) { e.preventDefault(); dlg.close(); }
        return;
      }
      if (tipOpen() && (NEXT.includes(k) || PREV.includes(k))) { e.preventDefault(); closeTip(); return; }
      if (presenting()) {
        if (NEXT.includes(k)) { e.preventDefault(); next(); }
        else if (PREV.includes(k)) { e.preventDefault(); prev(); }
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
        `Densidad sindical: ${pct(d.afil, d.afilY)}`,
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


  /* ══════════════════════════════════════════════════════════════════════
     Fotos ampliables: cualquier [data-lb] abre el visor
     ══════════════════════════════════════════════════════════════════════ */
  const lb = $("#lightbox");
  if (lb) {
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-lb]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      $("#lbImg").src = b.dataset.lb;
      $("#lbImg").alt = b.dataset.cap || "";
      $("#lbCap").textContent = b.dataset.cap || "";
      $("#lbCredit").textContent = b.dataset.credit || "";
      closeTip();
      lb.showModal();
    }, true);
    lb.addEventListener("click", () => lb.close());
  }

  /* ── Los dos libros en grande: cualquier portada con [data-books] ─────── */
  const booksModal = $("#booksModal");
  if (booksModal) {
    document.addEventListener("click", (e) => {
      if (!e.target.closest?.("[data-books]")) return;
      e.preventDefault();
      e.stopPropagation();
      closeTip();
      booksModal.showModal();
    }, true);
    booksModal.addEventListener("click", () => booksModal.close());
  }

  /* ══════════════════════════════════════════════════════════════════════
     Enfoque integrado: la onda pasa por los amortiguadores (SVG + JS)
     ══════════════════════════════════════════════════════════════════════ */
  const buf = $("#artBuffer");
  if (buf) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || isPdf;
    const waves = $$(".ab-in, .ab-out", buf).map((el) => ({
      el, y: +el.dataset.y, a: +el.dataset.a, x0: +el.dataset.x0, x1: +el.dataset.x1,
    }));
    const springs = $$(".ab-spring", buf).map((el) => ({ el, k: +el.dataset.k }));
    const K = 0.115, XS = 118;
    function draw(t) {
      const ph = t * 0.0042;
      waves.forEach(({ el, y, a, x0, x1 }) => {
        let d = "";
        for (let x = x0; x <= x1; x += 3) d += `${d ? "L" : "M"}${x} ${(y + a * Math.sin(K * x - ph)).toFixed(1)}`;
        el.setAttribute("d", d);
      });
      const v = Math.sin(K * XS - ph);
      springs.forEach(({ el, k }) => { el.style.transform = `scaleY(${(1 - 0.22 * k * v).toFixed(3)})`; });
    }
    draw(0);
    if (!calm) {
      const slide = buf.closest(".slide");
      let raf = null, seen = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => { seen = es[0].isIntersecting; loop(); }).observe(buf);
      }
      const loop = () => {
        const on = slide.classList.contains("is-active") && seen && !document.hidden;
        if (on && !raf) {
          const step = (t) => { draw(t); raf = requestAnimationFrame(step); };
          raf = requestAnimationFrame(step);
        } else if (!on && raf) { cancelAnimationFrame(raf); raf = null; }
      };
      document.addEventListener("cp:slide", loop);
      document.addEventListener("visibilitychange", loop);
      loop();
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Para discutir: nube de palabras → temas → preguntas
     ══════════════════════════════════════════════════════════════════════ */
  const cloud = $("#cloud");
  if (cloud) {
    const TEMAS = [
      { t: "Convergencia y divergencia", c: "var(--cobalt)",
        w: ["convergencia", "divergencia", "refracción", "amortiguador", "enfoque integrado", "carrera hacia el abismo (race to the bottom)", "instituciones"],
        q: ["Si la densidad sindical se parece en los cinco países, ¿por qué no decimos simplemente que sus sistemas de empleo convergen?",
          "¿Qué institución mexicana amortigua —o no— la presión del T-MEC sobre los salarios?",
          "¿Hay una «carrera hacia el abismo» (<i lang=\"en\">race to the bottom</i>) entre México y Estados Unidos? ¿Qué dato de la clase la confirma o la desmiente?"] },
      { t: "La OIT y los tratados", c: "var(--guinda)",
        w: ["OIT", "Declaración de 1998", "capítulo laboral", "Mecanismo de Respuesta Rápida", "sanción", "anexo 23-A", "Convenio 98", "GM Silao"],
        q: ["¿Por qué un tratado comercial cita la Declaración de la OIT en lugar de escribir sus propias reglas laborales?",
          "El T-MEC puede sancionar a una fábrica; el acuerdo con la UE, no. ¿Cuál de los dos cambiará más el sistema de empleo mexicano?",
          "Cuando el Mecanismo de Respuesta Rápida revisa una planta en Coahuila, ¿a quién protege: a los trabajadores mexicanos, a los estadounidenses o a ambos?"] },
      { t: "Actores y reglas", c: "var(--teal)",
        w: ["sindicato de empresa", "sindicato de rama", "patronal", "comité de empresa", "eficacia general", "densidad sindical", "cobertura", "Estado"],
        q: ["¿Qué actor del sistema de empleo mexicano cambió más desde 2019: los sindicatos, los empleadores o el Estado?",
          "¿Podría México tener una cobertura alta sin una regla de eficacia general como la española?",
          "¿Por qué en Estados Unidos no hay una patronal nacional que negocie con los sindicatos?"] },
      { t: "Informalidad y jornada", c: "var(--amber)",
        w: ["informalidad", "desempleo", "seguro de desempleo", "40 horas", "salario mínimo", "plataformas digitales", "ofensiva de primavera"],
        q: ["¿Por qué México tiene un desempleo tan bajo como Japón y una informalidad casi quince veces mayor que la de España?",
          "¿Llegará la jornada de 40 horas a quienes trabajan en la informalidad?",
          "Japón sube salarios con el shuntō; México, con el salario mínimo. ¿Qué dice eso del papel del Estado en cada país?"] },
      { t: "Sistema-mundo y asimetrías", c: "var(--plum)",
        w: ["centro", "semiperiferia", "periferia", "asimetría", "nearshoring", "cadenas de suministro", "aranceles", "China"],
        q: ["¿Qué lugar ocupa México en el sistema-mundo laboral: centro, semiperiferia o periferia? ¿Con qué dato lo sostendrías?",
          "¿Las reglas laborales del T-MEC reducen o reproducen la asimetría entre México y Estados Unidos?",
          "¿Por qué China y Corea del Sur, fuera de la red de tratados, importan para entender el empleo en México?",
          "Con el nearshoring llegan fábricas extranjeras; ¿llegan también los sistemas de empleo de sus países de origen?"] },
    ];
    const stage = $("#cloudStage");
    const btnGroup = $("#cloudGroup");
    const btnReset = $("#cloudReset");
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // palabras: tamaño según su peso en la clase (las primeras de cada tema pesan más)
    const words = [];
    TEMAS.forEach((tm, ti) => tm.w.forEach((w, wi) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cw";
      b.textContent = w;
      b.style.setProperty("--c", tm.c);
      b.dataset.topic = ti;
      b.dataset.size = String(Math.max(1.05, 2.15 - wi * 0.17 + ((w.length * 7 + ti * 3) % 5) * 0.06));
      words.push(b);
    }));
    // mezcla estable, para que las palabras de un tema no salgan juntas
    const N = words.length;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const mult = [17, 19, 23, 29, 31, 13, 11].find((m) => gcd(m, N) === 1 && m % N > 1 && m % N < N - 1) || 1;
    const order = words.map((b, i) => [((i * mult + 7) % N), b]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

    function layoutCloud() {
      cloud.dataset.state = "cloud";
      stage.innerHTML = "";
      const W = stage.clientWidth;
      // en pantallas angostas (celular en vertical) la nube va en renglones centrados;
      // en las anchas, en espiral
      const narrow = W < 560;
      stage.classList.toggle("is-flow", narrow);
      const k = narrow ? 0.62 : Math.min(1, 0.45 + W / 1800);
      order.forEach((b) => {
        b.style.left = b.style.top = b.style.maxWidth = b.style.whiteSpace = "";
        b.style.transform = "";
        b.style.fontSize = `${Math.max(narrow ? 0.95 : 1, b.dataset.size * k).toFixed(2)}rem`;
        stage.appendChild(b);
      });
      if (!narrow) {
        const placed = [];
        const cx = W / 2;
        const stretch = Math.min(1.9, Math.max(1.1, W / 480));
        let maxY = 0;
        order.forEach((b, i) => {
          // una palabra más ancha que el escenario se parte en dos renglones
          if (b.offsetWidth > W - 12) { b.style.whiteSpace = "normal"; b.style.maxWidth = `${W - 12}px`; }
          const w = b.offsetWidth, h = b.offsetHeight;
          let ang = i * 0.9, r = 0, x, y, ok = false;
          for (let n = 0; n < 2600 && !ok; n++) {
            x = cx + r * Math.cos(ang) * stretch - w / 2;
            y = r * Math.sin(ang) - h / 2;
            ok = x >= 0 && x + w <= W &&
              placed.every((q) => x + w + 6 < q.x || q.x + q.w + 6 < x || y + h + 2 < q.y || q.y + q.h + 2 < y);
            ang += 0.35; r += 0.8;
          }
          if (!ok) { x = Math.max(0, (W - w) / 2); y = maxY + 6; }   // respaldo: al final, centrada
          placed.push({ x, y, w, h });
          maxY = Math.max(maxY, y + h);
        });
        // la nube empieza arriba del escenario, sin huecos
        const minY = Math.min(...placed.map((q) => q.y));
        order.forEach((b, i) => {
          b.style.left = `${placed[i].x}px`;
          b.style.top = `${placed[i].y - minY + 8}px`;
        });
        stage.style.height = `${maxY - minY + 24}px`;
      } else {
        stage.style.height = "auto";
      }
      btnGroup.hidden = false;
      btnReset.hidden = true;
    }

    // FLIP: se mide antes y después de mover las palabras, y se anima la diferencia
    function flip(mutate) {
      const first = new Map(words.map((b) => [b, b.getBoundingClientRect()]));
      mutate();
      if (calm) return;
      words.forEach((b) => {
        const a = first.get(b), z = b.getBoundingClientRect();
        b.style.transition = "none";
        b.style.transform = `translate(${a.left - z.left}px, ${a.top - z.top}px)`;
      });
      stage.getBoundingClientRect();
      words.forEach((b, i) => {
        b.style.transition = `transform .75s cubic-bezier(.2,.8,.2,1) ${(i % 9) * 18}ms, background .2s`;
        b.style.transform = "";
      });
    }

    function group(openTopic) {
      if (cloud.dataset.state === "topics") { toggle(openTopic); return; }
      flip(() => {
        cloud.dataset.state = "topics";
        const grid = document.createElement("div");
        grid.className = "ctopics";
        TEMAS.forEach((tm, ti) => {
          const box = document.createElement("section");
          box.className = "ctopic";
          box.style.setProperty("--c", tm.c);
          box.dataset.topic = ti;
          box.innerHTML = `<button class="ct-h" type="button" aria-expanded="false"><b>${tm.t}</b><small>preguntas ▾</small></button><div class="ct-words"></div><ol class="ct-q" hidden>${tm.q.map((q) => `<li>${q}</li>`).join("")}</ol>`;
          grid.appendChild(box);
        });
        stage.innerHTML = "";
        stage.classList.remove("is-flow");
        stage.appendChild(grid);
        words.forEach((b) => {
          b.style.left = b.style.top = b.style.maxWidth = b.style.whiteSpace = "";
          $(".ct-words", grid.children[b.dataset.topic]).appendChild(b);
        });
        stage.style.height = "auto";
      });
      btnGroup.hidden = true;
      btnReset.hidden = false;
    }

    function toggle(ti) {
      if (ti === undefined) return;
      const box = stage.querySelector(`.ctopic[data-topic="${ti}"]`);
      if (!box) return;
      const q = $(".ct-q", box), h = $(".ct-h", box);
      const open = q.hidden;
      q.hidden = !open;
      box.classList.toggle("is-open", open);
      h.setAttribute("aria-expanded", String(open));
      $("small", h).textContent = open ? "cerrar ▴" : "preguntas ▾";
    }

    stage.addEventListener("click", (e) => {
      const w = e.target.closest(".cw");
      const h = e.target.closest(".ct-h");
      if (h) { toggle(h.closest(".ctopic").dataset.topic); return; }
      if (w) group(w.dataset.topic);
    });
    btnGroup.addEventListener("click", () => group());
    btnReset.addEventListener("click", () => flip(layoutCloud));

    layoutCloud();
    let rw = stage.clientWidth;
    addEventListener("resize", () => {
      if (cloud.dataset.state === "cloud" && Math.abs(stage.clientWidth - rw) > 40) { rw = stage.clientWidth; layoutCloud(); }
    });
    document.fonts?.ready.then(() => { if (cloud.dataset.state === "cloud") layoutCloud(); });
  }

  /* ── Tarjetas que se voltean ────────────────────────────────────────── */
  $$(".flip").forEach((b) => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  }));
})();
