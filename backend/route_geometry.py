import json
import threading
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CACHE_PATH = DATA_DIR / "connection_routes.json"
_cache_lock = threading.Lock()


class RouteGeometryError(RuntimeError):
    """Raised when the street geometry service cannot provide a route."""


def _load_cache():
    if not CACHE_PATH.exists():
        return {}
    with CACHE_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def _save_cache(cache):
    temporary_path = CACHE_PATH.with_suffix(".tmp")
    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(cache, file, ensure_ascii=False, indent=2)
        file.write("\n")
    temporary_path.replace(CACHE_PATH)


def _fetch_segment(source, target):
    start = f'{source["longitude"]},{source["latitude"]}'
    end = f'{target["longitude"]},{target["latitude"]}'
    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start};{end}?overview=full&geometries=geojson&steps=false"
    )
    request = Request(url, headers={"User-Agent": "bogota-hospital-search/1.0"})
    last_error = None
    for _ in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                result = json.load(response)
            break
        except (OSError, URLError, ValueError) as error:
            last_error = error
    else:
        raise RouteGeometryError(
            "No fue posible obtener la geometría de las calles para "
            f"{source['id']} -> {target['id']}. Comprueba la conexión a Internet "
            "e inténtalo de nuevo."
        ) from last_error

    routes = result.get("routes", [])
    if result.get("code") != "Ok" or not routes:
        raise RouteGeometryError("OSRM no encontró calles para uno de los tramos.")
    coordinates = routes[0].get("geometry", {}).get("coordinates", [])
    if len(coordinates) < 2:
        raise RouteGeometryError("OSRM devolvió una geometría de calles vacía.")
    return coordinates


def route_geometry(path, hospitals):
    """Return one GeoJSON coordinate sequence for a hospital path."""
    if len(path) < 2:
        return []

    with _cache_lock:
        cache = _load_cache()
        segments = []
        cache_changed = False
        for source_id, target_id in zip(path, path[1:]):
            key = f"{source_id}->{target_id}"
            coordinates = cache.get(key)
            if coordinates is None:
                coordinates = _fetch_segment(hospitals[source_id], hospitals[target_id])
                cache[key] = coordinates
                cache_changed = True
            segments.append(coordinates)
        if cache_changed:
            _save_cache(cache)

    combined = []
    for segment in segments:
        if combined and segment[0] == combined[-1]:
            combined.extend(segment[1:])
        else:
            combined.extend(segment)
    return combined