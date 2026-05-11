from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        rewrites = [
            (r"^/r/[^/]+/admin/?$", "/r/admin/index.html"),
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
        return str(ROOT / clean_path.lstrip("/"))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    print("Frontend local: http://127.0.0.1:4173")
    server.serve_forever()
