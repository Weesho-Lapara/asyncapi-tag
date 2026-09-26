"""Python-Markdown extension that renders AsyncAPI documents from Markdown.

Two syntaxes are recognised:

* an HTML-like element, self-closing or paired (``<asyncapi-tag>`` is accepted as an alias)::

      <asyncapi-viewer src="events.yaml" sidebar="false"></asyncapi-viewer>

* a fenced block with the language ``asyncapi``, whose body is ``key: value``
  lines using the same names as the element's attributes (the path may also be
  given right after the language)::

      ```asyncapi
      src: events.yaml
      sidebar: false
      ```

Usage outside MkDocs::

    import markdown
    html = markdown.markdown(text, extensions=["asyncapi_viewer"])

The extension runs as a single preprocessor before fenced code is stashed. It
walks the document line by line, tracking fences itself, so ``asyncapi``
fences are recognised only at the top level (a fence nested inside a longer
fence stays code) and elements inside fenced blocks, indented code and inline
code spans are left alone.

With the default ``renderer`` (``"viewer"``) each match becomes an
``<asyncapi-viewer>`` element with kebab-case attributes, validated against the
options schema the viewer ships (see :mod:`asyncapi_viewer.options`); the first
match on a page also emits the module script and the theme stylesheet. With
``renderer="legacy"`` the 1.x output is produced instead: a container ``<div>``
with data attributes plus the React-based viewer and its runner script (see
:mod:`asyncapi_viewer.assets`). The legacy renderer stays for one major version.
"""

from __future__ import annotations

import html
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional

from markdown import Markdown
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor

from asyncapi_viewer import assets, options

log = logging.getLogger("asyncapi_viewer")

RENDERERS = ("viewer", "legacy")
AUTO = "auto"  # asset options: resolved per renderer (Python-Markdown coerces None defaults)

TAG_RE = re.compile(
    r"<asyncapi-(?:viewer|tag)\b(?P<attrs>(?:[^>'\"]|\"[^\"]*\"|'[^']*')*?)\s*/?>"
    r"(?:\s*</asyncapi-(?:viewer|tag)\s*>)?",
    re.IGNORECASE,
)
ATTR_RE = re.compile(
    r"""(?P<name>[A-Za-z_:][-A-Za-z0-9_:.]*)"""
    r"""(?:\s*=\s*(?:"(?P<dq>[^"]*)"|'(?P<sq>[^']*)'|(?P<uq>[^\s"'=<>`]+)))?"""
)

FENCE_OPEN_RE = re.compile(r"^ {0,3}(?P<fence>`{3,}|~{3,})[ \t]*(?P<info>[^`]*)$")
# A run of backticks, its content, and the same run again: an inline code span.
CODE_SPAN_RE = re.compile(r"(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)", re.S)
FENCE_LANG = "asyncapi"

# ``show.sidebar`` follows the viewer's own default (off): inside a documentation
# column the viewer uses its compact layout, where the sidebar hides behind a
# toggle button. ``expand.messageExamples`` stays on as in earlier releases.
DEFAULT_VIEWER_CONFIG: Dict[str, Any] = {
    "show": {
        "sidebar": False,
        "info": True,
        "servers": True,
        "operations": True,
        "messages": True,
        "schemas": True,
        "errors": True,
    },
    "expand": {"messageExamples": True},
}

# attribute name (case-insensitive) -> (section, key, kind)
# kind: "bool" | "enum" | "str" | "json"
_ATTRIBUTES: Dict[str, tuple] = {
    "sidebar": ("show", "sidebar", "bool"),
    "info": ("show", "info", "bool"),
    "servers": ("show", "servers", "bool"),
    "operations": ("show", "operations", "bool"),
    "messages": ("show", "messages", "bool"),
    "schemas": ("show", "schemas", "bool"),
    "errors": ("show", "errors", "bool"),
    "showmessageexamples": ("show", "messageExamples", "bool"),
    "messageexamples": ("expand", "messageExamples", "bool"),
    "showservers": ("sidebar", "showServers", "enum"),
    "showoperations": ("sidebar", "showOperations", "enum"),
    "usechanneladdressasidentifier": ("sidebar", "useChannelAddressAsIdentifier", "bool"),
    "parseroptions": (None, "parserOptions", "json"),
    "publishlabel": (None, "publishLabel", "str"),
    "subscribelabel": (None, "subscribeLabel", "str"),
    "sendlabel": (None, "sendLabel", "str"),
    "receivelabel": (None, "receiveLabel", "str"),
    "requestlabel": (None, "requestLabel", "str"),
    "replylabel": (None, "replyLabel", "str"),
    "schemaid": (None, "schemaID", "str"),
}
_ENUM_VALUES = {
    "showServers": ("byDefault", "bySpecTags", "byServersTags"),
    "showOperations": ("byDefault", "bySpecTags", "byOperationsTags"),
}
_TRUE = {"true", "1", "yes", "on"}
_FALSE = {"false", "0", "no", "off"}

