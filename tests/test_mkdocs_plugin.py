from __future__ import annotations

import logging
import re
from pathlib import Path

import pytest
from mkdocs.commands.build import build
from mkdocs.config import load_config
from mkdocs.exceptions import Abort

from asyncapi_tag import assets
from tests.conftest import MINIMAL_SCHEMA, MINIMAL_SCHEMA_YAML


def write_site(root: Path, mkdocs_yml: str, pages: dict[str, str]) -> Path:
    docs = root / "docs"
    docs.mkdir(parents=True, exist_ok=True)
    (root / "mkdocs.yml").write_text(mkdocs_yml)
    for name, content in pages.items():
        path = docs / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    return root / "mkdocs.yml"


def build_site(config_file: Path, strict: bool = True) -> Path:
    cfg = load_config(config_file=str(config_file), strict=strict)
    build(cfg)
    return Path(cfg["site_dir"])


BASIC_YML = "site_name: Demo\nplugins:\n  - asyncapi-tag\n"


def src_of(html_text: str) -> list[str]:
    return re.findall(r'data-asyncapi-src="([^"]*)"', html_text)


def test_relative_src_resolves_from_each_page(tmp_path):
    cfg = write_site(
        tmp_path,
        BASIC_YML,
        {
            "schema.json": MINIMAL_SCHEMA,
            "api/spec.yaml": MINIMAL_SCHEMA_YAML,
            "index.md": '# Home\n\n<asyncapi-tag src="schema.json"/>\n',
            "api/nested.md": '# Nested\n\n<asyncapi-tag src="../schema.json"/>\n\n<asyncapi-tag src="spec.yaml"/>\n',
            "abs.md": '# Abs\n\n<asyncapi-tag src="/api/spec.yaml"/>\n',
        },
    )
    site = build_site(cfg)
    assert src_of((site / "index.html").read_text()) == ["schema.json"]
    # the page is served from /api/nested/, so both targets are one level up
    assert src_of((site / "api/nested/index.html").read_text()) == ["../../schema.json", "../spec.yaml"]
    assert src_of((site / "abs/index.html").read_text()) == ["../api/spec.yaml"]
    # the schema files are in the site without any plugin help
    assert (site / "schema.json").exists() and (site / "api/spec.yaml").exists()
    # no build-machine paths leak into the output
    for page in site.rglob("*.html"):
        assert str(tmp_path) not in page.read_text()


def test_use_directory_urls_false(tmp_path):
    cfg = write_site(
        tmp_path,
        BASIC_YML + "use_directory_urls: false\n",
        {"schema.json": MINIMAL_SCHEMA, "api/nested.md": '<asyncapi-tag src="../schema.json"/>\n'},
    )
    site = build_site(cfg)
    assert src_of((site / "api/nested.html").read_text()) == ["../schema.json"]


def test_external_urls_pass_through(tmp_path):
    cfg = write_site(
        tmp_path,
        BASIC_YML,
        {"index.md": '<asyncapi-tag src="https://example.com/asyncapi.yaml"/>\n'},
    )
    site = build_site(cfg)
    assert src_of((site / "index.html").read_text()) == ["https://example.com/asyncapi.yaml"]


def test_missing_document_fails_strict_build_and_warns(tmp_path, caplog):
    cfg = write_site(tmp_path, BASIC_YML, {"index.md": '<asyncapi-tag src="nope.yaml"/>\n'})
    with caplog.at_level(logging.WARNING, logger="mkdocs"):
        with pytest.raises(Abort):
            build_site(cfg, strict=True)
    assert any("nope.yaml" in r.getMessage() and "not found" in r.getMessage() for r in caplog.records)
    # non-strict build still succeeds and leaves the src untouched
    site = build_site(cfg, strict=False)
    assert src_of((site / "index.html").read_text()) == ["nope.yaml"]


