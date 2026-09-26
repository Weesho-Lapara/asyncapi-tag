#!/usr/bin/env python3
"""Copy the viewer's generated files into the Python package.

The options schema and the built viewer live in ``viewer/`` (a Node project) and are never
committed under ``src/``; the wheel must contain them. Run after ``npm --prefix viewer run
build``::

    python scripts/sync_viewer.py            # copy schema and, when built, dist/ and the theme
    python scripts/sync_viewer.py --check    # exit 1 when the copies are missing or stale

The test suite copies the schema by itself (see tests/conftest.py); the built files are only
needed for the asset tests and the wheel.
"""

from __future__ import annotations

import base64
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIEWER = ROOT / "viewer"
PACKAGE = ROOT / "src" / "asyncapi_viewer"

SCHEMA_SRC = VIEWER / "src" / "options.schema.json"
SCHEMA_DST = PACKAGE / "options.schema.json"
STATIC_DST = PACKAGE / "static"
STATIC_FILES = {
    VIEWER / "dist" / "asyncapi-viewer.js": STATIC_DST / "asyncapi-viewer.js",
    VIEWER / "dist" / "asyncapi-viewer.iife.js": STATIC_DST / "asyncapi-viewer.iife.js",
    VIEWER / "theme" / "asyncapi-theme.css": STATIC_DST / "asyncapi-theme.css",
}


def stale(src: Path, dst: Path) -> bool:
    return not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime or src.read_bytes() != dst.read_bytes()


def sync_schema() -> bool:
    """Copy the options schema. Returns True when a copy was made."""
    if not SCHEMA_SRC.exists():
        raise SystemExit(f"{SCHEMA_SRC} not found: is this a full checkout with the viewer/ folder?")
    if stale(SCHEMA_SRC, SCHEMA_DST):
        SCHEMA_DST.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SCHEMA_SRC, SCHEMA_DST)
        return True
    return False


def sri(path: Path) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(path.read_bytes()).digest()).decode("ascii")


def sync_static() -> list[str]:
    """Copy the built viewer and theme when present and write static/manifest.json.

    The manifest carries the viewer version (from viewer/package.json) and the SRI hash of
    each file; the extension uses it for the CDN URLs and integrity attributes.
    """
    copied = []
    for src, dst in STATIC_FILES.items():
        if src.exists() and stale(src, dst):
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
            copied.append(dst.name)
    present = [dst for dst in STATIC_FILES.values() if dst.exists()]
    if present:
        version = json.loads((VIEWER / "package.json").read_text(encoding="utf-8"))["version"]
        manifest = {"version": version, "files": {dst.name: sri(dst) for dst in present}}
        manifest_path = STATIC_DST / "manifest.json"
        text = json.dumps(manifest, indent=2) + "\n"
        if not manifest_path.exists() or manifest_path.read_text(encoding="utf-8") != text:
            manifest_path.write_text(text, encoding="utf-8")
            copied.append(manifest_path.name)
    return copied


def main(argv: list[str]) -> int:
    if "--check" in argv:
        problems = []
        if stale(SCHEMA_SRC, SCHEMA_DST):
            problems.append(f"{SCHEMA_DST.relative_to(ROOT)} is missing or stale")
        for src, dst in STATIC_FILES.items():
            if not src.exists():
                problems.append(f"{src.relative_to(ROOT)} is not built (npm --prefix viewer run build)")
            elif stale(src, dst):
                problems.append(f"{dst.relative_to(ROOT)} is missing or stale")
        for p in problems:
            print(p)
        return 1 if problems else 0
    if sync_schema():
        print(f"copied {SCHEMA_DST.relative_to(ROOT)}")
    for name in sync_static():
        print(f"copied {(STATIC_DST / name).relative_to(ROOT)}")
    missing = [src for src in STATIC_FILES if not src.exists()]
    if missing:
        print("not built yet (run npm --prefix viewer run build):", ", ".join(str(m.relative_to(ROOT)) for m in missing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
