# video-editor

Send a raw video of yourself talking and get back an edited reel: silences cut, animated captions,
motion-graphic cards, sound effects, 1080×1920 render.

```
raw.mp4 ─▶ ve.py new ─▶ script.txt ─▶ edit.json (Claude) ─▶ ve.py render ─▶ out.mp4
            import        transcript     hook, cards,          Remotion
            whisper       on the cut     steps, keywords,      H.264 CRF 18
            silence cut   timeline       theme
```

Claude follows `.claude/skills/video-editor/SKILL.md`. You only send the video.

## Quick start

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install openai-whisper
(cd remotion && npm install)

python3 ve.py new ~/Videos/take1.mp4 --name take1 --lang fr --model medium
# write projects/take1/edit.json (see the skill for the format)
python3 ve.py preview take1      # contact sheet for review
python3 ve.py render take1       # projects/take1/out.mp4
```

`cd remotion && npm run studio` opens Remotion Studio to scrub through the edit.

## Themes

`themes/*.json`: `terracotta-dark` (default), `clean-light`, `neon-bold`. Any reel's style can be
copied into a new theme with the `reel-analyze` skill.
