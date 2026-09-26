"""Pinned viewer assets and the browser-side loader.

The viewer is the standalone bundle of ``@asyncapi/react-component``. The
version, URLs and Subresource Integrity hashes below are updated together
with ``scripts/update_viewer.py``; do not edit them by hand.
"""

from __future__ import annotations

import html
import json
import shutil
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

# --- managed by scripts/update_viewer.py ------------------------------------
VIEWER_VERSION = "3.2.1"
VIEWER_JS_URL = "https://unpkg.com/@asyncapi/react-component@3.2.1/browser/standalone/index.js"
VIEWER_JS_INTEGRITY = "sha384-wy5bSOazlkSKMGH7XMW6+pK8ho8+rCPr7mTqKdAb/dvfwXAPWCFivgr3C7wJMFAh"
VIEWER_CSS_URL = "https://unpkg.com/@asyncapi/react-component@3.2.1/styles/default.min.css"
VIEWER_CSS_INTEGRITY = "sha384-oo9RoQcacP++XdMX6CjTucTvASEORHX3chFik0/V2kHcsHiVboGyWZztGeq/0bum"
# ---------------------------------------------------------------------------

CONTAINER_CLASS = "asyncapi-viewer"
LEGACY_CLASS = "asyncapi-tag"  # also set on containers so pre-rename CSS keeps applying

# --- the new viewer (2.0), shipped inside the wheel -------------------------
# scripts/sync_viewer.py copies the built files from viewer/ into static/ together with
# manifest.json (viewer version and SRI hashes). A git checkout has them only after the
# Node build and the script have run; the wheel always has them.
STATIC_DIR = Path(__file__).with_name("static")
VIEWER_MODULE = "asyncapi-viewer.js"  # ES module: the default (deferred, runs once per URL)
VIEWER_IIFE = "asyncapi-viewer.iife.js"  # classic script for pages that cannot use modules
VIEWER_THEME = "asyncapi-theme.css"
VIEWER_FILES = (VIEWER_MODULE, VIEWER_IIFE, VIEWER_THEME)
#: Site-relative folder the MkDocs plugin publishes the viewer to.
SITE_ASSET_DIR = "assets/asyncapi-viewer"
CDN_BASE = "https://cdn.jsdelivr.net/npm/asyncapi-viewer@{version}/"
CDN_PATHS = {VIEWER_MODULE: "dist/", VIEWER_IIFE: "dist/", VIEWER_THEME: "theme/"}


@lru_cache(maxsize=1)
def manifest() -> Optional[Dict[str, object]]:
    """The packaged viewer's manifest, or None when the viewer is not packaged."""
    path = STATIC_DIR / "manifest.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def packaged() -> bool:
    """True when the built viewer is inside this installation."""
    return manifest() is not None and all((STATIC_DIR / name).exists() for name in VIEWER_FILES)


def viewer_version() -> str:
    """The packaged viewer's version (the npm package version), or an empty string."""
    m = manifest()
    return str(m["version"]) if m else ""


def static_path(name: str) -> Path:
    """Path of a packaged viewer file (`VIEWER_MODULE`, `VIEWER_IIFE`, `VIEWER_THEME`)."""
    if name not in VIEWER_FILES:
        raise ValueError(f"unknown viewer file {name!r}; expected one of {', '.join(VIEWER_FILES)}")
    path = STATIC_DIR / name
    if not path.exists():
        raise FileNotFoundError(
            f"{path} is missing: the viewer is not packaged in this installation. In a git checkout run "
            "'npm --prefix viewer run build && python scripts/sync_viewer.py'."
        )
    return path


def integrity(name: str) -> str:
    """The Subresource Integrity hash of a packaged viewer file, or an empty string."""
    m = manifest()
    files = m["files"] if m else {}
    return str(files.get(name, "")) if isinstance(files, dict) else ""


def cdn_url(name: str) -> str:
    """The jsDelivr URL of a packaged viewer file at the packaged version, or an empty string."""
    version = viewer_version()
    if not version:
        return ""
    return CDN_BASE.format(version=version) + CDN_PATHS[name] + name


def copy_assets(dest_dir: "str | Path") -> Dict[str, str]:
    """Copy the viewer files into ``dest_dir`` and return ``{file name: integrity hash}``.

    For sites that serve the viewer themselves: point ``viewer_js`` at the copied module (or
    IIFE) and ``viewer_theme`` at the copied theme, and pass the hashes as the integrity options.
    """
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    out = {}
    for name in VIEWER_FILES:
        shutil.copyfile(static_path(name), dest / name)
        out[name] = integrity(name)
    return out


# The viewer is designed for a full-width page. Inside a documentation column it
# switches to its compact layout (container queries), whose sidebar toggle and
# sidebar overlay are position: fixed and whose centre panel refuses to shrink
# below its content, and its panels carry z-index 10-30, which beats a theme's
# sticky header (Material's is 4). This keeps all of it inside the container:
# z-index: 0 on the container opens a stacking context that confines them.
EMBED_CSS = """\
.asyncapi-viewer { position: relative; z-index: 0; max-width: 100%; }
.asyncapi-viewer .aui-root .panel--center { min-width: 0; }
.asyncapi-viewer .aui-root pre { overflow-x: auto; }
.asyncapi-viewer .aui-root .fixed { position: absolute; }
.asyncapi-viewer .aui-root .burger-menu { top: 1rem; right: 1rem; bottom: auto; }
.asyncapi-viewer .aui-root .max-h-screen { max-height: none; }
.asyncapi-viewer .aui-root .h-screen { height: 100%; }
.asyncapi-viewer-error { padding: .75rem 1rem; border-left: .25rem solid #ef5552; background: rgba(239, 85, 82, .1); }
"""

