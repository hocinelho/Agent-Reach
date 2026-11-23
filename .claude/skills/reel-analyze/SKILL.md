---
name: reel-analyze
description: Download a short-form video (Instagram Reel, TikTok, YouTube Short) from a link and break it down in detail — what was made, how, and with which tools — into a reusable style spec (hook, layout, palette, motion, sound, captions). Use when the user pastes a reel/short link and asks to analyze it, "see how he did it", extract the style, or copy the editing.
---

# Reel analyze — "tfarrej fel vidéo hedhi w analysiha b détails"

Steps 1–2 of the reel workflow from @ms_raoudh (reel DexY5nvJzhm):
1. Pick a reel you like and copy its link.
2. Give the link to Claude: *"watch this video and analyze it in detail: what was made, how, and which tools"*.
   Claude runs `yt-dlp` → `whisper` → `ffmpeg` frames and returns a style spec.

## Procedure

Work in a scratch dir, e.g. `~/reels/<id>/`.

1. **Download** (keep the metadata, it holds caption + signed CDN URLs):
   ```bash
   yt-dlp --write-info-json -o "%(id)s.%(ext)s" "<URL>"
   ```
   - Instagram 429 / login required → retry later, or `--cookies-from-browser chrome`.
   - Page rate-limited but `.info.json` exists → `yt-dlp --load-info-json <id>.info.json -o video.mp4`
     (the CDN URLs inside are still valid for a few hours).
   - Sandboxed network: the video lives on regional hosts like `scontent-<pop>.cdninstagram.com`;
     read them from `formats[].url` in the info JSON and allow those exact hosts.
2. **Probe**: `ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of json video.mp4`
3. **Frames** — one every 1–4 s, tiled into contact sheets you can view:
   ```bash
   ffmpeg -i video.mp4 -vf "fps=1/2,scale=480:-1" frames/f_%03d.jpg
   ffmpeg -pattern_type glob -i 'frames/f_*.jpg' -vf tile=5x2 sheet_%02d.jpg
   ```
   For motion detail, also grab every frame of a 1 s window around each cut
   (`-ss T -t 1 -vf fps=30`) to count blur/ease frames.
4. **Transcript**: `whisper video.mp4 --model large-v3 --word_timestamps True` (or `faster-whisper`).
   If the model can't be downloaded, read the burned-in captions off the frames instead.
5. **Read the sheets** and fill in the spec below. Count words and frames and pull exact hex colours
   (`ffmpeg -ss T -i video.mp4 -frames:v 1 -vf "crop=…,scale=1:1" -f rawvideo -pix_fmt rgb24 -`).

## Output — "Voilà comment il est fait"

Return this table (it feeds straight into `reel-pro-edit`):

| Field | What to capture | Example (DexY5nvJzhm) |
|---|---|---|
| HOOK | promise + when it lands | "5 étapes", 0–3 s, face cam + floating phone mockups |
| STRUCTURE | numbered steps, progress UI | `ÉTAPE n/5` label + 5-segment progress bar, bonus at end |
| LAYOUT | split, faceless?, objects per screen | face cam top ~45%, one UI card per beat on the bottom half |
| COULEUR | bg / accent / text / muted / light | dark brown-black bg, terracotta `#CF6F56`, cream `#F6F6EC` |
| TYPO | families, weights, styles | serif italic for keywords (Claude, reel, motion), heavy sans for Arabic captions |
| CAPTIONS | position, words per card, highlight rule | 2–4 words, pill bottom-centre, key word in accent |
| MOTION | entry and exit | blur 6→0 over 6 frames, ease-out pop, orange glow on active card |
| SONS | voice / music / SFX | voice-over + light music + ~3 SFX on reveals (pop, riser, ding) |
| TOOLS | what made it | Claude Code + Remotion 4 + ffmpeg + Whisper large-v3 + SFX pack + 4 fonts |
| STATS | duration, fps, frames, words | 1:55, 1080×1920, 30 fps source, 128 words |

End with a short "how to recreate" list that points to the `reel-pro-edit` skill.
