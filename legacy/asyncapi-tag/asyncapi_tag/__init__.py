"""Deprecated import name. Install and import ``asyncapi_viewer`` instead."""

import warnings

from asyncapi_viewer import (  # noqa: F401
    VIEWER_CSS_INTEGRITY,
    VIEWER_CSS_URL,
    VIEWER_JS_INTEGRITY,
    VIEWER_JS_URL,
    VIEWER_VERSION,
    AsyncAPITagExtension,
    AsyncAPIViewerExtension,
    __version__,
    makeExtension,
)

warnings.warn(
    "asyncapi-tag has been renamed to 'asyncapi-viewer'. This package is a shim that only "
    "depends on it; switch your requirement to 'asyncapi-viewer' and import from 'asyncapi_viewer'.",
    DeprecationWarning,
    stacklevel=2,
)
