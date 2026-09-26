"""The default renderer: an <asyncapi-viewer> element validated against the viewer's schema."""

from __future__ import annotations

import html
import re

import markdown
import pytest

from asyncapi_viewer import assets, options
from asyncapi_viewer.extension import AsyncAPIViewerExtension


def render(text: str, warnings_list=None, **config) -> str:
    if warnings_list is not None:
        config["warn"] = warnings_list.append
    return markdown.markdown(text, extensions=[AsyncAPIViewerExtension(**config), "fenced_code"])


def element_attrs(out: str, index: int = 0) -> dict:
    """The attributes of the n-th emitted element as {name: value or None}."""
    tags = re.findall(r"<asyncapi-viewer ([^>]*)></asyncapi-viewer>", out)
    attrs = {}
    for m in re.finditer(r'([a-z][a-z0-9-]*)(?:="([^"]*)")?', tags[index]):
        attrs[m.group(1)] = html.unescape(m.group(2)) if m.group(2) is not None else None
    return attrs


def test_element_is_emitted_with_id_and_src_and_no_runner():
    out = render('<asyncapi-viewer src="a.yaml"></asyncapi-viewer>\n\n<asyncapi-viewer src="b.json"/>')
    assert out.count("<asyncapi-viewer ") == 2
    assert element_attrs(out, 0) == {"id": "asyncapi-viewer-1", "src": "a.yaml"}
    assert element_attrs(out, 1) == {"id": "asyncapi-viewer-2", "src": "b.json"}
    assert "data-asyncapi-" not in out and "querySelectorAll" not in out
    assert "<p><asyncapi-viewer" not in out  # block-level, not wrapped in a paragraph


def test_every_schema_option_round_trips_as_a_kebab_case_attribute():
    samples = {"boolean": "no", "string": "CUSTOM", "json": '{"applyTraits": false}'}
    for spec in options.load_specs():
        if spec.status != "active" or spec.name in ("src", "id"):
            continue
        raw = spec.values[-1] if spec.type == "enum" else samples[spec.type]
        for spelling in (spec.name, spec.attribute, spec.name.lower(), spec.attribute.upper()):
            warnings = []
            attrs = element_attrs(render(f"<asyncapi-viewer src='a.yaml' {spelling}='{raw}'/>", warnings))
            assert warnings == [], (spelling, warnings)
            expected = {"boolean": "false", "string": "CUSTOM", "json": '{"applyTraits":false}'}.get(spec.type, raw)
            assert attrs[spec.attribute] == expected, (spelling, attrs)


def test_booleans_follow_the_shared_table_including_the_empty_value():
    for raw, expected in [("true", None), ("1", None), ("yes", None), ("ON", None), ("", None), ("false", "false"), ("0", "false"), ("off", "false")]:
        attrs = element_attrs(render(f'<asyncapi-viewer src="a.yaml" sidebar="{raw}"/>'))
        assert attrs["sidebar"] == expected, raw
    attrs = element_attrs(render('<asyncapi-viewer src="a.yaml" sidebar/>'))
    assert attrs["sidebar"] is None  # bare attribute means true


def test_invalid_values_warn_and_are_skipped_while_the_rest_apply(warnings_list):
    out = render(
        '<asyncapi-viewer src="a.yaml" sidebar="maybe" showServers="nope" parserOptions="{oops" bogus="1" info="no"/>',
        warnings_list,
    )
    attrs = element_attrs(out)
    assert "sidebar" not in attrs and "show-servers" not in attrs and "parser-options" not in attrs
    assert attrs["info"] == "false"
    joined = "\n".join(warnings_list)
    assert "'sidebar' expects true or false" in joined
    assert "'showservers' expects one of byDefault, bySpecTags, byServersTags" in joined
    assert "'parseroptions' is not valid JSON" in joined
    assert "unknown attribute 'bogus'" in joined


def test_parser_options_keys_are_validated(warnings_list):
    attrs = element_attrs(render('<asyncapi-viewer src="a.yaml" parserOptions=\'{"applyTraits": "no", "schemaParser": 1}\'/>', warnings_list))
    assert attrs["parser-options"] == '{"applyTraits":true}'
    assert any("parserOptions.applyTraits expects a boolean" in w for w in warnings_list)
    assert any("parserOptions.schemaParser is not supported" in w for w in warnings_list)


