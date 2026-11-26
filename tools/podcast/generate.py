#!/usr/bin/env python3
"""Render a two-host podcast script to MP3 + a timed transcript for the app.

Usage:
  python3 tools/podcast/generate.py path/to/script.json
Writes podcast.mp3 and podcast.json next to the script (or --out DIR).

script.json:
{
  "title": "Lecture 1: ...",
  "hosts": {"A": {"name": "Maya", "voice": "af_heart"},
            "B": {"name": "Leo",  "voice": "am_michael"}},
  "lines": [{"s": "A", "t": "Hey, welcome back..."}, ...]
}

TTS engine: Kokoro (open source, runs locally on CPU). Model files are
downloaded once to ~/.cache/kokoro (see README in this folder).
"""
import argparse, json, os, random, re, subprocess, sys, tempfile, urllib.request
import numpy as np

CACHE = os.path.expanduser("~/.cache/kokoro")
URLS = {
    "kokoro-v1.0.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices-v1.0.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}
SR = 24000


def model_paths():
    os.makedirs(CACHE, exist_ok=True)
    out = []
    for name, url in URLS.items():
        p = os.path.join(CACHE, name)
        if not os.path.exists(p):
            print(f"downloading {name}…", file=sys.stderr)
            urllib.request.urlretrieve(url, p)
        out.append(p)
    return out


def gap_before(prev_text, text, same_speaker):
    """Natural pause before a line, in seconds."""
    if same_speaker:
        return random.uniform(0.35, 0.55)
    short = len(text.split()) <= 3          # quick reaction: "Right.", "Exactly!"
    if short:
        return random.uniform(0.08, 0.2)
    if prev_text.rstrip().endswith("?"):
        return random.uniform(0.25, 0.45)
    return random.uniform(0.18, 0.38)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--out")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    random.seed(args.seed)

    from kokoro_onnx import Kokoro
    kokoro = Kokoro(*model_paths())

    script = json.load(open(args.script))
    hosts = script["hosts"]
    out_dir = args.out or os.path.dirname(os.path.abspath(args.script))
    chunks, transcript, t = [], [], 0.6
    chunks.append(np.zeros(int(SR * 0.6), dtype=np.float32))
    prev = None
    for i, line in enumerate(script["lines"]):
        h = hosts[line["s"]]
        text = line["t"].strip()
        if prev is not None:
            g = line.get("gap", gap_before(prev["t"], text, prev["s"] == line["s"]))
            chunks.append(np.zeros(int(SR * g), dtype=np.float32)); t += g
        speed = line.get("speed", h.get("speed", 1.0)) * random.uniform(0.97, 1.03)
        audio, sr = kokoro.create(text, voice=h["voice"], speed=speed, lang=h.get("lang", "en-us"))
        assert sr == SR
        # trim leading/trailing near-silence so our own gaps control the pacing
        nz = np.where(np.abs(audio) > 0.01)[0]
        if len(nz):
            audio = audio[max(nz[0] - 600, 0): nz[-1] + 1200]
        audio = audio * h.get("gain", 1.0)
        transcript.append({"speaker": h["name"], "start": round(t, 2), "text": text})
        chunks.append(audio.astype(np.float32)); t += len(audio) / SR
        prev = line
        print(f"\r{i + 1}/{len(script['lines'])}", end="", file=sys.stderr)
    print(file=sys.stderr)
    chunks.append(np.zeros(int(SR * 1.0), dtype=np.float32))
    full = np.concatenate(chunks)

    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, "a.f32")
        full.tofile(raw)
        mp3 = os.path.join(out_dir, "podcast.mp3")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
                        "-af", "highpass=f=60,loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "80k", mp3], check=True)
    meta = {
        "title": script.get("title", ""),
        "hosts": [h["name"] for h in hosts.values()],
        "duration": round(len(full) / SR, 1),
        "lines": transcript,
    }
    json.dump(meta, open(os.path.join(out_dir, "podcast.json"), "w"), ensure_ascii=False, indent=1)
    print(f"wrote {mp3} ({meta['duration'] / 60:.1f} min)")


if __name__ == "__main__":
    main()
