---
name: video-editor
description: Edit a raw talking-head video the user sends into a finished reel — speech extraction, silence cuts, animated captions, motion-graphic cards, custom HyperFrames motion graphics, SFX, render — using the video-editor/ project (Python + Remotion + HyperFrames). Use whenever the user uploads or links a video of themselves talking and asks to edit it, "make it a reel", "do the montage", or to apply a reel's style to it.
---

# Video editor — the user talks, Claude edits

The user's whole job is to send a video of themselves talking. Everything else is yours:
transcribe, cut, decide the edit, render, send back. Project: `video-editor/` at the repo root.

## 0. Setup (once per container)

```bash
cd video-editor
pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install openai-whisper
(cd remotion && npm install) && (cd hyperframes && npm install)
```
Needs network hosts `openaipublic.azureedge.net` (Whisper models) and `download.pytorch.org`.
Rendering uses the preinstalled Chromium headless shell (`ve.py` passes it to Remotion with
`--browser-executable` and to HyperFrames with `HYPERFRAMES_BROWSER_PATH`).

## 1. Ingest

```bash
python3 ve.py new <video> --name <slug> --lang <fr|en|ar|auto> --model medium
```
This imports the clip (constant frame rate H.264), transcribes it with word timestamps, cuts real
silences (ffmpeg silencedetect, default > 0.45 s) and prints the transcript on the **output** timeline,
also saved to `projects/<slug>/script.txt`.
- Tunisian/Maghrebi darija: `--lang ar --model medium` (`small` is fast but rough). For French-heavy
  code-switching, try `--lang fr`.
- Too jumpy → `python3 ve.py cut <slug> --max-gap 0.7`. Silences not removed → `--noise -30`.

## 2. Decide the edit (this is the creative part: do it yourself)

Read `script.txt` and write `projects/<slug>/edit.json`. All times are output-timeline seconds taken
from the script lines.

```json
{
  "theme": "terracotta-dark",
  "format": "9:16",
  "captionWords": 3,
  "highlight": ["claude", "remotion", "60"],
  "totalSteps": 5,
  "beats": [
    {"start": 0, "end": 3.2, "type": "hook", "kicker": "my process", "title": "Montage = Claude", "subtitle": "0 software"},
    {"start": 3.4, "end": 8, "type": "list", "step": 1, "title": "Find a reel", "items": ["Instagram", "TikTok"]},
    {"start": 8.2, "end": 12, "type": "stat", "value": "60", "title": "fps render"},
    {"start": 12.2, "end": 17, "type": "compare", "title": "Editing", "items": ["Premiere", "Claude Code"]},
    {"start": 17.2, "end": 21, "type": "quote", "title": "Claude works, I chill", "subtitle": "me"},
    {"start": 21.2, "end": 24, "type": "title", "kicker": "prompt", "title": "Analyze it in detail", "subtitle": "what · how · tools"},
    {"start": 24.2, "end": 27, "type": "cta", "title": "Your turn", "subtitle": "Follow for part 2"}
  ]
}
```

Editing rules (copied from pro reels; break them only for a reason):
- **Hook in 0–3 s**: one beat of type `hook` with the promise ("5 steps", a number, a bold claim).
  The face stays full screen with the title over it.
- **One idea = one card.** Each new idea, tool, number or step the speaker mentions gets a beat lasting
  2–7 s that starts on the word that introduces it. Leave the face full screen (no beat) for personal
  or emotional lines, about 20–30% of the time, so the edit breathes.
- Process content → number the beats with `step` and set `totalSteps`. A progress bar and "STEP n/N" appear.
- Numbers → `stat`. Before/after or old/new → `compare` (items: [bad, good]). Punchline → `quote`.
  Lists of tools or tips → `list` (items appear one by one across the first 55% of the beat). End → `cta`.
- Card text is **short**: titles ≤ 5 words. It can be in a different language from the speech (French
  or English cards over darija speech is fine). Captions carry the full speech.
- `highlight`: 5–15 keywords **exactly as spelled in the transcript**, drawn in the accent colour.
- Fix obvious transcription errors in names by adding `"words"` (a copy of timeline words with fixes)
  only if they matter; otherwise leave the words alone.
