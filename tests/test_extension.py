from __future__ import annotations

import html
import json
import re

import markdown
import pytest

from asyncapi_viewer import assets
from asyncapi_viewer.extension import (
    AsyncAPIViewerExtension,
    build_viewer_config,
    parse_attributes,
    parse_fence_body,
)
from tests.conftest import node_check


def render(text: str, warnings_list=None, **config) -> str:
    """Render with the legacy (1.x) renderer, which these tests describe; see test_viewer_renderer.py."""
    if warnings_list is not None:
        config["warn"] = warnings_list.append
    config.setdefault("renderer", "legacy")
    return markdown.markdown(text, extensions=[AsyncAPIViewerExtension(**config), "fenced_code"])


def container_config(out: str, index: int = 0) -> dict:
    values = re.findall(r'data-asyncapi-config="([^"]*)"', out)
    return json.loads(html.unescape(values[index]))


def test_paired_and_self_closing_tags_render_containers():
    out = render('<asyncapi-viewer src="a.yaml"></asyncapi-viewer>\n\n<asyncapi-viewer src="b.json"/>')
    assert out.count('class="asyncapi-viewer asyncapi-tag"') == 2
    assert 'data-asyncapi-src="a.yaml"' in out
    assert 'data-asyncapi-src="b.json"' in out
    assert 'id="asyncapi-viewer-1"' in out and 'id="asyncapi-viewer-2"' in out
    assert "<asyncapi-viewer" not in out
    # the container is block-level, so Markdown does not wrap it in <p>
    assert "<p><div" not in out


def test_assets_are_emitted_once_per_page_and_pinned():
    out = render('<asyncapi-viewer src="a.yaml"/>\n\n<asyncapi-viewer src="b.yaml"/>')
    assert out.count(assets.VIEWER_JS_URL) == 1
    assert out.count(assets.VIEWER_CSS_URL) == 1
    assert f'integrity="{assets.VIEWER_JS_INTEGRITY}"' in out
    assert f'integrity="{assets.VIEWER_CSS_INTEGRITY}"' in out
    assert 'crossorigin="anonymous"' in out
    assert "@latest" not in out
    # the viewer script precedes the runner script
    assert out.index(assets.VIEWER_JS_URL) < out.index("querySelectorAll")


def test_embed_css_is_emitted_once_and_can_be_disabled():
    out = render('<asyncapi-viewer src="a.yaml"/>\n\n<asyncapi-viewer src="b.yaml"/>')
    assert out.count(assets.EMBED_CSS) == 1
    assert out.index("<style>") < out.index(assets.VIEWER_CSS_URL)
    assert "</style>" not in assets.EMBED_CSS
    # the container must open its own stacking context, or the viewer's z-10..z-30 panels
    # paint over a theme's sticky header (Material's header is z-index 4)
    assert ".asyncapi-viewer { position: relative; z-index: 0;" in assets.EMBED_CSS
    out = render('<asyncapi-viewer src="a.yaml"/>', embed_css=False)
    assert assets.EMBED_CSS not in out and "data-asyncapi-src" in out


def test_no_tag_means_no_assets():
    out = render("# Hello\n\nNothing to see.")
    assert "asyncapi" not in out


def test_load_assets_false_and_custom_asset_urls():
    out = render('<asyncapi-viewer src="a.yaml"/>', load_assets=False)
    assert "<script" not in out and "<link" not in out
    out = render(
        '<asyncapi-viewer src="a.yaml"/>',
        viewer_js="js/viewer.js",
        viewer_js_integrity="",
        viewer_css="css/viewer.css",
        viewer_css_integrity="",
    )
    assert '<script src="js/viewer.js"></script>' in out
    assert '<link rel="stylesheet" href="css/viewer.css">' in out
    assert "integrity" not in out


