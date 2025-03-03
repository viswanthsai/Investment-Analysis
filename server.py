import http.server
import socketserver
import os

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()
    
    def guess_type(self, path):
        if path.endswith('.csv'):
            return 'text/csv'
        return super().guess_type(path)

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print("Open this URL in your browser to use the calculator")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()