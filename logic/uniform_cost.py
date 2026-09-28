import sys
import heapq
from pathlib import Path

# Agrega la carpeta raíz del proyecto al sys.path para poder importar módulos desde la carpeta logic y scripts
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logic.bfs import bfs
from logic.graph import load_graph # Importa la función load_graph desde el módulo graph.py en la carpeta logic

def uniform_cost(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    queue = [(0, [origin])] # Heap: cada elemento contiene (costo acumulado, camino)
    expanded = {} # Conjunto de nodos ya expandidos con el menor costo para evitar ciclos

    tree_edges = []  # Lista para almacenar las aristas del árbol de expansión

    while queue:
        cost, path = heapq.heappop(queue) # Remueve y retorna el elemento más pequeño de la cola de prioridad
        current = path[-1] # Nodo actual es el último nodo del camino

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado y su costo acumulado
            return path, cost, tree_edges, expanded

        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue

        for neighbor in graph[current]:

            if neighbor not in expanded:
                
                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_cost = cost + graph[current][neighbor] # Acumulador de costo para el nuevo camino

                tree_edges.append({
                    "parent": path.copy(),
                    "child": new_path.copy(),
                    "g": new_cost
                }) # Se agrega la arista al árbol de expansión

                heapq.heappush(queue, (new_cost, new_path)) # Se agrega el nuevo camino a la cola de prioridad para su posterior exploración.

        expanded[current] = len(expanded) + 1  # Se agrega el nodo actual al diccionario expanded con su número de expansión

    return None


# Ejecución principal para probar la función de costo uniforme y generar la visualización del árbol de expansión
if __name__ == "__main__":
    
    from scripts.search_tree_graph import search_tree_graph

    graph = load_graph()
    origin, destination = "H30", "H29"
    result = uniform_cost(graph, origin, destination)

    if result is not None:
        path, distance, tree_edges, expanded = result
        print(path, distance)

        search_tree_graph({
            "origin": origin,
            "path": path,
            "distance": distance,
            "tree_edges": tree_edges,
            "expanded": expanded,
        })