WarnFn = Callable[[str], None]
ResolveFn = Callable[[str], str]


def _default_warn(message: str) -> None:
    log.warning(message)


def _default_resolve(url: str) -> str:
    return url


def parse_attributes(text: str) -> Dict[str, Optional[str]]:
    """Parse the attribute part of a tag into ``{name: value}``.

    Names are lower-cased. Bare attributes map to ``None``. Values are
    HTML-unescaped so ``&quot;`` and friends work inside them.
    """
    attrs: Dict[str, Optional[str]] = {}
    for match in ATTR_RE.finditer(text):
        name = match.group("name").lower()
        value = match.group("dq")
        if value is None:
            value = match.group("sq")
        if value is None:
            value = match.group("uq")
        attrs[name] = html.unescape(value) if value is not None else None
    return attrs


def build_viewer_config(
    attrs: Dict[str, Optional[str]], warn: WarnFn = _default_warn
) -> Dict[str, Any]:
    """Translate tag attributes into the viewer's ``config`` object.

    Unknown attributes and invalid values are reported through ``warn`` and
    skipped; the remaining attributes still apply.
    """
    config: Dict[str, Any] = json.loads(json.dumps(DEFAULT_VIEWER_CONFIG))
    for name, raw in attrs.items():
        if name in ("src", "id"):
            continue
        spec = _ATTRIBUTES.get(name)
        if spec is None:
            warn(f"<asyncapi-viewer>: unknown attribute '{name}' was ignored.")
            continue
        section, key, kind = spec
        value: Any
        if kind == "bool":
            text = "true" if raw is None else raw.strip().lower()
            if text in _TRUE:
                value = True
            elif text in _FALSE:
                value = False
            else:
                warn(f"<asyncapi-viewer>: attribute '{name}' expects true or false, got '{raw}'.")
                continue
        elif kind == "enum":
            allowed = _ENUM_VALUES[key]
            matches = [a for a in allowed if a.lower() == (raw or "").strip().lower()]
            if not matches:
                warn(
                    f"<asyncapi-viewer>: attribute '{name}' expects one of "
                    f"{', '.join(allowed)}; got '{raw}'."
                )
                continue
            value = matches[0]
        elif kind == "json":
            try:
                value = json.loads(raw or "")
            except json.JSONDecodeError as exc:
                warn(f"<asyncapi-viewer>: attribute '{name}' is not valid JSON ({exc.msg}).")
                continue
        else:
            value = raw if raw is not None else ""
        if section is None:
            config[key] = value
        else:
            config.setdefault(section, {})[key] = value
    return config


def parse_fence_body(
    lines: List[str], info_arg: str = "", warn: WarnFn = _default_warn
) -> Dict[str, Optional[str]]:
    """Parse the body of an ``asyncapi`` fence into the same shape as tag attributes.

    Each non-empty line is ``key: value`` (quotes around the value are optional
    and stripped); a line with a bare key means ``true``; ``#`` starts a comment.
    ``info_arg`` is anything after the language on the opening fence and is
    taken as ``src``.
    """
    attrs: Dict[str, Optional[str]] = {}
    src = info_arg.strip().strip("\"'")
    if src:
        attrs["src"] = src
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition(":")
        key = key.strip()
        if not key or " " in key or "\t" in key:
            warn(f"```{FENCE_LANG} block: cannot parse line '{line}'; expected 'key: value'.")
            continue
        if not sep:
            attrs[key.lower()] = None  # bare key, treated as true
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        attrs[key.lower()] = value
    return attrs


