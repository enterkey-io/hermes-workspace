"""Optional user-hosted Hermes extension; registration has no network side effects."""


def register(ctx):
    def setup(parser):
        parser.add_argument("action", choices=["doctor", "serve", "setup", "approve", "revoke"])
        parser.add_argument("code", nargs="?")
        parser.add_argument("--bridge-url")
        parser.add_argument("--app-origin", action="append")
        parser.add_argument("--port", type=int, default=8788)

    def run(args):
        if args.action == "doctor":
            import json
            from .compatibility import inspect_native_adapter
            report = inspect_native_adapter()
            print(json.dumps(report, indent=2))
            if not report["supported"]:
                raise SystemExit(2)
        elif args.action == "serve":
            from .server import serve
            serve()
        elif args.action == "setup":
            if not args.bridge_url or not args.app_origin:
                raise ValueError("Setup needs --bridge-url and at least one --app-origin")
            from .setup import configure
            configure(args.bridge_url, args.app_origin, args.port)
        else:
            from .setup import control
            if args.app_origin and len(args.app_origin) != 1:
                raise ValueError("Approve/revoke accepts one --app-origin")
            control(args.action, args.code, args.app_origin[0] if args.app_origin else None)

    ctx.register_cli_command("bot-web", "Connect independent apps to native Hermes Bot Mode", setup, run)
