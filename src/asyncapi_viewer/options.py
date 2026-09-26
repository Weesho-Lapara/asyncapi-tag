"""The viewer's options, read from the schema the viewer ships.

``options.schema.json`` is the single source of truth for every ``<asyncapi-viewer>`` option:
name, type, allowed values, default and status. The viewer and this extension both read it,
so names, values and defaults never drift. The file is copied into the package from
``viewer/src/`` by ``scripts/sync_viewer.py`` (the wheel contains it; a git checkout needs the
script, or the test suite's fixture, to run first).

Rules shared with the viewer: names match case-insensitively in camelCase, kebab-case or the
lowercased form; booleans accept true/false, 1/0, yes/no, on/off, a bare attribute and an empty
value (all true); enum values match case-insensitively; JSON options must be objects with known
keys; unknown attributes and bad values warn and are skipped while the rest still apply.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

WarnFn = Callable[[str], None]

SCHEMA_PATH = Path(__file__).with_name("options.schema.json")
PREFIX = "<asyncapi-viewer>:"

_TRUE = {"true", "1", "yes", "on"}
_FALSE = {"false", "0", "no", "off"}

# HTML attributes that belong to the page, not to the viewer: passed through, never warned about.
HTML_GLOBAL = frozenset(
    {"class", "style", "slot", "hidden", "title", "lang", "dir", "role", "tabindex", "part", "exportparts", "translate", "nonce"}
)


@dataclass(frozen=True)
class OptionSpec:
    name: str
    type: str  # "string" | "boolean" | "enum" | "json"
    status: str  # "active" | "deprecated-noop"
    default: Any = None
    required: bool = False
    values: Tuple[str, ...] = ()
    keys: Dict[str, str] = field(default_factory=dict)
    spec_versions: Tuple[int, ...] = ()
    description: str = ""

    @property
    def attribute(self) -> str:
        """The kebab-case attribute name the element is written with."""
        return to_attribute_name(self.name)


def to_attribute_name(option: str) -> str:
    """``sendLabel`` -> ``send-label``."""
    return re.sub(r"[A-Z]", lambda m: "-" + m.group(0).lower(), option)


@lru_cache(maxsize=1)
def load_specs() -> Tuple[OptionSpec, ...]:
    if not SCHEMA_PATH.exists():
        raise RuntimeError(
            f"{SCHEMA_PATH.name} is missing from the asyncapi_viewer package. In a git checkout run "
            "'python scripts/sync_viewer.py' (it copies the schema from viewer/src/)."
        )
    data = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    specs = []
    for raw in data["options"]:
        specs.append(
            OptionSpec(
                name=raw["name"],
                type=raw["type"],
                status=raw.get("status", "active"),
                default=raw.get("default"),
                required=bool(raw.get("required", False)),
                values=tuple(raw.get("values", ())),
                keys=dict(raw.get("keys", {})),
                spec_versions=tuple(raw.get("specVersions", ())),
                description=raw.get("description", ""),
            )
        )
    return tuple(specs)


@lru_cache(maxsize=1)
def _by_key() -> Dict[str, OptionSpec]:
    return {spec.name.lower(): spec for spec in load_specs()}


def lookup(attribute: str) -> Optional[OptionSpec]:
    """The spec for any accepted spelling: ``sendLabel``, ``send-label``, ``sendlabel``."""
    return _by_key().get(attribute.replace("-", "").lower())


def coerce(spec: OptionSpec, raw_name: str, raw: Optional[str], warn: WarnFn) -> Tuple[bool, Any]:
    """Validate one value. Returns ``(ok, value)``; a failed value has already been reported."""
    if spec.type == "boolean":
        text = "true" if raw is None or raw.strip() == "" else raw.strip().lower()
        if text in _TRUE:
            return True, True
        if text in _FALSE:
            return True, False
        warn(f"{PREFIX} attribute '{raw_name}' expects true or false, got '{raw}'.")
        return False, None
    if spec.type == "enum":
        wanted = (raw or "").strip().lower()
        for value in spec.values:
            if value.lower() == wanted:
                return True, value
        warn(f"{PREFIX} attribute '{raw_name}' expects one of {', '.join(spec.values)}; got '{raw}'.")
        return False, None
    if spec.type == "json":
        try:
            parsed = json.loads(raw or "")
        except json.JSONDecodeError as exc:
            warn(f"{PREFIX} attribute '{raw_name}' is not valid JSON ({exc.msg}).")
            return False, None
        if not isinstance(parsed, dict):
            warn(f"{PREFIX} attribute '{raw_name}' expects a JSON object, got {json.dumps(parsed)}.")
            return False, None
        result = dict(spec.default or {})
        kinds = {"boolean": bool, "string": str, "number": (int, float)}
        for key, value in parsed.items():
            expected = spec.keys.get(key)
            if expected is None:
                warn(f"{PREFIX} {spec.name}.{key} is not supported and was ignored.")
            elif not isinstance(value, kinds[expected]) or (expected == "number" and isinstance(value, bool)):
                warn(f"{PREFIX} {spec.name}.{key} expects a {expected}, got {json.dumps(value)}.")
            else:
                result[key] = value
        return True, result
    return True, raw if raw is not None else ""


def normalise(attrs: Dict[str, Optional[str]], warn: WarnFn) -> Dict[str, Any]:
    """Tag attributes (any spelling, raw strings) -> ``{canonical name: validated value}``.

    ``src`` and ``id`` pass through as strings. HTML global attributes and ``data-``/``aria-``
    names are kept under their own names so they reach the element untouched.
    """
    out: Dict[str, Any] = {}
    for raw_name, raw in attrs.items():
        name = raw_name.lower()
        if name in HTML_GLOBAL or name.startswith(("data-", "aria-")):
            out[name] = raw
            continue
        spec = lookup(name)
        if spec is None:
            warn(f"{PREFIX} unknown attribute '{raw_name}' was ignored.")
            continue
        if spec.status == "deprecated-noop":
            warn(f"{PREFIX} attribute '{raw_name}' is deprecated and does nothing.")
            continue
        if spec.name in ("src", "id"):
            if raw:
                out[spec.name] = raw
            continue
        ok, value = coerce(spec, raw_name, raw, warn)
        if ok:
            out[spec.name] = value
    return out


def to_attributes(options: Dict[str, Any]) -> List[Tuple[str, Optional[str]]]:
    """Validated options -> ``[(attribute, value)]`` for the element; ``None`` is a bare attribute."""
    pairs: List[Tuple[str, Optional[str]]] = []
    for name, value in options.items():
        spec = lookup(name) if not (name in HTML_GLOBAL or name.startswith(("data-", "aria-"))) else None
        attribute = spec.attribute if spec else name
        if isinstance(value, bool):
            pairs.append((attribute, None if value else "false"))
        elif isinstance(value, dict):
            pairs.append((attribute, json.dumps(value, separators=(",", ":"))))
        elif value is None:
            pairs.append((attribute, None))
        else:
            pairs.append((attribute, str(value)))
    return pairs
