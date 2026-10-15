"""Optional user-hosted Hermes extension; registration has no network side effects."""


def register(ctx):
    def setup(parser):
        parser.add_argument("action", choices=["doctor", "serve", "setup", "approve", "revoke", "enroll", "primary", "sync-runtime", "probe"],
            help="revoke invalidates ALL browser access; it is not diagnostic connection cleanup")
        parser.add_argument("code", nargs="?")
        parser.add_argument("--trust-file")
        parser.add_argument("--bridge-url")
        parser.add_argument("--app-origin", action="append")
        parser.add_argument("--port", type=int, default=8788)

    def run(args):
        if args.action == "doctor":
            import json
            from .compatibility import inspect_native_adapter
            report = inspect_native_adapter()
            from .setup import config_path
            from .trust import trust_path
            report.update(bridge_version="0.3.0", connection_configured=config_path().is_file(), owner_issuer_enrolled=trust_path().is_file())
            print(json.dumps(report, indent=2))
            if not report["supported"]:
                raise SystemExit(2)
        elif args.action == "serve":
            from .server import serve
            serve()
        elif args.action == "primary":
            if not args.code:
                raise ValueError("Primary binding requires an existing profile name")
            from .setup import bind_primary
            bind_primary(args.code)
            print("Verified primary profile bound for owner onboarding.")
        elif args.action == "sync-runtime":
            from .setup import sync_runtime
            sync_runtime()
        elif args.action == "probe":
            from .setup import probe
            probe()
        elif args.action == "enroll":
            if not args.trust_file:
                raise ValueError("Enroll requires --trust-file exported by the owner app installer")
            from .trust import enroll
            enroll(args.trust_file)
            print("Owner app public key enrolled. Restart the bridge once to activate durable login.")
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

    from .runtime import register_runtime
    register_runtime(ctx)

    ctx.register_cli_command("bot-web", "Connect independent apps to native Hermes Bot Mode", setup, run)
