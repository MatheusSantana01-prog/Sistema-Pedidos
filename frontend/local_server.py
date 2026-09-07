from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import os


ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        rewrites = [
            (r"^/r/[^/]+/admin/?$", "/r/admin/index.html"),
            (r"^/r/[^/]+/gerente/?$", "/r/admin/index.html"),
            (r"^/r/[^/]+/garcom/?$", "/r/garcom/index.html"),
            (r"^/r/[^/]+/cozinha/?$", "/r/cozinha/index.html"),
            (r"^/r/[^/]+/caixa/?$", "/r/caixa/index.html"),
            (r"^/r/[^/]+/tv/?$", "/r/tv/index.html"),
            (r"^/r/[^/]+/mesa/[^/]+/?$", "/r/mesa/index.html"),
            (r"^/super-admin/?$", "/super-admin/index.html"),
        ]
        for pattern, target in rewrites:
            if re.match(pattern, clean_path):
                clean_path = target
                break
        resolved = (ROOT / clean_path.lstrip("/")).resolve()
        return str(resolved if resolved.is_relative_to(ROOT) else ROOT / "not-found")


if __name__ == "__main__":
    port = int(os.getenv("FRONTEND_PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Frontend local: http://127.0.0.1:{port}")
    server.serve_forever()
