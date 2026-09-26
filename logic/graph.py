import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

def load_graph():
    with (DATA_DIR / "hospitals.json").open(encoding="utf-8") as file:
        hospitals = json.load(file)

    with (DATA_DIR / "connections.json").open(encoding="utf-8") as file:
        connections = json.load(file)

    graph = {}

    for hospital in hospitals:
        hospital_id = hospital["id"] # Se obtiene el ID del hospital.
        graph[hospital_id] = [] # Segun el ID del hospital, se crea un nodo en el grafo con una lista vacía de conexiones.

    # Toma el par de conexiones del archivo connections.json
    for connection in connections:
        source = connection["source"] # Obtiene el hospital de origen y destino de la conexión...
        target = connection["target"] # ... y el hospital de destino.

        graph[source].append(target) # Adjunta en el nodo de origen el nodo de destino...
        graph[target].append(source) # ... y en el nodo de destino el nodo de origen, ya que es un grafo no dirigido.

    return graph