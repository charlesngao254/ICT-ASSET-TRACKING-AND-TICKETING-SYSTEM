import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = "0.0.0.0"
START_PORT = int(os.environ.get("PORT", "5173"))

for port in range(START_PORT, START_PORT + 100):
    try:
        server = ThreadingHTTPServer((HOST, port), SimpleHTTPRequestHandler)
        break
    except OSError:
        continue
else:
    raise SystemExit(f"No available port found between {START_PORT} and {START_PORT + 99}.")

print(f"Serving on http://localhost:{server.server_port}/", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()