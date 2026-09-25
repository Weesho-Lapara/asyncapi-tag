"""Deprecated compatibility shim. Install and import ``asyncapi_tag`` instead."""

import warnings

warnings.warn(
    "mkdocs-asyncapi-tag-plugin has been renamed to 'asyncapi-tag'. "
    "This package is a shim that only depends on it; switch your requirement to "
    "'asyncapi-tag' and import from 'asyncapi_tag'.",
    DeprecationWarning,
    stacklevel=2,
)
