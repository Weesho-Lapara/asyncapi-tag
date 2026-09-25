"""Render AsyncAPI documents in Markdown with an ``<asyncapi-tag>`` element.

The package is a `Python-Markdown <https://python-markdown.github.io/>`_
extension (:class:`asyncapi_tag.extension.AsyncAPITagExtension`) and a thin
MkDocs plugin around it (:class:`asyncapi_tag.mkdocs_plugin.AsyncAPIPlugin`).
"""

from asyncapi_tag.assets import (
    VIEWER_CSS_INTEGRITY,
    VIEWER_CSS_URL,
    VIEWER_JS_INTEGRITY,
    VIEWER_JS_URL,
    VIEWER_VERSION,
)
from asyncapi_tag.extension import AsyncAPITagExtension, makeExtension

__version__ = "1.1.0"

__all__ = [
    "AsyncAPITagExtension",
    "makeExtension",
    "VIEWER_VERSION",
    "VIEWER_JS_URL",
    "VIEWER_JS_INTEGRITY",
    "VIEWER_CSS_URL",
    "VIEWER_CSS_INTEGRITY",
    "__version__",
]
