"""The legacy package is not installed in the test environment; import it by path."""

from __future__ import annotations

import importlib
import sys
import warnings
from pathlib import Path

LEGACY = Path(__file__).resolve().parent.parent / "legacy" / "mkdocs-asyncapi-tag-plugin"


def test_shim_warns_and_reexports_plugin(monkeypatch):
    monkeypatch.syspath_prepend(str(LEGACY))
    for name in list(sys.modules):
        if name.startswith("mkdocs_asyncapi_tag"):
            monkeypatch.delitem(sys.modules, name)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        module = importlib.import_module("mkdocs_asyncapi_tag.mkdocs_asyncapi_plugin")
    assert any(issubclass(w.category, DeprecationWarning) and "asyncapi-tag" in str(w.message) for w in caught)
    from asyncapi_tag.mkdocs_plugin import AsyncAPIPlugin

    assert module.AsyncAPIPlugin is AsyncAPIPlugin


def test_shim_has_no_plugin_entry_point():
    text = (LEGACY / "pyproject.toml").read_text()
    assert '[project.entry-points."mkdocs.plugins"]' not in text
    assert "asyncapi-tag[mkdocs]" in text
