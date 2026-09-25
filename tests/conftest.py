from __future__ import annotations

import shutil
import subprocess
import textwrap

import pytest

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
