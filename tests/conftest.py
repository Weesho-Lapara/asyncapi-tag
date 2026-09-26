from __future__ import annotations

import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import sync_viewer  # noqa: E402  (scripts/sync_viewer.py)


@pytest.fixture(scope="session", autouse=True)
def packaged_schema():
    """The extension validates against viewer/src/options.schema.json; make sure the package copy exists."""
    sync_viewer.sync_schema()
    sync_viewer.sync_static()  # harmless when the viewer is not built

MINIMAL_SCHEMA = textwrap.dedent(
    """\
    {"asyncapi": "2.6.0", "info": {"title": "Demo", "version": "1.0.0"},
     "channels": {"user/signedup": {"subscribe": {"message": {"payload": {"type": "object"}}}}}}
    """
)

MINIMAL_SCHEMA_YAML = textwrap.dedent(
    """\
    asyncapi: 3.0.0
    info:
      title: Demo
      version: 1.0.0
    channels: {}
    """
)


@pytest.fixture
def warnings_list():
    """Collects warning messages passed to the extension's ``warn`` callable."""
    return []


def node_check(js: str) -> None:
    """Syntax-check JavaScript with node when it is available, else skip."""
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")
    result = subprocess.run([node, "--check", "-"], input=js, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