- Optional: `music` (file under `remotion/public/`), `musicVolume` 0.05–0.12, `sfxVolume`, `faceZoom`
  (1.1–1.3 if the face is small in frame), `fps` 60 for smoother motion, `beat.sfx` to override or
  `null` to mute one beat. SFX by default: riser on hook, whoosh on new step, ding on stat/cta, pop otherwise.

## 2b. Custom motion graphics with HyperFrames (for the big moments)

Template cards cover most beats. For the 1–3 moments that carry the video (the key list, a
diagram, a reveal), build a bespoke animated scene in HTML + GSAP with HyperFrames (HeyGen,
open source). It renders with an alpha channel, and Remotion composites it.

```bash
python3 ve.py scene-new <slug> tools --area panel   # projects/<slug>/scenes/tools/index.html (1080x1036)
#   ...edit index.html: content, timings, theme colours...
python3 ve.py scene <slug>                          # lint + render -> public/projects/<slug>/scenes/tools.webm
```
Then add a beat: `{"start": 14.1, "end": 20.1, "type": "scene", "src": "projects/<slug>/scenes/tools.webm", "step": 1}`.
- `--area panel` fills the lower panel under the face (keep the top 140 px free for the STEP bar).
  `--area full` is 1080×1920 over the face, for transitions, big reveals or a faceless intro.
- Contract: root `data-composition-id="main"` with `data-duration` equal to the beat length.
  Every timed element needs `data-start` and `data-duration`. Register one paused GSAP timeline on
  `window.__timelines["main"]`. Logic must be deterministic: no `Math.random`, no `Date.now`, no network.
- Assets are offline: GSAP and the fonts (Cairo, Inter, Instrument Serif, JetBrains Mono) are in
  `assets/`, copied from `hyperframes/shared/` at render time. Don't use CDN links; they're blocked.
- Template: `hyperframes/templates/checklist` (title + rows that check off one by one with a
  counter). Copy the theme colours from the reel's theme into its `:root` variables.
- Motion vocabulary: blur 8→0 + y 30→0 in 0.35 s `power4.out` for entries, `back.out(3)`
  for checks and pops, an accent glow on the active item, stagger about 0.5 s matched to speech.
- Look before rendering: `hyperframes/node_modules/.bin/hyperframes snapshot <scene-dir> --at 1,3,5`.
- Reference analysis: `hyperframes measure <video>` measures cuts, eases and motion of a reel you want to copy.

## 3. Style

`theme` is a file name from `video-editor/themes/` (`terracotta-dark`, `clean-light`, `neon-bold`) or
an inline object: `{"extends": "clean-light", "accent": "#FF5A1F"}`.
To copy a reel the user likes: run the `reel-analyze` skill on it, then save its palette, fonts and
step label as `themes/<name>.json`. Fonts bundled: Inter, Instrument Serif, JetBrains Mono, Cairo (Arabic);
add others with `npm i @fontsource/<font>` plus an import in `remotion/src/Root.tsx`.

## 4. Review, then render

```bash
python3 ve.py build <slug> && python3 ve.py preview <slug>   # -> projects/<slug>/preview.jpg
```
Look at `preview.jpg` (use `--at 1.5,4,9` for specific seconds). Check that text isn't cut off, cards
don't overlap captions, and the hook reads in 1 s. Fix `edit.json` and preview again. Then:
```bash
python3 ve.py render <slug>                                  # -> projects/<slug>/out.mp4
```
Rendering takes about 2 s per second of video on 4 CPUs. Send `out.mp4` with SendUserFile plus a
3-line summary of the edit choices. On feedback ("I don't like X, change it"), edit `edit.json` or the
theme and re-render; touch the React components only for a new kind of visual.

## Files

- `ve.py`: pipeline CLI (new / transcribe / cut / script / build / preview / render)
- `remotion/src/Reel.tsx`: layout (face full ↔ split with panel), captions, step bar, SFX, music
- `remotion/src/components/BeatCard.tsx`: card types; add new types here and in `types.ts`
- `hyperframes/templates/`: HyperFrames scene templates; `hyperframes/shared/`: offline GSAP + fonts
- `projects/<slug>/`: per-video work files (gitignored); the video copy lives in `remotion/public/projects/<slug>/`