def test_tag_inside_code_blocks_is_left_alone():
    fenced = '```html\n<asyncapi-viewer src="a.yaml"/>\n```\n'
    indented = '    <asyncapi-viewer src="a.yaml"/>\n'
    for text in (fenced, indented):
        out = render(text)
        assert "&lt;asyncapi-viewer" in out
        assert "data-asyncapi-src" not in out


def test_url_resolver_is_applied_to_src_and_relative_assets():
    seen = []

    def resolver(url):
        seen.append(url)
        return "resolved/" + url

    out = render('<asyncapi-viewer src="schema.yaml"/>', url_resolver=resolver, viewer_js="v.js", viewer_css="v.css")
    assert 'data-asyncapi-src="resolved/schema.yaml"' in out
    assert set(seen) == {"schema.yaml", "v.js", "v.css"}


def test_attribute_values_cannot_break_out_of_html_or_js(warnings_list):
    evil = "x'+alert(document.domain)+'<script>alert(1)</script>"
    out = render(f"<asyncapi-viewer src=\"{evil}\" publishLabel='</script><b>'/>", warnings_list)
    assert "<script>alert(1)</script>" not in out
    assert "</script><b>" not in out
    assert html.escape(evil, quote=True) in out
    # the config round-trips intact through the escaped data attribute
    assert container_config(out)["publishLabel"] == "</script><b>"
    assert warnings_list == []


def test_defaults():
    cfg = container_config(render('<asyncapi-viewer src="a.yaml"/>'))
    assert cfg["show"] == {
        "sidebar": False, "info": True, "servers": True, "operations": True,
        "messages": True, "schemas": True, "errors": True,
    }
    assert cfg["expand"] == {"messageExamples": True}
    assert cfg["schemaID"] == "asyncapi-viewer-1"
    assert "publishLabel" not in cfg  # viewer default applies


def test_string_and_enum_attributes_are_passed_through_not_booleanised():
    out = render(
        '<asyncapi-viewer src="a.yaml" publishLabel="PUBLISH" subscribeLabel="SUBSCRIBE" '
        'sendLabel="S" receiveLabel="R" requestLabel="Q" replyLabel="P" '
        'showServers="bySpecTags" showOperations="byOperationsTags" '
        'sidebar="true" messageExamples="0" useChannelAddressAsIdentifier="yes" '
        'parserOptions=\'{"applyTraits": false}\' id="my-api" schemaID="custom"/>'
    )
    cfg = container_config(out)
    assert cfg["publishLabel"] == "PUBLISH"
    assert cfg["subscribeLabel"] == "SUBSCRIBE"
    assert (cfg["sendLabel"], cfg["receiveLabel"], cfg["requestLabel"], cfg["replyLabel"]) == ("S", "R", "Q", "P")
    assert cfg["sidebar"] == {
        "showServers": "bySpecTags",
        "showOperations": "byOperationsTags",
        "useChannelAddressAsIdentifier": True,
    }
    assert cfg["show"]["sidebar"] is True
    assert cfg["expand"]["messageExamples"] is False
    assert cfg["parserOptions"] == {"applyTraits": False}
    assert cfg["schemaID"] == "custom"
    assert 'id="my-api"' in out


def test_invalid_values_warn_and_are_skipped(warnings_list):
    out = render(
        '<asyncapi-viewer src="a.yaml" sidebar="maybe" showServers="nope" parserOptions="{oops" bogus="1"/>',
        warnings_list,
    )
    cfg = container_config(out)
    assert cfg["show"]["sidebar"] is False  # invalid value: default applies
    assert "showServers" not in cfg.get("sidebar", {})
    assert "parserOptions" not in cfg
    joined = "\n".join(warnings_list)
    assert "'sidebar' expects true or false" in joined
    assert "'showservers' expects one of" in joined
    assert "not valid JSON" in joined
    assert "unknown attribute 'bogus'" in joined


def test_missing_src_renders_visible_error(warnings_list):
    out = render("<asyncapi-viewer></asyncapi-viewer>", warnings_list)
    assert "asyncapi-viewer-error" in out
    assert "no document given" in out
    assert any("missing required 'src'" in w for w in warnings_list)


