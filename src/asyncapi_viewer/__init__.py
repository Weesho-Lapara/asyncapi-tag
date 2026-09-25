"""Render AsyncAPI documents in Markdown with an ``<asyncapi-viewer>`` element.

The package is a `Python-Markdown <https://python-markdown.github.io/>`_
extension (:class:`asyncapi_viewer.extension.AsyncAPIViewerExtension`) and a thin
MkDocs plugin around it (:class:`asyncapi_viewer.mkdocs_plugin.AsyncAPIPlugin`).
"""

from asyncapi_viewer.assets import (
    VIEWER_CSS_INTEGRITY,
    VIEWER_CSS_URL,
    VIEWER_JS_INTEGRITY,
    VIEWER_JS_URL,
    VIEWER_VERSION,
)
from asyncapi_viewer.extension import AsyncAPITagExtension, AsyncAPIViewerExtension, makeExtension

__version__ = "1.2.0"

__all__ = [
    "AsyncAPIViewerExtension",
    "AsyncAPITagExtension",
    "makeExtension",
    "VIEWER_VERSION",
    "VIEWER_JS_URL",
    "VIEWER_JS_INTEGRITY",
    "VIEWER_CSS_URL",
    "VIEWER_CSS_INTEGRITY",
    "__version__",
]
