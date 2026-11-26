# Master's study app

Romain's study app for a 2-year master's program (6 modules). It is a web app
(PWA) hosted on GitHub Pages and installed on iPhone with Safari → Share →
**Add to Home Screen**. It opens full screen and works offline.

No build step, no dependencies: plain HTML, CSS and JavaScript.

## Program

- **Module 1**: completed, shown but empty.
- **Module 2** (current), 4 classes:
  - Financial Markets and Investments in China (`financial-markets-china`)
  - Introduction to Chinese Economy (`chinese-economy`)
  - Financial Accounting (`financial-accounting`)
  - Writing in English (`writing-in-english`)
- **Modules 3 to 6**: upcoming.

## Structure

```
index.html              App shell
styles.css              iOS-style design (light and dark mode)
js/app.js               Router, views, and section types (study tools)
js/markdown.js          Small Markdown renderer
sw.js                   Service worker (offline support)
manifest.webmanifest    Home screen app settings
icons/                  App icons
content/                ALL course content lives here
  modules.json          The 6 modules: title, status (done | current | upcoming)
  module-2/
    module.json         Classes of the module
    financial-accounting/
      class.json        Lectures of the class, in order
      lectures/01/      One folder per lecture (notes.md, slides.pdf, …)
```

The code never needs to change to add content. Only files in `content/` do.

## How to add a lecture

1. Put the lecture's files in `content/<module>/<class>/lectures/<id>/`,
   for example `content/module-2/financial-accounting/lectures/01/notes.md`.
2. Add one entry to that class's `class.json`:

```json
{
  "lectures": [
    {
      "id": "01",
      "title": "Lecture 1: The Balance Sheet",
      "date": "2026-11-20",
      "description": "optional one-liner",
      "sections": [
        { "type": "markdown", "title": "Notes", "file": "lectures/01/notes.md" },
        { "type": "files", "title": "Slides", "items": [
          { "name": "Lecture slides", "file": "lectures/01/slides.pdf" }
        ]}
      ]
    }
  ]
}
```

Paths in `file` are relative to the class folder. Each section becomes a tab
on the lecture page.

## Section types (study tools)

Defined in `SECTION_TYPES` in `js/app.js`:

| type       | fields                         | shows                          |
|------------|--------------------------------|--------------------------------|
| `markdown` | `file` (a `.md` file)          | Formatted notes / summary      |
| `files`    | `items: [{ name, file }]`      | List of files (PDF, etc.)      |

To add a new study tool (flashcards, quiz, …): add one renderer to
`SECTION_TYPES`, then any lecture can use it by adding a section with that
`type`. Prefer data in JSON files inside the lecture folder.

## Other changes

- **Add a class:** add `{ "id", "title" }` (optional `"color"`, `"icon"`) to the
  module's `module.json`, and create `<class-id>/class.json` with `{ "lectures": [] }`.
- **Rename a module or change its status:** edit `content/modules.json`
  (`title`, `subtitle`, `status`).
- **After changing app code** (not content), bump `VERSION` in `sw.js` so
  installed copies pick up the new files.

## Hosting

GitHub Pages serves the `main` branch root. Every push to `main` updates the
live app within a minute or two. Content is fetched network-first, so new
lectures appear on next open; older ones stay readable offline.

To preview locally: `python3 -m http.server` in this folder, then open
http://localhost:8000.