def test_multiline_tag_and_entities():
    out = render('<asyncapi-viewer\n    src="docs/a.yaml"\n    publishLabel="A &amp; B"\n/>')
    assert 'data-asyncapi-src="docs/a.yaml"' in out
    assert container_config(out)["publishLabel"] == "A & B"


def test_counter_resets_between_documents():
    md = markdown.Markdown(extensions=[AsyncAPIViewerExtension(renderer="legacy")])
    first = md.convert('<asyncapi-viewer src="a.yaml"/>')
    md.reset()
    second = md.convert('<asyncapi-viewer src="a.yaml"/>')
    assert 'id="asyncapi-viewer-1"' in first and 'id="asyncapi-viewer-1"' in second
    assert second.count(assets.VIEWER_JS_URL) == 1


def test_parse_attributes_quoting_styles():
    attrs = parse_attributes(""" src="a b" Sidebar='false' info=true bare """)
    assert attrs == {"src": "a b", "sidebar": "false", "info": "true", "bare": None}


def test_build_viewer_config_bare_boolean_attribute_is_true():
    cfg = build_viewer_config({"messageexamples": None, "sidebar": None})
    assert cfg["expand"]["messageExamples"] is True and cfg["show"]["sidebar"] is True


def test_runner_javascript_is_valid():
    node_check(assets.RUNNER_JS)


def test_runner_renders_containers_that_appear_after_the_script():
    # The loader is emitted right after the first container, so containers further down the
    # page do not exist yet when the runner first executes. It must run again when the DOM is
    # complete, and subscribe to Material's document$ then (the theme bundle loads later too).
    assert 'document.addEventListener("DOMContentLoaded"' in assets.RUNNER_JS
    assert "document$" in assets.RUNNER_JS
    assert "__asyncapiTagSubscribed" in assets.RUNNER_JS
    assert "</script>" not in assets.RUNNER_JS


@pytest.mark.parametrize("value", [assets.VIEWER_JS_INTEGRITY, assets.VIEWER_CSS_INTEGRITY])
def test_integrity_hashes_look_like_sri(value):
    assert re.fullmatch(r"sha384-[A-Za-z0-9+/]{64}", value)


def test_extension_loads_by_name_and_via_makeExtension():
    out = markdown.markdown('<asyncapi-viewer src="a.yaml"/>', extensions=["asyncapi_viewer"])
    assert '<asyncapi-viewer id="asyncapi-viewer-1" src="a.yaml">' in out  # default renderer
    from asyncapi_viewer import makeExtension

    assert isinstance(makeExtension(load_assets=False), AsyncAPIViewerExtension)


# --- fenced block syntax -------------------------------------------------------------------

FENCE = """\
Intro.

```asyncapi
src: api/events.yaml
sidebar: true
publishLabel: "PUBLISH"
# a comment
showServers: bySpecTags
```

Outro.
"""


def test_fenced_block_renders_container():
    out = render(FENCE)
    assert out.count('class="asyncapi-viewer asyncapi-tag"') == 1
    assert 'data-asyncapi-src="api/events.yaml"' in out
    cfg = container_config(out)
    assert cfg["show"]["sidebar"] is True
    assert cfg["publishLabel"] == "PUBLISH"
    assert cfg["sidebar"]["showServers"] == "bySpecTags"
    assert "<p>Intro.</p>" in out and "<p>Outro.</p>" in out
    assert "<code" not in out  # the fence did not survive as a code block
    assert out.index("Intro.") < out.index('class="asyncapi-viewer asyncapi-tag"') < out.index("Outro.")


def test_fenced_block_variants():
    # tildes, path on the info line, bare key, no blank lines around, indented up to 3 spaces
    out = render("Text\n~~~asyncapi ../spec.yaml\nsidebar\n~~~\nMore text")
    assert 'data-asyncapi-src="../spec.yaml"' in out
    assert container_config(out)["show"]["sidebar"] is True
    assert "<p>Text</p>" in out and "<p>More text</p>" in out
    out = render("   ```asyncapi\n   src: a.yaml\n   ```")
    assert 'data-asyncapi-src="a.yaml"' in out
    out = render("````asyncapi\nsrc: a.yaml\n````")
    assert 'data-asyncapi-src="a.yaml"' in out


