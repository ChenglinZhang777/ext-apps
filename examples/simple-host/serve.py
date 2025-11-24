#!/usr/bin/env python3
"""
Simple HTTP server to serve the MCP-UI proxy on port 8765
"""

import http.server
import os
import socketserver
import sys
from pathlib import Path

PORT = int(os.environ.get('PORT', '8080'))
DIRECTORY = Path(__file__).parent / 'dist'

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY.as_posix(), **kwargs)

    def end_headers(self):
        # Apply custom headers only to sandbox.html
        if self.path == "/sandbox.html" or self.path == "/":
            # Add CORS headers to allow cross-origin requests
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")

            # Add permissive CSP to allow external resources (images, styles, scripts)
            csp = "; ".join(
                [
                    "default-src 'self'",
                    "img-src * data: blob: 'unsafe-inline'",
                    "style-src * blob: data: 'unsafe-inline'",
                    "script-src * blob: data: 'unsafe-inline' 'unsafe-eval'",
                    "connect-src *",
                    "font-src * blob: data:",
                    "media-src * blob: data:",
                    "frame-src * blob: data:",
                ]
            )
            self.send_header("Content-Security-Policy", csp)

            # Disable caching to ensure fresh content on every request
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")

        super().end_headers()


def main():
    print(f"Server running on: http://localhost:{PORT}")
    print(f"Press Ctrl+C to stop the server\n")

    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")
            sys.exit(0)


if __name__ == "__main__":
    main()