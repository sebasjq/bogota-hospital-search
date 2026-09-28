import heapq
import sys
import json
from pathlib import Path

# Agrega la carpeta raíz del proyecto al sys.path para poder importar módulos desde la carpeta logic y scripts
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logic.graph import load_graph # Importa la función load_graph desde el módulo graph.py en la carpeta logic
from scripts.fill_distances import direct_distance_km # Importa la función direct_distance_km desde el módulo fill_distances.py en la carpeta scripts


def greedy(graph, hospitals, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    initial_heuristic =  direct_distance_km(hospitals[origin], hospitals[destination]) # Distancia directa desde el origen hasta el destino
    queue = [(initial_heuristic, 0, [origin])] # Heap: cada elemento contiene (distancia directa al destino, distancia acumulada, camino)

    expanded = {} # Conjunto de nodos ya expandidos para evitar ciclos

    tree_edges = []

    while queue:

        # Se elige el nodo con la menor distancia directa al destino (heurística) para expandirlo primero.
        _, distance, path = heapq.heappop(queue)
        current = path[-1] # Nodo actual es el último nodo del camino

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado
            return path, distance, tree_edges, expanded

        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue

        for neighbor in graph[current]:

            if neighbor not in expanded:
                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_distance = distance + graph[current][neighbor] # Se calcula la nueva distancia acumulada sumando la distancia al vecino.

                new_heuristic = direct_distance_km(hospitals[neighbor], hospitals[destination]) # Calcula la distancia directa desde el vecino hasta el destino

                tree_edges.append({
                    "parent": path.copy(),
                    "child": new_path.copy(),
                    "g": new_distance,
                    "h": new_heuristic
                }) # Se agrega la arista al árbol de expansión

                heapq.heappush(queue, (new_heuristic, new_distance, new_path)) # Se agrega el nuevo camino a la cola de prioridad para su posterior exploración.

        expanded[current] = {
            "order": len(expanded) + 1, # Guarda el orden de expansión del nodo actual
            "path": path.copy() # ... y el camino que llevó a este nodo
        } 

    return None

if __name__ == "__main__":

    from scripts.search_tree_graph import search_tree_graph

    graph = load_graph()

    # Leer la lista de hospitales.
    data_folder = Path(__file__).resolve().parents[1] / "data"
    with (data_folder / "hospitals.json").open(encoding="utf-8") as file:
        hospital_list = json.load(file)

    # Crear un diccionario para buscar cada hospital por su ID.
    hospitals = {hospital["id"]: hospital for hospital in hospital_list}

    origin, destination = "H30", "H29"
    result = greedy(graph, hospitals, origin, destination)

    if result is not None:
        path, distance, tree_edges, expanded = result
        print(path, distance)

        search_tree_graph({
            "origin": origin,
            "path": path,
            "distance": distance,
            "heuristic": direct_distance_km(hospitals[origin], hospitals[destination]),
            "tree_edges": tree_edges,
            "expanded": expanded,
        })