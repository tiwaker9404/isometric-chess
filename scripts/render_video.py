#!/usr/bin/env python3
"""Render the explainer video: every frame is a screenshot of docs/index.html?video at time t.

Needs: pip install playwright && playwright install chromium, plus ffmpeg on PATH.
Usage: python3 scripts/render_video.py [--fps 30] [--workers 4]
Static moments (the pauses between moves) are only rendered once and reused.
"""
import argparse, os, shutil, subprocess, tempfile, time
from multiprocessing import Pool
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = (ROOT / "docs" / "index.html").as_uri() + "?video"
SIZE = {"width": 1280, "height": 720}

def open_page(p):
    b = p.chromium.launch()
    pg = b.new_page(viewport=SIZE)
    pg.goto(URL)
    return b, pg

def render_chunk(job):
    out, items = job
    with sync_playwright() as p:
        b, pg = open_page(p)
        for idx, t in items:
            if (out / f"f{idx:05d}.png").exists(): continue      # resumable
            pg.evaluate(f"renderAt({t})")
            pg.screenshot(path=str(out / f"f{idx:05d}.png"))
        b.close()
    return len(items)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--frames-dir", default=str(Path(tempfile.gettempdir()) / "isometric_chess_frames"),
                    help="where frames are cached; re-running resumes instead of starting over")
    ap.add_argument("--render-only", action="store_true", help="render frames, skip encoding")
    a = ap.parse_args()
    media = ROOT / "media"; media.mkdir(exist_ok=True)
    out = Path(a.frames_dir); out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    with sync_playwright() as p:
        b, pg = open_page(p)
        total = pg.evaluate("TOTAL")
        n = int(total * a.fps)
        times = [i / a.fps for i in range(n)]
        keys = pg.evaluate("ts => ts.map(keyAt)", times)
        hero_t = pg.evaluate("holdOf(31)")
        pg.evaluate(f"renderAt({hero_t})"); pg.screenshot(path=str(media / "hero.png"))
        b.close()

    first, dupes = {}, []
    for i, k in enumerate(keys):
        if k in first: dupes.append((i, first[k]))
        else: first[k] = i
    uniq = [(i, times[i]) for i in sorted(first.values())]
    print(f"{n} frames at {a.fps} fps ({total:.1f}s), {len(uniq)} unique")

    chunks = [(out, uniq[w::a.workers]) for w in range(a.workers)]
    with Pool(a.workers) as pool: pool.map(render_chunk, chunks)
    if a.render_only and any(not (out / f"f{i:05d}.png").exists() for i, _ in uniq):
        print("frames incomplete, run again to resume"); return
    for i, j in dupes:
        d = out / f"f{i:05d}.png"
        if not d.exists(): os.link(out / f"f{j:05d}.png", d)
    if a.render_only: print("all frames rendered"); return

    mp4 = media / "opera-game-isometric.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(a.fps), "-i", str(out / "f%05d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", "-movflags", "+faststart", str(mp4)], check=True)
    gif = media / "preview.gif"
    pal = out / "pal.png"
    vf = "fps=12,scale=720:-1:flags=lanczos"
    clip = ["-ss", "0.5", "-t", "11", "-i", str(mp4)]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *clip, "-vf", vf + ",palettegen=max_colors=96", str(pal)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *clip, "-i", str(pal), "-lavfi", vf + "[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", str(gif)], check=True)
    print(f"done in {time.time() - t0:.0f}s: {mp4.name} ({mp4.stat().st_size / 1e6:.1f} MB), {gif.name} ({gif.stat().st_size / 1e6:.1f} MB), hero.png")

if __name__ == "__main__":
    main()
