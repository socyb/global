#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
import argparse
import sys


ROOT = Path(__file__).resolve().parents[1]

ENDPOINTS = {
    "countryInformality": "https://rplumber.ilo.org/data/indicator?id=EMP_NIFL_SEX_RT_A&ref_area=MEX+ARG+CHL&sex=SEX_T&timefrom=2015&timeto=2027&lang=en&type=label&format=.csv&channel=ilostat",
    "globalInformality": "https://rplumber.ilo.org/data/indicator?id=EMP_2IFL_SEX_RT_A&ref_area=X01&sex=SEX_T&timefrom=2015&timeto=2027&lang=en&type=label&format=.csv&channel=ilostat",
    "unemployment": "https://rplumber.ilo.org/data/indicator?id=UNE_2EAP_SEX_AGE_RT_A&ref_area=MEX+ARG+CHL+X01&sex=SEX_T&classif1=AGE_YTHADULT_YGE15&timefrom=2015&timeto=2027&lang=en&type=label&format=.csv&channel=ilostat",
}


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/ilostat":
            self.proxy_ilostat(parsed.query)
            return
        super().do_GET()

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path == "/ilostat":
            source = parse_qs(parsed.query).get("source", [""])[0]
            if source not in ENDPOINTS:
                self.send_error(404, "Unknown ILOSTAT source")
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        super().do_HEAD()

    def proxy_ilostat(self, query):
        source = parse_qs(query).get("source", [""])[0]
        endpoint = ENDPOINTS.get(source)
        if not endpoint:
            self.send_error(404, "Unknown ILOSTAT source")
            return

        request = Request(
            endpoint,
            headers={
                "Accept": "text/csv,*/*",
                "User-Agent": "Unidad4-ILOSTAT-dashboard/1.0",
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                body = response.read()
        except HTTPError as error:
            self.send_error(error.code, f"ILOSTAT responded {error.code}")
            return
        except URLError as error:
            self.send_error(502, f"Could not reach ILOSTAT: {error.reason}")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def serve(host, port):
    for candidate in range(port, port + 20):
        try:
            server = ThreadingHTTPServer((host, candidate), DashboardHandler)
        except OSError:
            continue

        url = f"http://{host}:{candidate}/unidad4/dashboard_ilostat_actividad12.html"
        print(f"Dashboard ILOSTAT: {url}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.", file=sys.stderr)
        finally:
            server.server_close()
        return

    raise SystemExit(f"No se encontro un puerto disponible entre {port} y {port + 19}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Servidor local para el dashboard ILOSTAT.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8012)
    args = parser.parse_args()
    serve(args.host, args.port)
