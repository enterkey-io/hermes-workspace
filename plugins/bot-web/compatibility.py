"""Identify a tested native adapter surface; package metadata is advisory, not a gate."""
from hashlib import sha256
from importlib.metadata import version, PackageNotFoundError
from importlib.util import find_spec
from pathlib import Path

# Each complete fingerprint set was tested against its exact source revision.
# Display/package versions alone cannot authorize a native integration.
SUPPORTED_BUILDS = [
    {
        "version": "0.21.0",
        "revision": "29112bef099274229cadff79cdff7bf7b99c4b77",
        "server_requests": False,
        "files": {
            "methods_session.py": "c4c0b3355be3ecc7f7fdf8ebcbd46fb3f360f9dded5ca9908f96ed0ce7e561d0",
            "methods_groups.py": "f72b3b1768834e276377ed68e2b7efab3d75693da45c22ac06c8be920c19e94c",
            "methods_prompt.py": "01da1128c98ed1f36928a242e447fb42f40a2d0c385a98c1f4c7f6cc756d4b8a",
            "entry.py": "f46a94f266c1999dc03a3c17c48a25f34f21403c1b1e57b996855c44e0de3e04",
            "server.py": "e264c1c7cc2e99051c1e36f4019dd29b739d5b7f1c61b8e364f87ad6039d1900"
        }
    },
    {
        "version": "0.21.7",
        "revision": "af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a",
        "server_requests": True,
        "files": {
            "methods_session.py": "c1276744175bc4b7ba9e5b400d0334d551e1b5c526b2e1bd71a2786e0a39b669",
            "methods_groups.py": "902f79272a8cb391de9f25a2c2acd0d5dbbeaf31654f55e410d36536d77cfce2",
            "methods_prompt.py": "7307dba5aa1df597c99c551b4f344d0e292141e0e6c45f3c3fa2daddb0dbeee9",
            "entry.py": "2d49339eb0b53b9f24243e886c56722ee055335aeae1d19dfc0896cf7b5223bf",
            "server.py": "5e51f2b4ad33af95044be68a001d0ae66948d8c116fe8ff28a8e70b378ca3be1"
        }
    }
]

def inspect_native_adapter():
    try:
        distribution_version = version("hermes-agent")
    except PackageNotFoundError:
        distribution_version = None
    report = {"supported": False, "distribution_version": distribution_version,
              "revision": None, "version": None, "server_requests": False, "fingerprints": {}}
    spec = find_spec("tui_gateway")
    if not spec or not spec.submodule_search_locations:
        report["reason"] = "Native tui_gateway module is unavailable"
        return report
    root = Path(next(iter(spec.submodule_search_locations)))
    for name in SUPPORTED_BUILDS[0]["files"]:
        path = root / name
        report["fingerprints"][name] = sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    for build in SUPPORTED_BUILDS:
        if report["fingerprints"] == build["files"]:
            report.update(supported=True, version=build["version"], revision=build["revision"],
                          server_requests=build["server_requests"])
            return report
    report["reason"] = "Native adapter files do not match a tested source bundle"
    return report


def check_native_adapter():
    report = inspect_native_adapter()
    if not report["supported"]:
        raise RuntimeError("Unsupported native adapter surface. Run hermes bot-web doctor for a read-only compatibility report; do not downgrade or patch Hermes.")
    return report
