// Minimal Markdown renderer (headings, lists, bold/italic, code, links, images,
// blockquotes, tables, horizontal rules). No dependencies, works offline.
(function () {
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function safeUrl(u) {
    u = u.trim();
    return /^(https?:|mailto:|#|\.{0,2}\/|[\w-])/i.test(u) && !/^javascript:/i.test(u) ? u : "#";
  }

  function inline(s, base) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = esc(s);
    const resolve = (u) => (base && !/^([a-z]+:|#|\/)/i.test(u) ? base + u : u);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${esc(resolve(safeUrl(src)))}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
      const h = resolve(safeUrl(href));
      const ext = /^https?:/i.test(h) ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${esc(h)}"${ext}>${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>").replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
    return s;
  }

  function render(src, base) {
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    let out = "", i = 0;
    const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim(), base));

    while (i < lines.length) {
      let line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      if (/^```/.test(line)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out += `<pre><code>${esc(buf.join("\n"))}</code></pre>`;
        continue;
      }
      let m;
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        const n = m[1].length;
        out += `<h${n}>${inline(m[2], base)}</h${n}>`; i++; continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += "<hr>"; i++; continue; }
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        out += `<blockquote>${render(buf.join("\n"), base)}</blockquote>`;
        continue;
      }
      if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = cells(line); i += 2;
        let t = "<table><thead><tr>" + head.map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
        while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
          t += "<tr>" + cells(lines[i]).map((c) => `<td>${c}</td>`).join("") + "</tr>"; i++;
        }
        out += t + "</tbody></table>";
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d/.test(line);
        const tag = ordered ? "ol" : "ul";
        let html = `<${tag}>`;
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""); i++;
          const sub = [];
          while (i < lines.length && /^\s{2,}\S/.test(lines[i])) sub.push(lines[i++].replace(/^\s{2,4}/, ""));
          html += `<li>${inline(item, base)}${sub.length ? render(sub.join("\n"), base) : ""}</li>`;
        }
        out += html + `</${tag}>`;
        continue;
      }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) buf.push(lines[i++]);
      out += `<p>${inline(buf.join(" "), base)}</p>`;
    }
    return out;
  }

  window.Markdown = { render };
})();