def test_deprecated_schema_id_warns_and_is_dropped(warnings_list):
    attrs = element_attrs(render('<asyncapi-viewer src="a.yaml" schemaID="x" id="mine"/>', warnings_list))
    assert attrs == {"id": "mine", "src": "a.yaml"}
    assert any("'schemaid' is deprecated and does nothing" in w for w in warnings_list)


def test_html_global_and_data_attributes_pass_through_silently(warnings_list):
    attrs = element_attrs(render('<asyncapi-viewer src="a.yaml" class="wide" data-x="1" aria-label="API" hidden/>', warnings_list))
    assert attrs["class"] == "wide" and attrs["data-x"] == "1" and attrs["aria-label"] == "API" and attrs["hidden"] is None
    assert warnings_list == []


def test_attribute_values_are_html_escaped():
    evil = "x\"><script>alert(1)</script>"
    out = render(f"<asyncapi-viewer src='{evil}' sendLabel='</asyncapi-viewer><b>'/>")
    assert "<script>alert(1)</script>" not in out and "<b>" not in out
    assert element_attrs(out)["src"] == evil
    assert element_attrs(out)["send-label"] == "</asyncapi-viewer><b>"


def test_missing_src_still_emits_the_element_and_warns(warnings_list):
    out = render("<asyncapi-viewer></asyncapi-viewer>", warnings_list)
    assert element_attrs(out) == {"id": "asyncapi-viewer-1"}
    assert any("missing required 'src'" in w for w in warnings_list)


def test_url_resolver_applies_to_src_and_assets():
    out = render('<asyncapi-viewer src="s.yaml"/>', url_resolver=lambda u: "r/" + u, viewer_js="v.js", viewer_theme="t.css", viewer_js_integrity="", viewer_theme_integrity="")
    assert element_attrs(out)["src"] == "r/s.yaml"
    assert '<script type="module" src="r/v.js"></script>' in out
    assert '<link rel="stylesheet" href="r/t.css">' in out


def test_viewer_loader_is_emitted_once_with_integrity_and_only_when_configured():
    out = render('<asyncapi-viewer src="a.yaml"/>\n\n<asyncapi-viewer src="b.yaml"/>', viewer_js="v.js", viewer_js_integrity="sha384-x", viewer_theme="t.css", viewer_theme_integrity="sha384-y")
    assert out.count('<script type="module" src="v.js" integrity="sha384-x" crossorigin="anonymous"></script>') == 1
    assert out.count('<link rel="stylesheet" href="t.css" integrity="sha384-y" crossorigin="anonymous">') == 1
    assert "<style>" not in out and assets.RUNNER_JS not in out
    # nothing configured yet: the element alone
    out = render('<asyncapi-viewer src="a.yaml"/>')
    assert "<script" not in out and "<link" not in out
    out = render('<asyncapi-viewer src="a.yaml"/>', viewer_js="v.js", load_assets=False)
    assert "<script" not in out


def test_deprecated_extension_options_warn_once_per_document(warnings_list):
    out = render('<asyncapi-viewer src="a.yaml"/>\n\n<asyncapi-viewer src="b.yaml"/>', warnings_list, embed_css=False, viewer_css="old.css", viewer_css_integrity="")
    assert sum("'embed_css' option is deprecated" in w for w in warnings_list) == 1
    assert sum("'viewer_css' is deprecated; use 'viewer_theme'" in w for w in warnings_list) == 1
    assert '<link rel="stylesheet" href="old.css">' in out  # the alias still works


def test_fenced_block_emits_the_element_too():
    out = render("```asyncapi\nsrc: api/events.yaml\nsidebar: true\nsendLabel: EMIT\n```")
    assert element_attrs(out) == {"id": "asyncapi-viewer-1", "src": "api/events.yaml", "sidebar": None, "send-label": "EMIT"}


def test_legacy_renderer_keeps_the_old_output_and_bad_values_are_rejected():
    out = render('<asyncapi-viewer src="a.yaml"/>', renderer="legacy")
    assert 'data-asyncapi-src="a.yaml"' in out and assets.RUNNER_JS in out
    with pytest.raises(ValueError):
        render('<asyncapi-viewer src="a.yaml"/>', renderer="react")


def test_options_module_names_and_kebab_case():
    assert options.to_attribute_name("useChannelAddressAsIdentifier") == "use-channel-address-as-identifier"
    assert options.lookup("SEND-LABEL").name == "sendLabel"
    assert options.lookup("nope") is None
    names = [s.name for s in options.load_specs()]
    assert "theme" in names and "searchKeepSections" in names and "schemaID" in names
