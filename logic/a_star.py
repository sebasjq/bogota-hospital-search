import heapq
import json
import sys
from pathlib import Path

# Agrega la carpeta raíz del proyecto al sys.path para poder importar módulos desde la carpeta logic y scripts
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logic.graph import load_graph # Importa la función load_graph desde el módulo graph.py en la carpeta logic
from scripts.fill_distances import direct_distance_km # Importa la función direct_distance_km desde el módulo fill_distances.py en la carpeta scripts


def a_star(graph, hospitals, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    initial_heuristic = direct_distance_km(hospitals[origin], hospitals[destination])

    # La idea es almacenar el aculmulado f(n) = g(n) + h(n) en... (f(n), distancia, camino)
    # Donde g(n) representa la distancia acumulada desde el origen (costo uniforme)
    # y h(n) representa la distancia directa desde el nodo actual hasta el destino (heurística).
    queue = [(initial_heuristic, 0, [origin])] # (f(n), g(n), camino)

    expanded = set()

    while queue:

        _, distance, path = heapq.heappop(queue)
        current = path[-1]

        if current == destination:
            return path, distance

        if current in expanded:
            continue

        for neighbor in graph[current]:

            if neighbor not in expanded:
                new_path = path + [neighbor]

                new_distance = distance + graph[current][neighbor] # g(n) = distancia acumulada desde el origen hasta el vecino
                new_heuristic = direct_distance_km(hospitals[neighbor], hospitals[destination]) # h(n) = distancia directa desde el vecino hasta el destino

                priority = new_distance + new_heuristic # f(n) = g(n) + h(n)
                heapq.heappush(queue, (priority, new_distance, new_path))

        expanded.add(current)

    return None


if __name__ == "__main__":
    graph = load_graph()

    data_folder = Path(__file__).resolve().parents[1] / "data"
    with (data_folder / "hospitals.json").open(encoding="utf-8") as file:
        hospital_list = json.load(file)

    hospitals = {hospital["id"]: hospital for hospital in hospital_list}

    result = a_star(graph, hospitals, "H16", "H23")
    print(result)