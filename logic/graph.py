import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Función para construir el grafo dirigido con aristas de ida y vuelta
def load_graph():
    with (DATA_DIR / "hospitals.json").open(encoding="utf-8") as file:
        hospitals = json.load(file)

    with (DATA_DIR / "connections.json").open(encoding="utf-8") as file:
        connections = json.load(file)

    graph = {}

    for hospital in hospitals:
        graph[hospital["id"]] = {} # Segun el ID del hospital, se crea un nodo en el grafo con una lista vacía de conexiones.

    # Toma el par de conexiones del archivo connections.json
    for connection in connections:
        source = connection["source"] # Obtiene el hospital de origen...
        target = connection["target"] # ... y el hospital de destino.

        # Se usa doble corchete para entrar primero a la clave del nivel
        # exterior (el ID del hospital de origen) y luego a la clave del nivel interior, que es el ID del hospital destino.
        graph[source][target] = connection["distance_forward_km"] # Adjunta en el nodo de origen el nodo de destino...
        graph[target][source] = connection["distance_backward_km"] # ... y en el nodo de destino el nodo de origen

    return graph