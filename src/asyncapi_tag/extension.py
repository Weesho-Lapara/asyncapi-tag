"""Python-Markdown extension that renders AsyncAPI documents from Markdown.

Two syntaxes are recognised:

* an HTML-like element, self-closing or paired::

      <asyncapi-tag src="events.yaml" sidebar="false"></asyncapi-tag>

* a fenced block with the language ``asyncapi``, whose body is ``key: value``
  lines using the same names as the element's attributes (the path may also be
  given right after the language)::

      ```asyncapi
      src: events.yaml
      sidebar: false
      ```

Usage outside MkDocs::

    import markdown
    html = markdown.markdown(text, extensions=["asyncapi_tag"])

The extension runs as a single preprocessor before fenced code is stashed. It
walks the document line by line, tracking fences itself, so ``asyncapi``
fences are recognised only at the top level (a fence nested inside a longer
fence stays code) and elements inside fenced blocks, indented code and inline
code spans are left alone. Each match becomes a container ``<div>`` carrying
the document URL and the viewer configuration as data attributes. The first
match on a page also emits the viewer's stylesheet, script and a small runner
script (see :mod:`asyncapi_tag.assets`).
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

from asyncapi_tag import assets

log = logging.getLogger("asyncapi_tag")

TAG_RE = re.compile(
    r"<asyncapi-tag\b(?P<attrs>(?:[^>'\"]|\"[^\"]*\"|'[^']*')*?)\s*/?>"
    r"(?:\s*</asyncapi-tag\s*>)?",
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
            warn(f"<asyncapi-tag>: unknown attribute '{name}' was ignored.")
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
                warn(f"<asyncapi-tag>: attribute '{name}' expects true or false, got '{raw}'.")
                continue
        elif kind == "enum":
            allowed = _ENUM_VALUES[key]
            matches = [a for a in allowed if a.lower() == (raw or "").strip().lower()]
            if not matches:
                warn(
                    f"<asyncapi-tag>: attribute '{name}' expects one of "
                    f"{', '.join(allowed)}; got '{raw}'."
                )
                continue
            value = matches[0]
        elif kind == "json":
            try:
                value = json.loads(raw or "")
            except json.JSONDecodeError as exc:
                warn(f"<asyncapi-tag>: attribute '{name}' is not valid JSON ({exc.msg}).")
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


class AsyncAPITagPreprocessor(Preprocessor):
    def __init__(self, md: Markdown, extension: "AsyncAPITagExtension") -> None:
        super().__init__(md)
        self.extension = extension
        self.reset()

    def reset(self) -> None:
        self.counter = 0
        self.assets_emitted = False

    # -- helpers -----------------------------------------------------------
    def _warn(self, message: str) -> None:
        self.extension.getConfig("warn")(message)

    def _resolve(self, url: str) -> str:
        return self.extension.getConfig("url_resolver")(url)

    def _container(self, attrs: Dict[str, Optional[str]]) -> str:
        self.counter += 1
        container_id = attrs.get("id") or f"{assets.CONTAINER_CLASS}-{self.counter}"
        src = attrs.get("src")
        if not src:
            self._warn("asyncapi-tag: missing required 'src'; nothing was rendered.")
            return (
                f'<div class="{assets.CONTAINER_CLASS} {assets.CONTAINER_CLASS}-error" '
                f'id="{html.escape(container_id, quote=True)}">'
                "<p>AsyncAPI viewer: no document given (missing src).</p></div>"
            )
        config = build_viewer_config(attrs, self._warn)
        config.setdefault("schemaID", container_id)
        return (
            f'<div class="{assets.CONTAINER_CLASS}" id="{html.escape(container_id, quote=True)}"'
            f' data-asyncapi-src="{html.escape(self._resolve(src), quote=True)}"'
            f' data-asyncapi-config="{html.escape(json.dumps(config), quote=True)}"></div>'
        )

    def _loader(self) -> str:
        cfg = self.extension.getConfig
        return assets.loader_html(
            js_url=self._resolve(cfg("viewer_js")) if cfg("viewer_js") else "",
            css_url=self._resolve(cfg("viewer_css")) if cfg("viewer_css") else "",
            js_integrity=cfg("viewer_js_integrity"),
            css_integrity=cfg("viewer_css_integrity"),
            embed_css=cfg("embed_css"),
        )

    def _block(self, attrs: Dict[str, Optional[str]]) -> str:
        """Container (plus the loader for the first one on the page) as a stash placeholder."""
        block = self._container(attrs)
        if self.extension.getConfig("load_assets") and not self.assets_emitted:
            self.assets_emitted = True
            block += "\n" + self._loader()
        return self.md.htmlStash.store(block)

    def _replace_tags(self, text: str) -> str:
        """Replace <asyncapi-tag> elements in prose, skipping indented code and code spans."""
        if "<asyncapi-tag" not in text.lower():
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
            return lines  # neither "<asyncapi-tag" nor an "asyncapi" fence can be present
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


class AsyncAPITagExtension(Extension):
    """Markdown extension registering :class:`AsyncAPITagPreprocessor`."""

    def __init__(self, **kwargs: Any) -> None:
        self.config = {
            "viewer_js": [assets.VIEWER_JS_URL, "URL of the AsyncAPI standalone viewer script."],
            "viewer_js_integrity": [
                assets.VIEWER_JS_INTEGRITY,
                "Subresource Integrity hash for viewer_js; empty to omit.",
            ],
            "viewer_css": [assets.VIEWER_CSS_URL, "URL of the viewer stylesheet."],
            "viewer_css_integrity": [
                assets.VIEWER_CSS_INTEGRITY,
                "Subresource Integrity hash for viewer_css; empty to omit.",
            ],
            "embed_css": [
                True,
                "Emit the small stylesheet that keeps the viewer inside its container.",
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
        md.registerExtension(self)
        self.preprocessor = AsyncAPITagPreprocessor(md, self)
        # Before fenced_code / superfences (25) stash fences, so ```asyncapi blocks are
        # still visible; the preprocessor tracks other fences itself.
        md.preprocessors.register(self.preprocessor, "asyncapi_tag", 26)

    def reset(self) -> None:
        self.preprocessor.reset()


def makeExtension(**kwargs: Any) -> AsyncAPITagExtension:  # noqa: N802 (Python-Markdown API)
    return AsyncAPITagExtension(**kwargs)
