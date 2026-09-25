# asyncapi-tag (deprecated)

This package has been renamed to **[asyncapi-viewer](https://pypi.org/project/asyncapi-viewer/)**.
With the fenced-block syntax and the upcoming viewer of its own, "tag" no longer described it.

Version 1.2.0 of this package contains no code of its own. It depends on `asyncapi-viewer` and
re-exports its modules under the old import name, so both of these keep working unchanged:

```yaml
plugins:
  - asyncapi-tag          # still registered by asyncapi-viewer
markdown_extensions:
  - asyncapi_tag          # still registered by asyncapi-viewer
```

```python
from asyncapi_tag import AsyncAPITagExtension   # DeprecationWarning, then works
```

Switch your requirement to `asyncapi-viewer`; no further releases will be made under this name.

```sh
pip uninstall asyncapi-tag
pip install asyncapi-viewer
```
