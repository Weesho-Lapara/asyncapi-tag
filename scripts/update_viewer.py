#!/usr/bin/env python3
"""Pin the viewer to a new @asyncapi/react-component version.

Usage:
    python scripts/update_viewer.py            # latest version on npm
    python scripts/update_viewer.py 3.2.1      # a specific version

Downloads the standalone bundle and stylesheet, computes their SRI hashes and
rewrites the constants in src/asyncapi_tag/assets.py. Review the upstream
changelog and rebuild the docs before committing the result.
"""

from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import sys
import urllib.request

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "src" / "asyncapi_tag" / "assets.py"
CDN = "https://unpkg.com/@asyncapi/react-component@{version}/"
JS_PATH = "browser/standalone/index.js"
CSS_PATH = "styles/default.min.css"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 (fixed hosts)
        return response.read()


def sri(data: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        version = argv[1].lstrip("v")
    else:
        meta = json.loads(fetch("https://registry.npmjs.org/@asyncapi/react-component/latest"))
        version = meta["version"]
    base = CDN.format(version=version)
    js_url, css_url = base + JS_PATH, base + CSS_PATH
    js_hash, css_hash = sri(fetch(js_url)), sri(fetch(css_url))

    text = ASSETS.read_text()
    replacements = {
        "VIEWER_VERSION": version,
        "VIEWER_JS_URL": js_url,
        "VIEWER_JS_INTEGRITY": js_hash,
        "VIEWER_CSS_URL": css_url,
        "VIEWER_CSS_INTEGRITY": css_hash,
    }
    for name, value in replacements.items():
        text, count = re.subn(rf'^{name} = ".*"$', f'{name} = "{value}"', text, flags=re.M)
        if count != 1:
            print(f"error: expected exactly one line for {name} in {ASSETS}", file=sys.stderr)
            return 1
    ASSETS.write_text(text)
    for name, value in replacements.items():
        print(f"{name} = {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
