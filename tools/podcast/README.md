# Podcast generator

Turns a dialogue script into `podcast.mp3` + `podcast.json` (timed transcript)
for the app's `podcast` section.

Setup (once):

```
pip install kokoro-onnx soundfile numpy
# ffmpeg must be installed
```

The Kokoro model (~350 MB) downloads to `~/.cache/kokoro` on first run.

Run:

```
python3 tools/podcast/generate.py content/module-2/<class>/lectures/01/podcast-script.json
```

## Script format

```json
{
  "title": "Lecture 1: ...",
  "hosts": {
    "A": { "name": "Maya", "voice": "af_heart" },
    "B": { "name": "Leo",  "voice": "am_michael" }
  },
  "lines": [
    { "s": "A", "t": "Okay, so today we're getting into..." },
    { "s": "B", "t": "Wait, really?" }
  ]
}
```

Optional per line: `gap` (seconds of silence before it), `speed`.
Optional per host: `speed`, `gain`.

Writing tips for a natural sound: short sentences, contractions, small
reactions ("Right.", "Huh.", "Wait, so..."), questions from the co-host,
everyday analogies, and one host summarising before moving on. Avoid lists,
abbreviations the voice may misread (write "R M B" or "renminbi"), and
symbols (write "percent", "billion").
