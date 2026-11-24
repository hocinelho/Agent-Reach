#!/usr/bin/env python3
"""video-editor: raw talking video -> edited reel.

    python ve.py new  <video> --name demo [--lang fr] [--model small] [--fps 30]
    python ve.py script demo           # transcript with output-timeline timestamps
    (write projects/demo/edit.json: beats, highlight, theme ...)
    python ve.py build  demo           # merge edit.json + transcript -> props.json
    python ve.py scene-new demo tools --area panel   # custom HyperFrames motion graphic
    python ve.py scene demo            # render scenes -> transparent .webm (beat type "scene")
    python ve.py preview demo          # contact sheet of stills, for review
    python ve.py render demo           # -> projects/demo/out.mp4

`new` = import + transcribe + cut. Each step can also be re-run on its own:
    python ve.py transcribe demo / cut demo [--max-gap 0.45]
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REMOTION = ROOT / "remotion"
PROJECTS = ROOT / "projects"
THEMES = ROOT / "themes"
HF = ROOT / "hyperframes"
CHROME = Path("/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell")


def proj(name: str) -> Path:
    return PROJECTS / name


def public_dir(name: str) -> Path:
    return REMOTION / "public" / "projects" / name


def load(p: Path, default=None):
    return json.loads(p.read_text()) if p.exists() else default


def save(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def run(cmd: list[str], **kw) -> None:
    print("$", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


# ---------------------------------------------------------------- import
def cmd_import(a) -> None:
    src = Path(a.video).expanduser().resolve()
    if not src.exists():
        sys.exit(f"no such file: {src}")
    d, pub = proj(a.name), public_dir(a.name)
    d.mkdir(parents=True, exist_ok=True)
    pub.mkdir(parents=True, exist_ok=True)
    # Constant frame rate H.264 + AAC: phone footage is often VFR / HEVC / rotated,
    # which breaks frame-accurate cutting. 1080 wide, portrait kept.
    run([
        "ffmpeg", "-v", "error", "-y", "-i", src,
        "-vf", f"scale='min(1080,iw)':-2,fps={a.fps}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
        pub / "input.mp4",
    ])
    run(["ffmpeg", "-v", "error", "-y", "-i", pub / "input.mp4", "-ac", "1", "-ar", "16000", d / "audio.wav"])
    meta = load(d / "meta.json", {}) or {}
    meta.update({"source": str(src), "fps": a.fps, "lang": a.lang, "model": a.model})
    save(d / "meta.json", meta)


# ---------------------------------------------------------------- transcribe
def cmd_transcribe(a) -> None:
    import whisper  # openai-whisper

    d = proj(a.name)
    meta = load(d / "meta.json", {})
    model_name = getattr(a, "model", None) or meta.get("model", "small")
    lang = getattr(a, "lang", None) or meta.get("lang")
    print(f"transcribing with whisper {model_name} (lang={lang or 'auto'}) ...", flush=True)
    model = whisper.load_model(model_name)
    res = model.transcribe(
        str(d / "audio.wav"),
        language=None if lang in (None, "auto") else lang,
        word_timestamps=True,
        fp16=False,
        condition_on_previous_text=False,
    )
    words = [
        {"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)}
        for seg in res["segments"]
        for w in seg.get("words", [])
        if w["word"].strip()
    ]
    save(d / "words.src.json", {"language": res.get("language"), "words": words})
    print(f"{len(words)} words, language={res.get('language')}")


# ---------------------------------------------------------------- cut silences
def cmd_cut(a) -> None:
    d = proj(a.name)
    meta = load(d / "meta.json", {})
    fps = meta.get("fps", 30)
    words = load(d / "words.src.json")["words"]
    dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
        public_dir(a.name) / "input.mp4",
    ]).decode().strip())
    pre, post, max_gap = a.pad_before, a.pad_after, a.max_gap

    # Real silences from the audio (whisper word timestamps are glued together,
    # so they can't be trusted to find pauses). Keep a little air on each side.
    log = subprocess.run(
        ["ffmpeg", "-i", str(d / "audio.wav"), "-af", f"silencedetect=n={a.noise}dB:d={max_gap}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    silences, start = [], None
    for line in log.splitlines():
        if "silence_start:" in line:
            start = float(line.split("silence_start:")[1].split()[0])
        elif "silence_end:" in line and start is not None:
            silences.append((max(0.0, start), float(line.split("silence_end:")[1].split()[0])))
            start = None
    if start is not None:
        silences.append((start, dur))
    islands: list[list[float]] = []
    cursor_t = 0.0
    for s, e in silences:
        cut_s, cut_e = s + post, e - pre
        if s <= 0.01:
            cut_s = 0.0  # leading silence: drop it entirely (keep `pre` before speech)
        if e >= dur - 0.01:
            cut_e = dur
        if cut_e - cut_s > 0.05:
            if cut_s > cursor_t:
                islands.append([cursor_t, cut_s])
            cursor_t = cut_e
    if cursor_t < dur:
        islands.append([cursor_t, dur])
    if not islands:
        islands = [[0.0, dur]]

    # align to whole frames
    segs = []
    for s, e in islands:
        fs, fe = math.floor(s * fps), math.ceil(e * fps)
        if segs and fs <= segs[-1][1]:
            segs[-1][1] = max(segs[-1][1], fe)
        else:
            segs.append([fs, fe])

    # map source time -> output time
    offsets, cursor = [], 0
    for fs, fe in segs:
        offsets.append((fs, fe, cursor))
        cursor += fe - fs

    def to_out(t: float) -> float:
        f = t * fps
        for fs, fe, off in offsets:
            if f < fs:
                return off / fps
            if f <= fe:
                return (off + f - fs) / fps
        return cursor / fps

    out_words = [{"w": w["w"], "s": round(to_out(w["s"]), 3), "e": round(to_out(w["e"]), 3)} for w in words]
    save(d / "timeline.json", {
        "fps": fps,
        "durationInSeconds": cursor / fps,
        "sourceDuration": dur,
        "segments": [{"from": fs / fps, "to": fe / fps} for fs, fe in segs],
        "words": out_words,
    })
    print(f"source {dur:.1f}s -> edited {cursor / fps:.1f}s ({len(segs)} segments, {dur - cursor / fps:.1f}s of silence removed)")


# ---------------------------------------------------------------- script
def cmd_script(a) -> None:
    tl = load(proj(a.name) / "timeline.json")
    line, out = [], []
    for i, w in enumerate(tl["words"]):
        line.append(w)
        nxt = tl["words"][i + 1] if i + 1 < len(tl["words"]) else None
        if w["w"].endswith((".", "?", "!", "؟")) or not nxt or nxt["s"] - w["e"] > 0.3 or len(line) >= 14:
            out.append(f"[{line[0]['s']:6.2f} - {line[-1]['e']:6.2f}] " + " ".join(x["w"] for x in line))
            line = []
    text = "\n".join(out)
    (proj(a.name) / "script.txt").write_text(text + "\n")
    print(f"duration {tl['durationInSeconds']:.2f}s\n{text}")


# ---------------------------------------------------------------- build props
def resolve_theme(spec) -> dict:
    base = load(THEMES / "terracotta-dark.json")
    if isinstance(spec, str):
        base = {**base, **load(THEMES / f"{spec}.json")}
    elif isinstance(spec, dict):
        name = spec.get("extends")
        if name:
            base = {**base, **load(THEMES / f"{name}.json")}
        base = {**base, **{k: v for k, v in spec.items() if k != "extends"}}
    return base


def cmd_build(a) -> None:
    d = proj(a.name)
    tl = load(d / "timeline.json")
    edit = load(d / "edit.json", {}) or {}
    meta = load(d / "meta.json", {})
    lang = (load(d / "words.src.json") or {}).get("language", "")
    rtl = edit.get("rtl", lang == "ar")
    words = edit.get("words") or tl["words"]
    fmt = edit.get("format", "9:16")
    w, h = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080), "16:9": (1920, 1080)}[fmt]
    props = {
        "src": f"projects/{a.name}/input.mp4",
        "fps": edit.get("fps", tl["fps"]),
        "width": w,
        "height": h,
        "durationInSeconds": tl["durationInSeconds"],
        "segments": tl["segments"],
        "words": words,
        "beats": edit.get("beats", []),
        "totalSteps": edit.get("totalSteps", max([b.get("step", 0) for b in edit.get("beats", [])] or [0])),
        "highlight": [x.lower() for x in edit.get("highlight", [])],
        "captionWords": edit.get("captionWords", 3),
        "rtl": rtl,
        "theme": resolve_theme(edit.get("theme", meta.get("theme", "terracotta-dark"))),
        "music": edit.get("music"),
        "musicVolume": edit.get("musicVolume", 0.08),
        "sfxVolume": edit.get("sfxVolume", 0.5),
        "faceZoom": edit.get("faceZoom", 1.0),
    }
    if rtl and props["theme"].get("fontBody") == "Inter":
        props["theme"]["fontBody"] = "Cairo"
    save(d / "props.json", props)
    print(f"props.json: {len(props['beats'])} beats, {len(words)} words, {props['durationInSeconds']:.1f}s, theme={props['theme']['name']}")


# ---------------------------------------------------------------- HyperFrames scenes
SCENE_SIZE = {"panel": (1080, 1036), "full": (1080, 1920)}


def cmd_scene_new(a) -> None:
    d = proj(a.name) / "scenes" / a.scene
    if d.exists():
        sys.exit(f"exists: {d}")
    shutil.copytree(HF / "templates" / a.template, d)
    w, h = SCENE_SIZE[a.area]
    html = (d / "index.html").read_text()
    html = html.replace("1036", str(h)).replace("1080", str(w))
    (d / "index.html").write_text(html)
    save(d / "scene.json", {"area": a.area})
    print(f"scene: {d / 'index.html'}  ({w}x{h}, edit it, then: ve.py scene {a.name})")


def cmd_scene(a) -> None:
    root = proj(a.name) / "scenes"
    fps = (load(proj(a.name) / "meta.json", {}) or {}).get("fps", 30)
    names = [a.scene] if a.scene else sorted(p.name for p in root.iterdir() if (p / "index.html").exists())
    env = {**__import__("os").environ, "HYPERFRAMES_BROWSER_PATH": str(CHROME)} if CHROME.exists() else None
    for n in names:
        d = root / n
        assets = d / "assets"
        if assets.exists():
            shutil.rmtree(assets)
        shutil.copytree(HF / "shared", assets)
        out = public_dir(a.name) / "scenes" / f"{n}.webm"
        out.parent.mkdir(parents=True, exist_ok=True)
        hf = HF / "node_modules" / ".bin" / "hyperframes"
        run([hf, "lint", d], env=env)
        run([hf, "render", d, "--format", "webm", "--fps", str(fps), "-o", out, "--quiet"], env=env, stdout=subprocess.DEVNULL)
        print(f"scene {n} -> {out.relative_to(REMOTION / 'public')}  (use as beat src)")


# ---------------------------------------------------------------- preview / render
def remotion(args: list) -> None:
    extra = ["--browser-executable", CHROME] if CHROME.exists() else []
    run(["npx", "remotion", *args, *extra], cwd=REMOTION)


def cmd_preview(a) -> None:
    d = proj(a.name)
    props = load(d / "props.json")
    if props is None:
        cmd_build(a)
        props = load(d / "props.json")
    shots = d / "preview"
    if shots.exists():
        shutil.rmtree(shots)
    shots.mkdir()
    times = [float(x) for x in a.at.split(",")] if a.at else None
    if not times:
        n = a.count
        times = [props["durationInSeconds"] * (i + 0.5) / n for i in range(n)]
    for i, t in enumerate(times):
        frame = min(int(t * props["fps"]), int(props["durationInSeconds"] * props["fps"]) - 1)
        remotion(["still", "src/index.ts", "Reel", shots / f"s_{i:02d}.jpg", f"--props={d / 'props.json'}", f"--frame={frame}", "--scale=0.4", "--log=error"])
    cols = min(5, len(times))
    run(["ffmpeg", "-v", "error", "-y", "-pattern_type", "glob", "-i", shots / "s_*.jpg",
         "-vf", f"tile={cols}x{math.ceil(len(times) / cols)}", "-frames:v", "1", d / "preview.jpg"])
    print(f"preview: {d / 'preview.jpg'}  (times: {', '.join(f'{t:.1f}s' for t in times)})")


def cmd_render(a) -> None:
    d = proj(a.name)
    cmd_build(a)
    out = d / (a.out or "out.mp4")
    args = ["render", "src/index.ts", "Reel", out, f"--props={d / 'props.json'}", "--codec=h264", "--crf=18"]
    if a.gl:
        args.append(f"--gl={a.gl}")
    remotion(args)
    print(f"rendered: {out}")


# ---------------------------------------------------------------- main
def main() -> None:
    p = argparse.ArgumentParser(description="raw talking video -> edited reel")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name, fn, video=False):
        sp = sub.add_parser(name)
        if video:
            sp.add_argument("video")
            sp.add_argument("--name", required=True)
        else:
            sp.add_argument("name")
        sp.set_defaults(fn=fn)
        return sp

    for name, fn in (("new", None), ("import", cmd_import)):
        sp = add(name, fn, video=True)
        sp.add_argument("--lang", default="auto", help="fr, en, ar ... or auto")
        sp.add_argument("--model", default="small", help="whisper model: base, small, medium, large-v3")
        sp.add_argument("--fps", type=int, default=30)
        sp.add_argument("--max-gap", type=float, default=0.45)
        sp.add_argument("--pad-before", type=float, default=0.10)
        sp.add_argument("--pad-after", type=float, default=0.18)
        sp.add_argument("--noise", type=float, default=-35)
    sp = add("transcribe", cmd_transcribe)
    sp.add_argument("--lang")
    sp.add_argument("--model")
    sp = add("cut", cmd_cut)
    sp.add_argument("--max-gap", type=float, default=0.45, help="silences longer than this are cut (s)")
    sp.add_argument("--pad-before", type=float, default=0.10)
    sp.add_argument("--pad-after", type=float, default=0.18)
    sp.add_argument("--noise", type=float, default=-35, help="silence threshold in dB")
    add("script", cmd_script)
    add("build", cmd_build)
    sp = add("scene-new", cmd_scene_new)
    sp.add_argument("scene")
    sp.add_argument("--area", choices=["panel", "full"], default="panel")
    sp.add_argument("--template", default="checklist")
    sp = add("scene", cmd_scene)
    sp.add_argument("scene", nargs="?")
    sp = add("preview", cmd_preview)
    sp.add_argument("--count", type=int, default=10)
    sp.add_argument("--at", help="comma-separated seconds")
    sp = add("render", cmd_render)
    sp.add_argument("--out")
    sp.add_argument("--gl", help="angle, vulkan, swangle ... (GPU)")

    a = p.parse_args()
    if a.cmd == "new":
        cmd_import(a)
        cmd_transcribe(a)
        cmd_cut(a)
        cmd_script(a)
    else:
        a.fn(a)


if __name__ == "__main__":
    main()