# Runs once per page. It finds every container the extension emitted, fetches
# the AsyncAPI document as text (JSON or YAML, the viewer parses both) and
# renders it. Nothing from the Markdown source is interpolated into this
# script: per-tag data travels in HTML data attributes, which are HTML-escaped.
RUNNER_JS = """\
(function () {
  "use strict";
  var SELECTOR = ".asyncapi-viewer[data-asyncapi-src]";
  function showError(el, message) {
    el.setAttribute("data-asyncapi-state", "error");
    el.textContent = "";
    var p = document.createElement("p");
    p.className = "asyncapi-viewer-error";
    p.textContent = "AsyncAPI viewer: " + message;
    el.appendChild(p);
  }
  function render(el) {
    if (el.getAttribute("data-asyncapi-state")) { return; }
    el.setAttribute("data-asyncapi-state", "loading");
    var src = el.getAttribute("data-asyncapi-src");
    var config = {};
    try {
      config = JSON.parse(el.getAttribute("data-asyncapi-config") || "{}");
    } catch (err) {
      showError(el, "invalid configuration (" + err.message + ")");
      return;
    }
    if (!window.AsyncApiStandalone) {
      showError(el, "the viewer script did not load; check the browser console and any Content Security Policy.");
      return;
    }
    fetch(src, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) {
        throw new Error("could not load " + src + " (HTTP " + response.status + ")");
      }
      return response.text();
    }, function (err) {
      /* Network-level failure: browsers report it tersely ("Failed to fetch", "Load failed"). */
      throw new Error("could not load " + src + " (" + (err && err.message ? err.message : err) + ")");
    }).then(function (text) {
      return window.AsyncApiStandalone.render({ schema: text, config: config }, el);
    }).then(function () {
      el.setAttribute("data-asyncapi-state", "rendered");
    }).catch(function (err) {
      showError(el, err && err.message ? err.message : String(err));
      if (window.console) { console.error("asyncapi-viewer:", err); }
    });
  }
  function renderAll() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) { render(nodes[i]); }
  }
  function subscribe() {
    /* Material for MkDocs instant navigation swaps page content without a reload. */
    if (window.__asyncapiTagSubscribed) { return; }
    if (window.document$ && typeof window.document$.subscribe === "function") {
      window.__asyncapiTagSubscribed = true;
      window.document$.subscribe(renderAll);
    }
  }
  /* This script sits right after the first container, so on a full page load the
     later containers and the theme's own scripts are not parsed yet. Render what is
     there now, then again once the document is complete. */
  renderAll();
  subscribe();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { renderAll(); subscribe(); });
  }
})();
"""


def _attr(name: str, value: str) -> str:
    return f' {name}="{html.escape(value, quote=True)}"'


def viewer_loader_html(
    js_url: str,
    theme_url: str,
    js_integrity: str = "",
    theme_integrity: str = "",
) -> str:
    """Return the HTML that loads the new viewer: a module script and the theme stylesheet.

    The element renders itself, so there is no runner script. Each part is emitted only when
    its URL is set; integrity attributes only when a hash is given.
    """
    parts = []
    if theme_url:
        attrs = _attr("rel", "stylesheet") + _attr("href", theme_url)
        if theme_integrity:
            attrs += _attr("integrity", theme_integrity) + _attr("crossorigin", "anonymous")
        parts.append(f"<link{attrs}>")
    if js_url:
        attrs = _attr("type", "module") + _attr("src", js_url)
        if js_integrity:
            attrs += _attr("integrity", js_integrity) + _attr("crossorigin", "anonymous")
        parts.append(f"<script{attrs}></script>")
    return "\n".join(parts)


def loader_html(
    js_url: str,
    css_url: str,
    js_integrity: str = "",
    css_integrity: str = "",
    embed_css: bool = True,
) -> str:
    """Return the HTML that loads the viewer and runs it on the page.

    Integrity attributes are emitted only when a hash is given, so the loader
    also works for self-hosted copies of the viewer. ``embed_css`` adds the
    small stylesheet that keeps the viewer inside its container.
    """
    parts = []
    if embed_css:
        parts.append(f"<style>{EMBED_CSS}</style>")
    if css_url:
        attrs = _attr("rel", "stylesheet") + _attr("href", css_url)
        if css_integrity:
            attrs += _attr("integrity", css_integrity) + _attr("crossorigin", "anonymous")
        parts.append(f"<link{attrs}>")
    if js_url:
        attrs = _attr("src", js_url)
        if js_integrity:
            attrs += _attr("integrity", js_integrity) + _attr("crossorigin", "anonymous")
        parts.append(f"<script{attrs}></script>")
    parts.append(f"<script>{RUNNER_JS}</script>")
    return "\n".join(parts)
