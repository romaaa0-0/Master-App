// Master's study app: a tiny hash-routed single page app.
// All course content lives in /content as JSON + Markdown files (see README.md).
(function () {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const navTitle = document.getElementById("nav-title");
  const backBtn = document.getElementById("back");
  const backLabel = document.getElementById("back-label");

  const COLORS = ["#0a84ff", "#30d158", "#ff9f0a", "#bf5af2", "#ff375f", "#64d2ff"];
  const cache = new Map();
  let lastDepth = 0;

  // ---------- data loading ----------
  async function getJSON(path) {
    if (cache.has(path)) return cache.get(path);
    const p = fetch(path, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
      return r.json();
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path));
    return p;
  }
  async function getText(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
    return r.text();
  }
  const modulesIndex = () => getJSON("content/modules.json");
  const moduleData = (m) => getJSON(`content/${m}/module.json`);
  const classData = (m, c) => getJSON(`content/${m}/${c}/class.json`);

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const chevron = '<svg class="chev" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const go = (hash) => { location.hash = hash; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function initials(title) {
    return title.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || title[0];
  }

  function setNav(title, back) {
    navTitle.textContent = title || "";
    document.title = title ? `${title} · Master's` : "Master's";
    if (back) {
      backBtn.hidden = false;
      backLabel.textContent = back.label;
      backBtn.onclick = () => go(back.hash);
    } else {
      backBtn.hidden = true;
      backBtn.onclick = null;
    }
  }

  function show(html, depth) {
    app.classList.remove("back-anim");
    void app.offsetWidth; // restart animation
    if (depth < lastDepth) app.classList.add("back-anim");
    app.style.animation = "none"; void app.offsetWidth; app.style.animation = "";
    lastDepth = depth;
    app.innerHTML = html;
    window.scrollTo(0, 0);
    onScroll();
  }

  function errorView(err) {
    show(`<h1 class="large">Oops</h1><div class="empty"><p class="error">${esc(err.message)}</p><p>Check your connection and try again.</p></div>`, 0);
  }

  // ---------- views ----------
  async function homeView() {
    setNav("", null);
    const { modules, program } = await modulesIndex();
    const tiles = modules.map((m, idx) => {
      const color = m.color || COLORS[idx % COLORS.length];
      const badge = m.status === "current" ? '<span class="badge">Current</span>'
        : m.status === "done" ? '<span class="badge done">Completed</span>' : "";
      const meta = m.status === "upcoming" ? "Coming soon" : (m.subtitle || "");
      return `<button class="tile ${m.status === "current" ? "current" : ""}" style="--tile-color:${color}" data-go="#/${esc(m.id)}">
        ${badge}
        <div class="num">${esc(m.number)}</div>
        <div><div class="name">${esc(m.title)}</div><div class="meta">${esc(meta)}</div></div>
      </button>`;
    });
    // Current module first, full width.
    const cur = modules.findIndex((m) => m.status === "current");
    if (cur > 0) tiles.unshift(tiles.splice(cur, 1)[0]);
    show(`
      <h1 class="large">${esc(program?.title || "My Master's")}</h1>
      <p class="subtitle">${esc(program?.subtitle || "Choose a module")}</p>
      <div class="grid">${tiles.join("")}</div>
      <p class="footer-note">Add to Home Screen from Safari's Share menu to use it like an app.</p>`, 0);
  }

  async function moduleView(mId) {
    const { modules } = await modulesIndex();
    const meta = modules.find((m) => m.id === mId);
    if (!meta) throw new Error("Module not found");
    setNav(meta.title, { label: "Modules", hash: "#/" });
    const data = await moduleData(mId);
    const classes = data.classes || [];
    let body;
    if (!classes.length) {
      body = `<div class="empty"><div class="big">${meta.status === "done" ? "✓" : "⏳"}</div>
        ${meta.status === "done" ? "This module is completed. No content has been added." : "Nothing here yet."}</div>`;
    } else {
      const counts = await Promise.all(classes.map((c) => classData(mId, c.id).then((d) => (d.lectures || []).length).catch(() => 0)));
      body = `<div class="section-title">Classes</div><div class="list with-icons">` +
        classes.map((c, i) => `<button class="row" data-go="#/${esc(mId)}/${esc(c.id)}" style="--row-color:${c.color || COLORS[i % COLORS.length]}">
          <span class="icon">${esc(c.icon || initials(c.title))}</span>
          <span class="body"><div class="title">${esc(c.title)}</div><div class="detail">${esc(plural(counts[i], "lecture"))}</div></span>
          ${chevron}
        </button>`).join("") + `</div>`;
    }
    show(`<h1 class="large">${esc(meta.title)}</h1>
      <p class="subtitle">${esc(meta.subtitle || (meta.status === "current" ? "Current module" : meta.status === "done" ? "Completed" : "Upcoming"))}</p>
      ${body}`, 1);
  }

  async function classView(mId, cId) {
    const [{ modules }, mod] = await Promise.all([modulesIndex(), moduleData(mId)]);
    const mMeta = modules.find((m) => m.id === mId) || { title: mId };
    const cMeta = (mod.classes || []).find((c) => c.id === cId);
    if (!cMeta) throw new Error("Class not found");
    setNav(cMeta.title, { label: mMeta.title, hash: `#/${mId}` });
    const data = await classData(mId, cId);
    const lectures = data.lectures || [];
    const body = lectures.length
      ? `<div class="section-title">Lectures</div><div class="list">` + lectures.map((l, i) => `
        <button class="row" data-go="#/${esc(mId)}/${esc(cId)}/${esc(l.id)}">
          <span class="body"><div class="title">${esc(l.title || `Lecture ${i + 1}`)}</div>
          <div class="detail">${esc([fmtDate(l.date), l.description].filter(Boolean).join(" · ") || plural((l.sections || []).length, "section"))}</div></span>
          ${chevron}
        </button>`).join("") + `</div>`
      : `<div class="empty"><div class="big">📚</div>No lectures yet. They'll appear here as they're added.</div>`;
    show(`<h1 class="large">${esc(cMeta.title)}</h1>
      <p class="subtitle">${esc(cMeta.subtitle || plural(lectures.length, "lecture"))}</p>
      ${body}`, 2);
  }

  async function lectureView(mId, cId, lId, sectionIdx) {
    const [mod, data] = await Promise.all([moduleData(mId), classData(mId, cId)]);
    const cMeta = (mod.classes || []).find((c) => c.id === cId) || { title: cId };
    const lec = (data.lectures || []).find((l) => l.id === lId);
    if (!lec) throw new Error("Lecture not found");
    setNav(lec.title, { label: cMeta.title, hash: `#/${mId}/${cId}` });
    const sections = lec.sections || [];
    const idx = Math.min(Math.max(+sectionIdx || 0, 0), Math.max(sections.length - 1, 0));
    const tabs = sections.length > 1
      ? `<div class="segmented">${sections.map((s, i) => `<button class="${i === idx ? "on" : ""}" data-go="#/${esc(mId)}/${esc(cId)}/${esc(lId)}/${i}" data-replace>${esc(s.title || s.type)}</button>`).join("")}</div>`
      : "";
    show(`<h1 class="large">${esc(lec.title)}</h1>
      <p class="subtitle">${esc([fmtDate(lec.date), lec.description].filter(Boolean).join(" · ") || cMeta.title)}</p>
      ${tabs}<div id="section">${sections.length ? '<div class="card">Loading…</div>' : '<div class="empty">No content for this lecture yet.</div>'}</div>`, 3);
    if (sections.length) {
      const el = document.getElementById("section");
      const base = `content/${mId}/${cId}/`;
      const renderer = SECTION_TYPES[sections[idx].type];
      try {
        el.innerHTML = renderer ? await renderer(sections[idx], base) : `<div class="empty">Unknown section type “${esc(sections[idx].type)}”.</div>`;
      } catch (e) {
        el.innerHTML = `<div class="empty error">${esc(e.message)}</div>`;
      }
    }
  }

  // ---------- section types ----------
  // Each lecture has a list of sections. A section's "type" picks its renderer.
  // New study tools (flashcards, quizzes, …) are added here once and then
  // work for every lecture.
  const SECTION_TYPES = {
    // { "type": "markdown", "title": "Notes", "file": "lectures/01/notes.md" }
    async markdown(section, base) {
      const fileBase = base + section.file.replace(/[^/]*$/, "");
      const md = await getText(base + section.file);
      return `<div class="card prose">${window.Markdown.render(md, fileBase)}</div>`;
    },
    // { "type": "files", "title": "Slides", "items": [{ "name": "Slides.pdf", "file": "lectures/01/slides.pdf" }] }
    async files(section, base) {
      const items = section.items || [];
      if (!items.length) return '<div class="empty">No files.</div>';
      return `<div class="list with-icons">` + items.map((f) => {
        const href = /^https?:/i.test(f.file) ? f.file : base + f.file;
        const ext = (f.file.split(".").pop() || "").toUpperCase().slice(0, 4);
        return `<a class="row" href="${esc(href)}" target="_blank" rel="noopener" style="--row-color:#ff453a">
          <span class="icon" style="font-size:10px">${esc(ext)}</span>
          <span class="body"><div class="title">${esc(f.name || f.file)}</div></span>${chevron}</a>`;
      }).join("") + `</div>`;
    },
  };

  // ---------- router ----------
  async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (parts.length === 0) await homeView();
      else if (parts.length === 1) await moduleView(parts[0]);
      else if (parts.length === 2) await classView(parts[0], parts[1]);
      else await lectureView(parts[0], parts[1], parts[2], parts[3]);
    } catch (e) {
      setNav("", { label: "Home", hash: "#/" });
      errorView(e);
    }
  }

  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]");
    if (!t) return;
    const hash = t.getAttribute("data-go");
    if (t.hasAttribute("data-replace")) {
      history.replaceState(null, "", hash);
      const y = window.scrollY;
      route().then(() => window.scrollTo(0, y));
    } else go(hash);
  });

  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 30); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
