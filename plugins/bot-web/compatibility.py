"""Fail closed on untested internal gateway adapters, including patched builds."""
from hashlib import sha256
from importlib.metadata import version
from importlib.util import find_spec
from pathlib import Path

REVISION = "29112bef099274229cadff79cdff7bf7b99c4b77"
NATIVE_FILES = {
    "methods_session.py": "c4c0b3355be3ecc7f7fdf8ebcbd46fb3f360f9dded5ca9908f96ed0ce7e561d0",
    "methods_groups.py": "f72b3b1768834e276377ed68e2b7efab3d75693da45c22ac06c8be920c19e94c",
    "methods_prompt.py": "01da1128c98ed1f36928a242e447fb42f40a2d0c385a98c1f4c7f6cc756d4b8a",
    "entry.py": "f46a94f266c1999dc03a3c17c48a25f34f21403c1b1e57b996855c44e0de3e04",
    "server.py": "e264c1c7cc2e99051c1e36f4019dd29b739d5b7f1c61b8e364f87ad6039d1900",
}


def check_native_adapter():
    spec = find_spec("tui_gateway")
    if version("hermes-agent") != "0.21.0" or not spec or not spec.submodule_search_locations:
        raise RuntimeError("This adapter requires the tested Hermes 0.21.0 build")
    root = Path(next(iter(spec.submodule_search_locations)))
    for name, expected in NATIVE_FILES.items():
        if sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError("Untested native gateway build; adapter revalidation is required")
