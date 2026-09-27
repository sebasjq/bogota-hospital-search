import heapq
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from graph import load_graph

# Calcula la distancia directa entre dos hospitales usando la fórmula del haversine.
def direct_distance_km(start, end):

    lat1 = radians(start["latitude"]) # Convierte la latitud del hospital de inicio a radianes.
    lon1 = radians(start["longitude"]) # Convierte la longitud del hospital de inicio a radianes.
    lat2 = radians(end["latitude"]) # Convierte la latitud del hospital de destino a radianes.
    lon2 = radians(end["longitude"]) # Convierte la longitud del hospital de destino a radianes.

    lat_difference = lat2 - lat1
    lon_difference = lon2 - lon1

    a = (sin(lat_difference / 2) ** 2 + cos(lat1) * cos(lat2) * sin(lon_difference / 2) ** 2)
    distance = 2 * 6371 * asin(sqrt(a))

    return round(distance, 3)

def greedy(graph, hospitals, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    initial_heuristic =  direct_distance_km(hospitals[origin], hospitals[destination]) # Distancia directa desde el origen hasta el destino
    queue = [(initial_heuristic, 0, [origin])] # Heap: cada elemento contiene (distancia directa al destino, distancia acumulada, camino)

    expanded = set() # Conjunto de nodos ya expandidos para evitar ciclos

    while queue:

        # Se elige el nodo con la menor distancia directa al destino (heurística) para expandirlo primero.
        _, distance, path = heapq.heappop(queue)
        current = path[-1] # Nodo actual es el último nodo del camino

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado
            return path, distance

        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue

        for neighbor in graph[current]:

            if neighbor not in expanded:
                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_distance = distance + graph[current][neighbor] # Se calcula la nueva distancia acumulada sumando la distancia al vecino.

                new_heuristic = direct_distance_km(hospitals[neighbor], hospitals[destination]) # Calcula la distancia directa desde el vecino hasta el destino
                heapq.heappush(queue, (new_heuristic, new_distance, new_path)) # Se agrega el nuevo camino a la cola de prioridad para su posterior exploración.

        expanded.add(current) # Se marca el nodo actual como expandido para no volver a procesarlo

    return None

if __name__ == "__main__":
    graph = load_graph()

    # Leer la lista de hospitales.
    data_folder = Path(__file__).resolve().parents[1] / "data"
    with (data_folder / "hospitals.json").open(encoding="utf-8") as file:
        hospital_list = json.load(file)

    # Crear un diccionario para buscar cada hospital por su ID.
    hospitals = {hospital["id"]: hospital for hospital in hospital_list}

    # Se requiere enviarle todos los hospitales con su longitud y latitud 
    # para que pueda calcular la distancia directa entre ellos y el destino.
    result = greedy(graph, hospitals, "H30", "H29")
    print(result)