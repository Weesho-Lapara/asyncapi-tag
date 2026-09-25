#!/usr/bin/env python3
"""Pin the viewer to a new @asyncapi/react-component version.

Usage:
    python scripts/update_viewer.py            # latest version on npm
    python scripts/update_viewer.py 3.2.1      # a specific version
    python scripts/update_viewer.py --check    # exit 1 if a newer version exists

Downloads the standalone bundle and stylesheet, computes their SRI hashes,
rewrites the constants in src/asyncapi_tag/assets.py and adds a line under
"## Unreleased" in CHANGELOG.md. Prints "old=<v> new=<v>" on the last line so
automation can pick the versions up. Review the upstream changelog before
committing the result.
"""

from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import ssl
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "src" / "asyncapi_tag" / "assets.py"
CHANGELOG = ROOT / "CHANGELOG.md"
CDN = "https://unpkg.com/@asyncapi/react-component@{version}/"
JS_PATH = "browser/standalone/index.js"
CSS_PATH = "styles/default.min.css"


def _ssl_context():
    """Use certifi's CA bundle when available (python.org builds on macOS ship without one)."""
    try:
        import certifi
    except ImportError:
        return None
    return ssl.create_default_context(cafile=certifi.where())


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60, context=_ssl_context()) as response:  # noqa: S310
        return response.read()


def sri(data: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()


def current_version() -> str:
    match = re.search(r'^VIEWER_VERSION = "(.*)"$', ASSETS.read_text(), re.M)
    if not match:
        raise SystemExit(f"error: VIEWER_VERSION not found in {ASSETS}")
    return match.group(1)


def latest_version() -> str:
    meta = json.loads(fetch("https://registry.npmjs.org/@asyncapi/react-component/latest"))
    return meta["version"]


def add_changelog_entry(old: str, new: str) -> None:
    text = CHANGELOG.read_text()
    line = (
        f"- Pin the viewer to `@asyncapi/react-component` {new} (was {old}). "
        f"See https://github.com/asyncapi/asyncapi-react/releases/tag/v{new}\n"
    )
    if "## Unreleased" in text:
        head, _, tail = text.partition("## Unreleased\n")
        text = head + "## Unreleased\n\n" + line + tail.lstrip("\n")
    else:
        head, sep, tail = text.partition("\n## ")
        text = head.rstrip("\n") + "\n\n## Unreleased\n\n" + line + ("\n## " + tail if sep else "")
    CHANGELOG.write_text(text)


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    check_only = "--check" in argv
    old = current_version()
    version = args[0].lstrip("v") if args else latest_version()
    if check_only:
        print(f"old={old} new={version}")
        return 1 if version != old else 0
    if version == old:
        print(f"already at {version}")
        print(f"old={old} new={version}")
        return 0
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
    add_changelog_entry(old, version)
    for name, value in replacements.items():
        print(f"{name} = {value}")
    print(f"old={old} new={version}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
