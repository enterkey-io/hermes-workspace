"""Explicit service entry point. Plugin discovery never starts a server."""
import importlib.util
from pathlib import Path
import sys


def main():
    code = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location("bot_web", code / "__init__.py",
        submodule_search_locations=[str(code)])
    module = importlib.util.module_from_spec(spec)
    sys.modules["bot_web"] = module
    spec.loader.exec_module(module)
    from bot_web.host_service import main as run
    run()


if __name__ == "__main__":
    main()
