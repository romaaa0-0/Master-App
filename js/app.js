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
  let cleanup = null; // set by a section that needs teardown (e.g. stop audio)

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
        const out = renderer ? await renderer(sections[idx], base, { lecture: lec, className: cMeta.title }) : `<div class="empty">Unknown section type “${esc(sections[idx].type)}”.</div>`;
        // A renderer returns an HTML string, or { html, mount } when it needs
        // to wire up behaviour (mount may return a cleanup function).
        el.innerHTML = typeof out === "string" ? out : out.html;
        if (out && out.mount) cleanup = out.mount(el) || null;
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
      // Optional "empty": message shown when there are no files yet.
      if (!items.length) return `<div class="empty">${esc(section.empty || "No files.")}</div>`;
      return `<div class="list with-icons">` + items.map((f) => {
        const href = /^https?:/i.test(f.file) ? f.file : base + f.file;
        const ext = (f.file.split(".").pop() || "").toUpperCase().slice(0, 4);
        return `<a class="row" href="${esc(href)}" target="_blank" rel="noopener" style="--row-color:#ff453a">
          <span class="icon" style="font-size:10px">${esc(ext)}</span>
          <span class="body"><div class="title">${esc(f.name || f.file)}</div></span>${chevron}</a>`;
      }).join("") + `</div>`;
    },
    // { "type": "podcast", "title": "Podcast", "audio": "lectures/01/podcast.mp3",
    //   "transcript": "lectures/01/podcast.json" }   (transcript optional)
    // Transcript JSON: { hosts: ["Maya","Leo"], duration, lines: [{ speaker, start, text }] }
    // Made by tools/podcast/generate.py.
    async podcast(section, base, ctx) {
      const src = base + section.audio;
      const tr = section.transcript ? await getJSON(base + section.transcript).catch(() => null) : null;
      const lines = (tr && tr.lines) || [];
      const hosts = (tr && tr.hosts) || [];
      const posKey = "pos:" + src;
      const html = `
        <div class="card player">
          <div class="pod-art" aria-hidden="true">🎙️</div>
          <div class="pod-title">${esc(ctx.lecture.title)}</div>
          <div class="pod-hosts">${esc(hosts.length ? "With " + hosts.join(" & ") : ctx.className)}</div>
          <input class="pod-seek" type="range" min="0" max="${tr?.duration || 100}" step="0.1" value="0" aria-label="Seek">
          <div class="pod-times"><span class="pod-cur">0:00</span><span class="pod-left">-${fmtTime(tr?.duration)}</span></div>
          <div class="pod-controls">
            <button class="pod-speed" aria-label="Playback speed">1×</button>
            <button class="pod-back" aria-label="Back 15 seconds">${skipIcon(15, false)}</button>
            <button class="pod-play" aria-label="Play">${ICON_PLAY}</button>
            <button class="pod-fwd" aria-label="Forward 30 seconds">${skipIcon(30, true)}</button>
            <span class="pod-spacer"></span>
          </div>
          <audio preload="metadata" src="${esc(src)}"></audio>
        </div>
        ${lines.length ? `<div class="section-title">Transcript</div>
        <div class="card transcript">${lines.map((l, i) => `<p class="tl" data-i="${i}" data-t="${l.start}">
          <span class="who ${hosts.indexOf(l.speaker) === 1 ? "b" : "a"}">${esc(l.speaker)}</span>${esc(l.text)}</p>`).join("")}</div>` : ""}`;

      function mount(el) {
        const $ = (s) => el.querySelector(s);
        const audio = $("audio"), seek = $(".pod-seek"), play = $(".pod-play"), speedBtn = $(".pod-speed");
        const tls = [...el.querySelectorAll(".tl")];
        let seeking = false, active = -1, follow = true, lastSave = 0;
        let speed = store.get("podcast:speed") || 1;
        const saved = store.get(posKey);

        const setSpeed = (v) => { speed = v; audio.playbackRate = v; audio.defaultPlaybackRate = v; speedBtn.textContent = `${v}×`; store.set("podcast:speed", v); };
        setSpeed(speed);
        const dur = () => (isFinite(audio.duration) && audio.duration) || tr?.duration || 0;
        const paint = (t) => {
          if (!seeking) seek.value = t;
          seek.style.setProperty("--p", `${(t / (dur() || 1)) * 100}%`);
          $(".pod-cur").textContent = fmtTime(t);
          $(".pod-left").textContent = "-" + fmtTime(dur() - t);
          // highlight the line being spoken
          let i = active;
          if (tls.length) {
            i = lines.findIndex((l, k) => t >= l.start && (k === lines.length - 1 || t < lines[k + 1].start));
            if (i !== active) {
              tls[active]?.classList.remove("on");
              tls[i]?.classList.add("on");
              if (i >= 0 && follow && !audio.paused) tls[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
              active = i;
            }
          }
        };
        audio.addEventListener("loadedmetadata", () => {
          seek.max = audio.duration;
          if (saved && saved < audio.duration - 5) audio.currentTime = saved;
          paint(audio.currentTime);
        });
        audio.addEventListener("timeupdate", () => {
          paint(audio.currentTime);
          if (Math.abs(audio.currentTime - lastSave) > 3) { lastSave = audio.currentTime; store.set(posKey, audio.currentTime); }
        });
        audio.addEventListener("play", () => { play.innerHTML = ICON_PAUSE; play.setAttribute("aria-label", "Pause"); audio.playbackRate = speed; });
        audio.addEventListener("pause", () => { play.innerHTML = ICON_PLAY; play.setAttribute("aria-label", "Play"); store.set(posKey, audio.currentTime); });
        audio.addEventListener("ended", () => store.set(posKey, 0));
        audio.addEventListener("error", () => { $(".pod-hosts").innerHTML = '<span class="error">Could not load the audio. Check your connection.</span>'; });

        play.onclick = () => (audio.paused ? audio.play() : audio.pause());
        $(".pod-back").onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 15); };
        $(".pod-fwd").onclick = () => { audio.currentTime = Math.min(dur(), audio.currentTime + 30); };
        speedBtn.onclick = () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
        seek.addEventListener("input", () => { seeking = true; paint(+seek.value); });
        seek.addEventListener("change", () => { audio.currentTime = +seek.value; seeking = false; });
        if (saved) paint(saved);

        // tap a transcript line to jump there
        el.addEventListener("click", (e) => {
          const p = e.target.closest(".tl");
          if (!p) return;
          audio.currentTime = +p.dataset.t;
          follow = true;
          if (audio.paused) audio.play();
        });
        // stop auto-scrolling when the user scrolls the page themselves
        const stopFollow = () => { follow = false; clearTimeout(stopFollow.t); stopFollow.t = setTimeout(() => (follow = true), 6000); };
        window.addEventListener("touchmove", stopFollow, { passive: true });
        window.addEventListener("wheel", stopFollow, { passive: true });

        // lock screen / Control Center controls
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: ctx.lecture.title, artist: hosts.join(" & ") || "Podcast", album: ctx.className,
            artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }],
          });
          const ms = navigator.mediaSession;
          const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (_) {} };
          set("play", () => audio.play());
          set("pause", () => audio.pause());
          set("seekbackward", () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
          set("seekforward", () => { audio.currentTime = Math.min(dur(), audio.currentTime + 30); });
          set("seekto", (d) => { audio.currentTime = d.seekTime; });
        }
        return () => {
          store.set(posKey, audio.currentTime);
          audio.pause(); audio.removeAttribute("src"); audio.load();
          window.removeEventListener("touchmove", stopFollow);
          window.removeEventListener("wheel", stopFollow);
        };
      }
      return { html, mount };
    },
  };

  // ---------- podcast player ----------
  const fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = String(sec % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>';
  const skipIcon = (n, fwd) => `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="${fwd ? "M12 4a8 8 0 1 1-8 8" : "M12 4a8 8 0 1 0 8 8"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="${fwd ? "M12 1.5 15 4l-3 2.5" : "M12 1.5 9 4l3 2.5"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.6" font-size="7.5" font-weight="700" text-anchor="middle" fill="currentColor" font-family="-apple-system,sans-serif">${n}</text></svg>`;
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75];

  // ---------- router ----------
  async function route() {
    if (cleanup) { try { cleanup(); } catch (_) {} cleanup = null; }
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
