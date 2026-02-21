#!/usr/bin/env python3
"""
YouTube Video Backup — Metadata Fetcher
----------------------------------------
For a given YouTube URL, fetches:
  - Full JSON metadata
  - Human-readable info summary
  - Thumbnail image
  - Auto-generated subtitles in the original language (SRT format)

The video file itself is NOT downloaded — add it manually to the folder.

Each video is stored in a folder named after the video title.

Usage:
    python3 backup.py <youtube_url>
    python3 backup.py <youtube_url> --langs en-orig,es   # extra languages

Requirements:
    - yt-dlp   (brew install yt-dlp)
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, print it, and return the result."""
    print(f"\n▶  {' '.join(cmd)}\n")
    return subprocess.run(cmd, **kwargs)


def get_metadata(url: str) -> dict:
    """Fetch the full JSON metadata for a video without downloading it."""
    result = run(
        ["yt-dlp", "--dump-json", "--skip-download", url],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("ERROR fetching metadata:", result.stderr, file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


def sanitize_filename(name: str) -> str:
    """Remove or replace characters that are problematic in folder names."""
    # Replace characters that are invalid or awkward in file paths
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    # Collapse multiple spaces / trim
    name = re.sub(r'\s+', ' ', name).strip()
    # Limit length to avoid OS issues (keep first 200 chars)
    return name[:200]


def make_output_dir(base: Path, meta: dict) -> Path:
    """Create and return a per-video output directory named after the title."""
    title = meta.get("title") or meta.get("id") or "untitled"
    folder_name = sanitize_filename(title)
    folder = base / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_metadata(folder: Path, meta: dict):
    """Write full JSON metadata to disk."""
    out = folder / "metadata.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"✓  Metadata saved → {out}")


def save_info_summary(folder: Path, meta: dict):
    """Write a human-readable summary text file."""
    out = folder / "info.txt"
    lines = [
        f"Title:       {meta.get('title', 'N/A')}",
        f"Channel:     {meta.get('channel', 'N/A')}",
        f"Uploader:    {meta.get('uploader', 'N/A')}",
        f"Upload date: {meta.get('upload_date', 'N/A')}",
        f"Duration:    {meta.get('duration_string', 'N/A')}",
        f"View count:  {meta.get('view_count', 'N/A')}",
        f"Like count:  {meta.get('like_count', 'N/A')}",
        f"Video ID:    {meta.get('id', 'N/A')}",
        f"URL:         {meta.get('webpage_url', 'N/A')}",
        f"Description:\n{meta.get('description', 'N/A')}",
    ]
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"✓  Info summary saved → {out}")


def download_thumbnail(url: str, folder: Path):
    """Download the video thumbnail image."""
    output_template = str(folder / "%(title)s [%(id)s].%(ext)s")
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-thumbnail",
        "-o", output_template,
        url,
    ]
    result = run(cmd)
    if result.returncode != 0:
        print("WARNING: Thumbnail download may have had issues.", file=sys.stderr)
    else:
        print("✓  Thumbnail downloaded.")


def detect_original_lang(meta: dict) -> str:
    """Return the yt-dlp subtitle key for the original language.

    YouTube marks the original auto-caption as '<lang>-orig'
    (e.g. 'en-orig').  We look at the metadata field 'language'
    and fall back to 'en-orig' if unknown.
    """
    lang = meta.get("language") or "en"
    return f"{lang}-orig"


def download_subtitles(url: str, folder: Path, langs: list[str]):
    """Download auto-generated subtitles in SRT format for the given languages."""
    lang_str = ",".join(langs)
    output_template = str(folder / "%(title)s [%(id)s].%(ext)s")
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-auto-subs",
        "--sub-langs", lang_str,
        "--sub-format", "srt",
        "--convert-subs", "srt",
        "-o", output_template,
        url,
    ]
    result = run(cmd)
    if result.returncode != 0:
        print("WARNING: Subtitle download may have had issues.", file=sys.stderr)
    else:
        print(f"✓  Subtitles downloaded for: {lang_str}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Download a YouTube video with metadata, subtitles and thumbnail."
    )
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument(
        "--langs", default="orig",
        help="Comma-separated subtitle language codes (default: 'orig' = auto-detect original language)"
    )
    parser.add_argument(
        "--output-dir", default=None,
        help="Base output directory (default: same directory as this script)"
    )
    args = parser.parse_args()

    # Resolve base directory
    if args.output_dir:
        base = Path(args.output_dir).resolve()
    else:
        base = Path(__file__).resolve().parent

    langs = [l.strip() for l in args.langs.split(",") if l.strip()]

    print("=" * 60)
    print("  YouTube Video Backup")
    print("=" * 60)
    print(f"  URL:    {args.url}")
    print(f"  Langs:  {', '.join(langs)}")
    print(f"  Base:   {base}")
    print("=" * 60)

    # 1. Fetch metadata
    print("\n[1/3] Fetching metadata...")
    meta = get_metadata(args.url)

    # Resolve subtitle languages — replace "orig" placeholder with auto-detected
    if "orig" in langs:
        orig_lang = detect_original_lang(meta)
        langs = [orig_lang if l == "orig" else l for l in langs]
        print(f"  Auto-detected original language subtitle: {orig_lang}")

    # 2. Create output folder
    folder = make_output_dir(base, meta)
    print(f"\n  Output folder: {folder}\n")

    # 3. Save metadata files
    print("[2/3] Saving metadata...")
    save_metadata(folder, meta)
    save_info_summary(folder, meta)

    # 4. Download subtitles + thumbnail
    print("\n[3/3] Downloading subtitles + thumbnail...")
    download_subtitles(args.url, folder, langs)
    download_thumbnail(args.url, folder)

    print("\n" + "=" * 60)
    print("  Backup complete!")
    print(f"  Files in: {folder}")
    print("=" * 60)

    # List final contents
    for f in sorted(folder.iterdir()):
        size = f.stat().st_size
        if size > 1_000_000:
            size_str = f"{size / 1_000_000:.1f} MB"
        elif size > 1_000:
            size_str = f"{size / 1_000:.1f} KB"
        else:
            size_str = f"{size} B"
        print(f"  {size_str:>10}  {f.name}")


if __name__ == "__main__":
    main()
