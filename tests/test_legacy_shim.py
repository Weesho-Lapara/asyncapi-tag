"""The legacy `asyncapi-tag` shim is not installed in the test environment; import it by path."""

from __future__ import annotations

import importlib
import sys
import warnings
from pathlib import Path

LEGACY = Path(__file__).resolve().parent.parent / "legacy" / "asyncapi-tag"


def _fresh_import(name: str, monkeypatch):
    monkeypatch.syspath_prepend(str(LEGACY))
    for mod in list(sys.modules):
        if mod == "asyncapi_tag" or mod.startswith("asyncapi_tag."):
            monkeypatch.delitem(sys.modules, mod)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        module = importlib.import_module(name)
    return module, caught


def test_shim_warns_and_reexports(monkeypatch):
    module, caught = _fresh_import("asyncapi_tag", monkeypatch)
    assert any(issubclass(w.category, DeprecationWarning) and "asyncapi-viewer" in str(w.message) for w in caught)
    import asyncapi_viewer

    assert module.AsyncAPITagExtension is asyncapi_viewer.AsyncAPIViewerExtension
    assert module.__version__ == asyncapi_viewer.__version__
    plugin_mod, _ = _fresh_import("asyncapi_tag.mkdocs_plugin", monkeypatch)
    from asyncapi_viewer.mkdocs_plugin import AsyncAPIPlugin

    assert plugin_mod.AsyncAPIPlugin is AsyncAPIPlugin
    assets_mod, _ = _fresh_import("asyncapi_tag.assets", monkeypatch)
    from asyncapi_viewer import assets

    assert assets_mod.RUNNER_JS is assets.RUNNER_JS


def test_shim_declares_no_entry_points_and_depends_on_the_new_name():
    text = (LEGACY / "pyproject.toml").read_text()
    assert "entry-points" not in text.replace("# Deliberately no entry points", "")
    assert "asyncapi-viewer[mkdocs]" in text
