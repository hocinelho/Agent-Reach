---
name: reel-pro-edit
description: Turn a face-cam recording plus a topic/script into a finished 9:16 motion-graphics reel with Remotion — captions, UI cards, SFX, music, 60 fps render — copying the style of a reference reel analyzed with reel-analyze. Use when the user wants to edit or montage a reel "with Claude, zero software", reproduce a reel's style, or produce a talking-head explainer with motion graphics.
---

# Reel pro edit — face cam → pro reel

Steps 3–5 + bonus of the workflow from @ms_raoudh (reel DexY5nvJzhm: "montage, motion graphics,
everything with Claude — 0 logiciel").

Role for the whole session: **act as an expert motion graphics editor** and brainstorm with the user
before building.

## Step 3 — Same style, same motion

1. **Install the toolkit** into `~/reels/toolkit/` (check what exists first):
   - Remotion v4 (`npx create-video@latest --blank`, TypeScript)
   - ffmpeg
   - Whisper large-v3 (`pip install openai-whisper` or `faster-whisper`) for word timestamps
   - SFX pack (~25 `.wav`: pop, whoosh, ding, riser, click, glitch)
   - Fonts: 4 families (display serif italic, heavy sans, mono for UI labels, Arabic-capable sans
     if the captions are in darija/Arabic)
2. **Match the reference**: take the `reel-analyze` spec and build a style guide
   (`style.ts` constants) — style, motions, cards. Show the match %, and list what differs.
3. **Swap the palette to the user's vibe** while keeping the roles. Reference palette:
   `fond #F6F6EC · accent #CF6F56 · texte #1C1B18 · nuance #8A877F · lumière #F8E4DB`
   (dark-mode variant: bg ≈ `#1A1210`, accent stays terracotta).

## Step 4 — Claude works, the user chills

Input: the face-cam take plus a `script.md` (topic, beats). If there's only a topic, draft `script.md` first.

1. Transcribe the take with Whisper → word-level JSON → caption cards (2–4 words, key word in accent).
2. Build the Remotion composition `Reel` (1080×1920), with these tracks:
   - **VOIX**: original audio, silences trimmed
   - **MOTION**: `hook`, `étape 1…N`, `bonus` sequences: one UI card per beat, `ÉTAPE n/N`
     label + segmented progress bar, face cam in the top ~45%
   - **SFX**: pop/ding on each card reveal, riser into each new step
   - **MUSIQUE**: low bed, ducked under the voice
3. Motion rules: entry = blur 6→0 + scale 0.96→1 over 6 frames (spring, no bounce); one object per
   screen; active element gets an accent glow; floating phone mockups for the hook.
4. **Parallelise** (the "8 agents / mission control" step): an orchestrator spawns one sub-agent per
   section (`hook`, `étape1…5`, `son`, `musique`), each writing its own `StepN.tsx` or `sound.ts`
   against the shared `style.ts`, and then merges them into `Reel.tsx`.
5. Open **Remotion Studio** (`npx remotion studio`, localhost:3000) for review. Keep a checklist:
   hook ✓, captions ✓, sync voix ✓, transitions. When the user says "ma 3ejbetnich, baddelha"
   (I don't like it, change it), iterate on any axis: **motion** (fluide), **design** (clean),
   **rythme** (punchy), **vibe** (chaud).

## Step 5 — Rendering

```bash
npx remotion render Reel out/reel.mp4 --codec=h264 --crf=18 --concurrency=100%
```
- 1080×1920, H.264 CRF 18, **60 fps** (source 30 → render 60 for smoother motion)
- Format depends on the target: 9:16 for Reels/TikTok/Shorts, or 16:9 for YouTube
- Use the GPU (`--gl=angle` / `--gl=vulkan`) so it renders fast

## Bonus — turn it into a skill

Once a style works, save it as its own skill in `~/.claude/skills/<name>/SKILL.md` (style constants,
composition template, SFX map), so the next reel is "here's my video + topic → render".
Examples from the reel: `aura-trailer` (trailer with an "aura" look, cut on the bass), `devops45-reel`
(DevOps in 45 s), `reel-pro-edit` (face cam → pro reel), `cinematic-motion-teaser` (cinematic teasers).
