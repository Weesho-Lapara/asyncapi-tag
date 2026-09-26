"""MkDocs plugin: registers the Markdown extension and resolves document URLs.

Enable it in ``mkdocs.yml``::

    plugins:
      - asyncapi-viewer

The plugin resolves the ``src`` attribute the same way MkDocs resolves links:
relative to the Markdown file, and relative to ``docs_dir`` when it starts with
``/``. Missing targets are reported as MkDocs warnings, so ``mkdocs build
--strict`` fails on them.
"""

from __future__ import annotations

import posixpath
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from mkdocs.config import config_options
from mkdocs.config.base import Config
from mkdocs.config.defaults import MkDocsConfig
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.structure.files import File, Files
from mkdocs.structure.pages import Page
from mkdocs.utils import get_relative_url

from asyncapi_viewer import assets

log = get_plugin_logger("asyncapi-viewer")

EXTENSION_NAME = "asyncapi_viewer"
EXTENSION_ALIASES = (EXTENSION_NAME, "asyncapi_tag")  # pre-rename name still works


def _docs_relative(url: str) -> str:
    """Plugin-level asset paths are relative to docs_dir, not to each page.

    A leading slash makes resolve_url look them up under docs_dir.
    """
    parts = urlsplit(url)
    if not url or parts.scheme or parts.netloc or url.startswith("/"):
        return url
    return "/" + url


class AsyncAPIPluginConfig(Config):
    renderer = config_options.Choice(("viewer", "legacy"), default="viewer")
    viewer_js = config_options.Type(str, default="auto")
    viewer_js_integrity = config_options.Type(str, default="auto")
    viewer_theme = config_options.Type(str, default="auto")
    viewer_theme_integrity = config_options.Type(str, default="auto")
    viewer_css = config_options.Type(str, default="auto")
    viewer_css_integrity = config_options.Type(str, default="auto")
    load_assets = config_options.Type(bool, default=True)
    embed_css = config_options.Type(bool, default=True)
    asyncapi_file = config_options.Deprecated(
        message=(
            "The '{}' option is no longer used: MkDocs copies every non-Markdown "
            "file under docs_dir into the site by itself. Remove it from mkdocs.yml."
        )
    )


class AsyncAPIPlugin(BasePlugin[AsyncAPIPluginConfig]):
    def __init__(self) -> None:
        self._page: Optional[Page] = None
        self._files: Optional[Files] = None

    def _serves_viewer(self) -> bool:
        """Default for the new renderer: publish the packaged viewer into the site."""
        return self.config.renderer == "viewer" and assets.packaged() and (
            self.config.viewer_js == "auto" or self.config.viewer_theme == "auto"
        )

    def on_config(self, config: MkDocsConfig) -> MkDocsConfig:
        listed = [n for n in EXTENSION_ALIASES if n in config["markdown_extensions"]]
        name = listed[0] if listed else EXTENSION_NAME
        if not listed:
            config["markdown_extensions"].append(name)
        if config["mdx_configs"] is None:
            config["mdx_configs"] = {}

        def asset(value: str) -> str:
            return value if value == "auto" else _docs_relative(value)

        viewer_js, js_integrity = asset(self.config.viewer_js), self.config.viewer_js_integrity
        viewer_theme, theme_integrity = asset(self.config.viewer_theme), self.config.viewer_theme_integrity
        if self._serves_viewer():
            if self.config.viewer_js == "auto":
                viewer_js = f"/{assets.SITE_ASSET_DIR}/{assets.VIEWER_MODULE}"
                if js_integrity == "auto":
                    js_integrity = assets.integrity(assets.VIEWER_MODULE)
            if self.config.viewer_theme == "auto" and self.config.viewer_css == "auto":
                viewer_theme = f"/{assets.SITE_ASSET_DIR}/{assets.VIEWER_THEME}"
                if theme_integrity == "auto":
                    theme_integrity = assets.integrity(assets.VIEWER_THEME)

        config["mdx_configs"][name] = {
            "renderer": self.config.renderer,
            "viewer_js": viewer_js,
            "viewer_js_integrity": js_integrity,
            "viewer_theme": viewer_theme,
            "viewer_theme_integrity": theme_integrity,
            "viewer_css": asset(self.config.viewer_css),
            "viewer_css_integrity": self.config.viewer_css_integrity,
            "load_assets": self.config.load_assets,
            "embed_css": self.config.embed_css,
            "url_resolver": self.resolve_url,
            "warn": log.warning,
        }
        return config

    def on_files(self, files: Files, config: MkDocsConfig) -> Files:
        """Add the packaged viewer files to the site under assets/asyncapi-viewer/."""
        if not self._serves_viewer():
            return files
        for name in assets.VIEWER_FILES:
            uri = f"{assets.SITE_ASSET_DIR}/{name}"
            if files.get_file_from_path(uri) is not None:
                continue
            if hasattr(File, "generated"):  # MkDocs 1.6+
                files.append(File.generated(config, uri, content=assets.static_path(name).read_bytes()))
            else:  # MkDocs 1.5: a File whose source lives in the package
                f = File(name, str(assets.STATIC_DIR), config["site_dir"], config["use_directory_urls"])
                f.src_uri = uri
                f.dest_uri = uri
                f.url = uri
                f.abs_dest_path = str(Path(config["site_dir"]) / uri)
                files.append(f)
        return files

    def on_page_markdown(
        self, markdown: str, page: Page, config: MkDocsConfig, files: Files
    ) -> str:
        # Remember which page is about to be rendered so resolve_url can make
        # URLs relative to it. MkDocs calls page.render() right after this hook.
        self._page = page
        self._files = files
        return markdown

    def resolve_url(self, url: str) -> str:
        """Turn a src attribute into a URL relative to the current page."""
        page, files = self._page, self._files
        if page is None or files is None:
            return url
        scheme, netloc, path, query, fragment = urlsplit(url)
        if scheme or netloc or not path:
            return url
        if path.startswith("/"):
            target = posixpath.normpath(path.lstrip("/"))
        else:
            target = posixpath.normpath(posixpath.join(posixpath.dirname(page.file.src_uri), path))
        target_file = files.get_file_from_path(target)
        if target_file is None:
            log.warning(
                f"Doc file '{page.file.src_uri}' references AsyncAPI document '{url}', "
                f"but '{target}' is not found among documentation files."
            )
            return url
        return urlunsplit(("", "", get_relative_url(target_file.url, page.url), query, fragment))