class AsyncAPIViewerPreprocessor(Preprocessor):
    def __init__(self, md: Markdown, extension: "AsyncAPIViewerExtension") -> None:
        super().__init__(md)
        self.extension = extension
        self.reset()

    def reset(self) -> None:
        self.counter = 0
        self.assets_emitted = False
        self._deprecations_reported = False

    # -- helpers -----------------------------------------------------------
    def _warn(self, message: str) -> None:
        self.extension.getConfig("warn")(message)

    def _resolve(self, url: str) -> str:
        return self.extension.getConfig("url_resolver")(url)

    def _renderer(self) -> str:
        return self.extension.getConfig("renderer")

    def _asset(self, name: str, legacy_default: str, viewer_default: str) -> str:
        value = self.extension.getConfig(name)
        if value == AUTO:
            return legacy_default if self._renderer() == "legacy" else viewer_default
        return value

    def _report_deprecations(self) -> None:
        """Extension options that mean nothing to the new renderer, warned once per document."""
        if self._deprecations_reported or self._renderer() == "legacy":
            return
        self._deprecations_reported = True
        cfg = self.extension.getConfig
        if cfg("embed_css") is not True:
            self._warn("asyncapi-viewer: the 'embed_css' option is deprecated and does nothing with the new viewer.")
        if cfg("viewer_css") != AUTO:
            self._warn("asyncapi-viewer: 'viewer_css' is deprecated; use 'viewer_theme' for the theme stylesheet.")

    def _element(self, attrs: Dict[str, Optional[str]]) -> str:
        """The ``<asyncapi-viewer>`` element with validated, kebab-case, HTML-escaped attributes."""
        self.counter += 1
        element_id = attrs.get("id") or f"{assets.CONTAINER_CLASS}-{self.counter}"
        if not attrs.get("src"):
            self._warn("asyncapi-viewer: missing required 'src'; nothing was rendered.")
        normalised = options.normalise(attrs, self._warn)
        normalised.pop("id", None)
        src = normalised.pop("src", None)
        parts = [f'id="{html.escape(element_id, quote=True)}"']
        if src:
            parts.append(f'src="{html.escape(self._resolve(src), quote=True)}"')
        for attribute, value in options.to_attributes(normalised):
            if value is None:
                parts.append(html.escape(attribute, quote=True))
            else:
                parts.append(f'{html.escape(attribute, quote=True)}="{html.escape(value, quote=True)}"')
        return f"<asyncapi-viewer {' '.join(parts)}></asyncapi-viewer>"

    def _container(self, attrs: Dict[str, Optional[str]]) -> str:
        """Legacy renderer: the 1.x container ``<div>`` with data attributes."""
        self.counter += 1
        container_id = attrs.get("id") or f"{assets.CONTAINER_CLASS}-{self.counter}"
        src = attrs.get("src")
        if not src:
            self._warn("asyncapi-viewer: missing required 'src'; nothing was rendered.")
            return (
                f'<div class="{assets.CONTAINER_CLASS} {assets.LEGACY_CLASS} {assets.CONTAINER_CLASS}-error" '
                f'id="{html.escape(container_id, quote=True)}">'
                "<p>AsyncAPI viewer: no document given (missing src).</p></div>"
            )
        config = build_viewer_config(attrs, self._warn)
        config.setdefault("schemaID", container_id)
        return (
            f'<div class="{assets.CONTAINER_CLASS} {assets.LEGACY_CLASS}" id="{html.escape(container_id, quote=True)}"'
            f' data-asyncapi-src="{html.escape(self._resolve(src), quote=True)}"'
            f' data-asyncapi-config="{html.escape(json.dumps(config), quote=True)}"></div>'
        )

    def _loader(self) -> str:
        cfg = self.extension.getConfig
        if self._renderer() == "legacy":
            js = self._asset("viewer_js", assets.VIEWER_JS_URL, "")
            css = self._asset("viewer_css", assets.VIEWER_CSS_URL, "")
            return assets.loader_html(
                js_url=self._resolve(js) if js else "",
                css_url=self._resolve(css) if css else "",
                js_integrity=self._asset("viewer_js_integrity", assets.VIEWER_JS_INTEGRITY, ""),
                css_integrity=self._asset("viewer_css_integrity", assets.VIEWER_CSS_INTEGRITY, ""),
                embed_css=cfg("embed_css"),
            )
        # New viewer: a module script and the theme stylesheet. Defaults (assets served from
        # the site) arrive with the packaged viewer; until then empty means "emit nothing".
        js = self._asset("viewer_js", "", "")
        theme = cfg("viewer_theme")
        if theme == AUTO:
            theme = self._asset("viewer_css", "", "")  # deprecated alias
        return assets.viewer_loader_html(
            js_url=self._resolve(js) if js else "",
            theme_url=self._resolve(theme) if theme else "",
            js_integrity=self._asset("viewer_js_integrity", "", ""),
            theme_integrity=self._asset("viewer_theme_integrity", "", ""),
        )

    def _block(self, attrs: Dict[str, Optional[str]]) -> str:
        """Element or container (plus the loader for the first one) as a stash placeholder."""
        self._report_deprecations()
        block = self._element(attrs) if self._renderer() == "viewer" else self._container(attrs)
        if self.extension.getConfig("load_assets") and not self.assets_emitted:
            self.assets_emitted = True
            loader = self._loader()
            if loader:
                block += "\n" + loader
        return self.md.htmlStash.store(block)

    def _replace_tags(self, text: str) -> str:
        """Replace <asyncapi-viewer> elements in prose, skipping indented code and code spans."""
        if "<asyncapi-" not in text.lower():
            return text
        spans = [m.span() for m in CODE_SPAN_RE.finditer(text)]

        def replace(match: "re.Match[str]") -> str:
            pos = match.start()
            if any(a <= pos < b for a, b in spans):
                return match.group(0)  # inside `inline code`
            line_start = text.rfind("\n", 0, pos) + 1
            indent = text[line_start:pos]
            if indent.startswith("\t") or indent.startswith("    "):
                return match.group(0)  # indented code block
            return self._block(parse_attributes(match.group("attrs")))

        return TAG_RE.sub(replace, text)

    # -- Preprocessor API ----------------------------------------------------
    def run(self, lines: List[str]) -> List[str]:
        if FENCE_LANG not in "\n".join(lines).lower():
            return lines  # neither "<asyncapi-viewer" nor an "asyncapi" fence can be present
        out: List[str] = []
        prose: List[str] = []

        def flush() -> None:
            if prose:
                out.extend(self._replace_tags("\n".join(prose)).split("\n"))
                prose.clear()

        i, n = 0, len(lines)
        while i < n:
            match = FENCE_OPEN_RE.match(lines[i])
            if match is None:
                prose.append(lines[i])
                i += 1
                continue
            fence, info = match.group("fence"), match.group("info").strip()
            close_re = re.compile(rf"^ {{0,3}}{re.escape(fence[0])}{{{len(fence)},}}[ \t]*$")
            j = i + 1
            while j < n and not close_re.match(lines[j]):
                j += 1
            lang, _, info_arg = info.partition(" ")
            flush()
            if lang.lower() == FENCE_LANG:
                attrs = parse_fence_body(lines[i + 1 : j], info_arg, self._warn)
                # blank lines keep the placeholder out of a neighbouring paragraph
                out.extend(["", self._block(attrs), ""])
            else:
                out.extend(lines[i : j + 1])  # some other fence: leave it for fenced_code
            i = j + 1
        flush()
        return out


