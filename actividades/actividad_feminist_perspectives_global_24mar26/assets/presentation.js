(function () {
  const deck = document.querySelector("[data-deck]");
  if (!deck) return;

  const overlay = deck;
  const slides = Array.from(deck.querySelectorAll("[data-slide]"));
  const progressFill = deck.querySelector("[data-progress-fill]");
  const counter = deck.querySelector("[data-slide-counter]");
  const prevBtn = deck.querySelector("[data-prev]");
  const nextBtn = deck.querySelector("[data-next]");
  const closeBtns = Array.from(document.querySelectorAll("[data-close-presentation]"));
  const openBtns = Array.from(document.querySelectorAll("[data-open-presentation]"));

  let current = 0;

  function sync() {
    slides.forEach((slide, index) => {
      slide.classList.toggle("active", index === current);
      slide.setAttribute("aria-hidden", index === current ? "false" : "true");
    });

    const total = slides.length || 1;
    const pct = ((current + 1) / total) * 100;

    if (progressFill) progressFill.style.width = pct + "%";
    if (counter) counter.textContent = (current + 1) + " / " + total;
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  function openDeck() {
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    sync();
  }

  function closeDeck() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function goTo(index) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    sync();
  }

  function move(step) {
    goTo(current + step);
  }

  openBtns.forEach((btn) => {
    btn.addEventListener("click", openDeck);
  });

  closeBtns.forEach((btn) => {
    btn.addEventListener("click", closeDeck);
  });

  if (prevBtn) prevBtn.addEventListener("click", () => move(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => move(1));

  document.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;

    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      move(1);
    }

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      move(-1);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDeck();
    }
  });

  if (window.location.hash === "#presentacion") {
    openDeck();
  }

  sync();
})();
