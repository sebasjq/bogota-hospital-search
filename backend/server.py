import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parents[1]
INTERFACE_DIR = ROOT_DIR / "interface"
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(ROOT_DIR))

from logic.a_star import a_star
from logic.bfs import bfs
from logic.greedy import greedy
from logic.graph import load_graph
from logic.uniform_cost import uniform_cost
from scripts.fill_distances import direct_distance_km
from backend.route_geometry import RouteGeometryError, route_geometry


ALGORITHMS = {
    "bfs": ("Anchura", bfs),
    "uniform_cost": ("Costo uniforme", uniform_cost),
    "greedy": ("Voraz", greedy),
    "a_star": ("A*", a_star),
}


def load_hospitals():
    with (DATA_DIR / "hospitals.json").open(encoding="utf-8") as file:
        return json.load(file)


def run_search(payload):
    origin = payload.get("origin")
    destination = payload.get("destination")
    algorithm_id = payload.get("algorithm")

    if not origin or not destination or not algorithm_id:
        raise ValueError("Selecciona origen, destino y algoritmo.")
    if origin == destination:
        raise ValueError("El origen y el destino deben ser diferentes.")
    if algorithm_id not in ALGORITHMS:
        raise ValueError("El algoritmo seleccionado no está disponible.")

    hospitals_list = load_hospitals()
    hospitals = {hospital["id"]: hospital for hospital in hospitals_list}
    graph = load_graph()
    if origin not in hospitals or destination not in hospitals:
        raise ValueError("No se encontró uno de los hospitales seleccionados.")

    algorithm_name, algorithm = ALGORITHMS[algorithm_id]
    if algorithm_id in {"greedy", "a_star"}:
        result = algorithm(graph, hospitals, origin, destination)
    else:
        result = algorithm(graph, origin, destination)

    if result is None:
        return {
            "found": False,
            "algorithm": algorithm_id,
            "algorithm_name": algorithm_name,
            "origin": origin,
            "destination": destination,
        }

    path, distance, tree_edges, expanded = result
    street_geometry = route_geometry(path, hospitals)
    response = {
        "found": True,
        "algorithm": algorithm_id,
        "algorithm_name": algorithm_name,
        "origin": origin,
        "destination": destination,
        "path": path,
        "distance": distance,
        "tree_edges": tree_edges,
        "expanded": expanded,
        "route_geometry": street_geometry,
    }
    if algorithm_id in {"greedy", "a_star"}:
        response["heuristic"] = direct_distance_km(
            hospitals[origin], hospitals[destination]
        )
    return response


class IntegrationHandler(BaseHTTPRequestHandler):
    server_version = "BogotaHospitalSearch/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        if parsed.path == "/api/hospitals":
            self.send_json(200, load_hospitals())
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        if urlparse(self.path).path != "/api/search":
            self.send_json(404, {"error": "Endpoint no encontrado."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length))
            result = run_search(payload)
            self.send_json(200, result)
        except (json.JSONDecodeError, ValueError, RouteGeometryError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "No fue posible calcular la ruta."})

    def serve_static(self, request_path):
        relative_path = request_path.lstrip("/") or "interface/index.html"
        file_path = (ROOT_DIR / relative_path).resolve()
        if relative_path in {"interface", "interface/"}:
            file_path = INTERFACE_DIR / "index.html"
        if ROOT_DIR not in file_path.parents or not file_path.is_file():
            self.send_error(404)
            return
        content_type = "text/html; charset=utf-8"
        if file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif file_path.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        print(f"{self.address_string()} - {format_string % args}")


def main():
    host = "127.0.0.1"
    port = 8000
    server = ThreadingHTTPServer((host, port), IntegrationHandler)
    print(f"HealthMap disponible en http://{host}:{port}/interface/")
    print("API de rutas: POST /api/search")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()