def test_fenced_block_without_src_and_bad_lines_warn(warnings_list):
    out = render("```asyncapi\nsidebar: false\nthis is not a key value\n```", warnings_list)
    assert "asyncapi-viewer-error" in out
    assert any("missing required 'src'" in w for w in warnings_list)
    assert any("cannot parse line" in w for w in warnings_list)


def test_fence_nested_in_a_longer_fence_stays_code():
    doc = "````markdown\n```asyncapi\nsrc: a.yaml\n```\n````\n"
    out = render(doc)
    assert "data-asyncapi-src" not in out
    assert "asyncapi" in out and "<code" in out
    # and the same for a tilde fence around a backtick fence
    out = render("~~~\n```asyncapi\nsrc: a.yaml\n```\n~~~\n")
    assert "data-asyncapi-src" not in out


def test_other_fences_and_indented_code_are_untouched():
    out = render("```yaml\nasyncapi: 3.0.0\n```\n\n    ```asyncapi\n    src: a.yaml\n    ```\n")
    assert "data-asyncapi-src" not in out
    assert "asyncapi: 3.0.0" in out


def test_tag_inside_inline_code_span_is_left_alone():
    out = render('Use `<asyncapi-viewer src="a.yaml"/>` in a page, or ``<asyncapi-viewer>`` bare.')
    assert "data-asyncapi-src" not in out
    assert "&lt;asyncapi-viewer" in out
    # but a real tag on the same page still works
    out = render('See `<asyncapi-viewer>`.\n\n<asyncapi-viewer src="a.yaml"/>')
    assert out.count('class="asyncapi-viewer asyncapi-tag"') == 1


def test_fence_and_tag_share_numbering_and_assets():
    out = render('<asyncapi-viewer src="a.yaml"/>\n\n```asyncapi\nsrc: b.yaml\n```')
    assert 'id="asyncapi-viewer-1"' in out and 'id="asyncapi-viewer-2"' in out
    assert out.count(assets.VIEWER_JS_URL) == 1


def test_fenced_block_works_with_superfences():
    pytest.importorskip("pymdownx")
    out = markdown.markdown(FENCE, extensions=[AsyncAPIViewerExtension(renderer="legacy"), "pymdownx.superfences"])
    assert 'data-asyncapi-src="api/events.yaml"' in out and "<code" not in out
    out = markdown.markdown("```python\nprint(1)\n```", extensions=[AsyncAPIViewerExtension(), "pymdownx.superfences"])
    assert "<code" in out


def test_parse_fence_body():
    attrs = parse_fence_body(["src: 'x y.yaml'", "Sidebar: false", "", "# c", "messageExamples"], "")
    assert attrs == {"src": "x y.yaml", "sidebar": "false", "messageexamples": None}
    assert parse_fence_body([], ' "a.yaml" ')["src"] == "a.yaml"


# --- names kept from before the rename -------------------------------------------------------

def test_old_element_name_and_extension_names_still_work():
    out = render('<asyncapi-tag src="a.yaml" sidebar="true"></asyncapi-tag>\n\n<asyncapi-viewer src="b.yaml"/>')
    assert out.count('class="asyncapi-viewer asyncapi-tag"') == 2
    assert 'id="asyncapi-viewer-1"' in out and 'id="asyncapi-viewer-2"' in out
    for name in ("asyncapi_viewer", "asyncapi_tag"):
        assert "<asyncapi-viewer " in markdown.markdown('<asyncapi-tag src="a.yaml"/>', extensions=[name])
    from asyncapi_viewer import AsyncAPITagExtension

    assert AsyncAPITagExtension is AsyncAPIViewerExtension
