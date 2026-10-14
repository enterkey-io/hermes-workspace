"""Version-specific lifecycle adapter. Never patches or replaces Hermes handlers."""

from tui_gateway import entry
from tui_gateway.methods_groups import start_hosted_room_service, stop_hosted_room_service


def main():
    start_hosted_room_service()
    try:
        entry.main()
    finally:
        stop_hosted_room_service(timeout=5.0)


if __name__ == "__main__":
    main()