def test_invalid_attribute_is_a_mkdocs_warning(tmp_path, caplog):
    cfg = write_site(
        tmp_path,
        BASIC_YML,
        {"schema.json": MINIMAL_SCHEMA, "index.md": '<asyncapi-tag src="schema.json" sidebar="maybe"/>\n'},
    )
    with caplog.at_level(logging.WARNING, logger="mkdocs"), pytest.raises(Abort):
        build_site(cfg, strict=True)
    assert any("expects true or false" in r.getMessage() for r in caplog.records)


def test_assets_once_per_page_and_plugin_options(tmp_path):
    cfg = write_site(
        tmp_path,
        "site_name: Demo\nplugins:\n  - asyncapi-tag:\n      viewer_js: js/viewer.js\n      viewer_js_integrity: ''\n"
        "      viewer_css: https://cdn.example.com/viewer.css\n      viewer_css_integrity: 'sha384-abc'\n",
        {
            "schema.json": MINIMAL_SCHEMA,
            "js/viewer.js": "// local copy",
            "index.md": '<asyncapi-tag src="schema.json"/>\n\n<asyncapi-tag src="schema.json"/>\n',
            "api/page.md": '<asyncapi-tag src="../schema.json"/>\n',
        },
    )
    site = build_site(cfg)
    index = (site / "index.html").read_text()
    assert index.count('<script src="js/viewer.js"></script>') == 1
    assert index.count("querySelectorAll") == 1
    assert 'href="https://cdn.example.com/viewer.css" integrity="sha384-abc" crossorigin="anonymous"' in index
    nested = (site / "api/page/index.html").read_text()
    assert '<script src="../../js/viewer.js"></script>' in nested


def test_load_assets_false(tmp_path):
    cfg = write_site(
        tmp_path,
        "site_name: Demo\nplugins:\n  - asyncapi-tag:\n      load_assets: false\n",
        {"schema.json": MINIMAL_SCHEMA, "index.md": '<asyncapi-tag src="schema.json"/>\n'},
    )
    index = (build_site(cfg) / "index.html").read_text()
    assert "data-asyncapi-src" in index
    assert assets.VIEWER_JS_URL not in index and "querySelectorAll" not in index


def test_default_assets_are_pinned_with_integrity(tmp_path):
    cfg = write_site(tmp_path, BASIC_YML, {"schema.json": MINIMAL_SCHEMA, "index.md": '<asyncapi-tag src="schema.json"/>\n'})
    index = (build_site(cfg) / "index.html").read_text()
    assert f'src="{assets.VIEWER_JS_URL}" integrity="{assets.VIEWER_JS_INTEGRITY}"' in index
    assert f'href="{assets.VIEWER_CSS_URL}" integrity="{assets.VIEWER_CSS_INTEGRITY}"' in index


def test_deprecated_asyncapi_file_option_warns_but_works(tmp_path, caplog):
    cfg = write_site(
        tmp_path,
        "site_name: Demo\nplugins:\n  - asyncapi-tag:\n      asyncapi_file: schema.json\n",
        {"schema.json": MINIMAL_SCHEMA, "index.md": '<asyncapi-tag src="schema.json"/>\n'},
    )
    with caplog.at_level(logging.WARNING, logger="mkdocs"):
        site = build_site(cfg, strict=False)
    assert any("asyncapi_file" in r.getMessage() and "no longer used" in r.getMessage() for r in caplog.records)
    assert src_of((site / "index.html").read_text()) == ["schema.json"]


def test_user_listed_extension_is_not_duplicated(tmp_path):
    cfg = write_site(
        tmp_path,
        BASIC_YML + "markdown_extensions:\n  - asyncapi_tag\n",
        {"schema.json": MINIMAL_SCHEMA, "index.md": '<asyncapi-tag src="schema.json"/>\n'},
    )
    site = build_site(cfg)
    assert (site / "index.html").read_text().count('class="asyncapi-tag"') == 1