class AsyncAPIViewerExtension(Extension):
    """Markdown extension registering :class:`AsyncAPIViewerPreprocessor`."""

    def __init__(self, **kwargs: Any) -> None:
        self.config = {
            "renderer": [
                "viewer",
                "'viewer' emits the <asyncapi-viewer> element (default); 'legacy' keeps the 1.x "
                "container and React-based viewer for one major version.",
            ],
            "viewer_js": [AUTO, "URL of the viewer script; 'auto' picks the renderer's default."],
            "viewer_js_integrity": [AUTO, "Subresource Integrity hash for viewer_js; empty to omit."],
            "viewer_theme": [AUTO, "URL of the theme stylesheet (new viewer); 'auto' picks the default."],
            "viewer_theme_integrity": [AUTO, "Subresource Integrity hash for viewer_theme; empty to omit."],
            "viewer_css": [
                AUTO,
                "Legacy renderer: URL of the viewer stylesheet. New viewer: deprecated alias of viewer_theme.",
            ],
            "viewer_css_integrity": [AUTO, "Subresource Integrity hash for viewer_css; empty to omit."],
            "embed_css": [
                True,
                "Legacy renderer: emit the small stylesheet that keeps the viewer inside its container. "
                "Deprecated and ignored by the new viewer.",
            ],
            "load_assets": [
                True,
                "Emit the viewer script and stylesheet with the first tag on a page. "
                "Set to False when you load them yourself.",
            ],
            "url_resolver": [
                _default_resolve,
                "Callable mapping the src attribute (and relative asset URLs) to the URL "
                "the browser should fetch.",
            ],
            "warn": [_default_warn, "Callable that receives warning messages."],
        }
        super().__init__(**kwargs)

    def extendMarkdown(self, md: Markdown) -> None:
        renderer = self.getConfig("renderer")
        if renderer not in RENDERERS:
            raise ValueError(f"asyncapi-viewer: renderer must be one of {', '.join(RENDERERS)}; got {renderer!r}")
        md.registerExtension(self)
        # Block-level, so the stashed element is not wrapped in a paragraph.
        for tag in ("asyncapi-viewer", "asyncapi-tag"):
            if tag not in md.block_level_elements:
                md.block_level_elements.append(tag)
        self.preprocessor = AsyncAPIViewerPreprocessor(md, self)
        # Before fenced_code / superfences (25) stash fences, so ```asyncapi blocks are
        # still visible; the preprocessor tracks other fences itself.
        md.preprocessors.register(self.preprocessor, "asyncapi_viewer", 26)

    def reset(self) -> None:
        self.preprocessor.reset()


def makeExtension(**kwargs: Any) -> AsyncAPIViewerExtension:  # noqa: N802 (Python-Markdown API)
    return AsyncAPIViewerExtension(**kwargs)


# Names from before the rename to asyncapi-viewer, kept for one major version.
AsyncAPITagExtension = AsyncAPIViewerExtension
AsyncAPITagPreprocessor = AsyncAPIViewerPreprocessor
