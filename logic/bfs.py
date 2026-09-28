import sys
from collections import deque
from pathlib import Path

# Agrega la carpeta raíz del proyecto al sys.path para poder importar módulos desde la carpeta logic y scripts
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logic.graph import load_graph


def bfs(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")


    queue = deque([(0, [origin])]) # Cola FIFO con distancia acumulada y camino
    expanded = {} # Diccionario expanded que contendrá el id del hospital y el número de expansión

    tree_edges = []  # Lista para almacenar las aristas del árbol de expansión

    while queue:
        distance, path = queue.popleft()
        current = path[-1]

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado.
            return path, distance, tree_edges, expanded # Retorna el camino, la distancia acumulada, las aristas del árbol de expansión y los nodos expandidos
        
        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue  

        for neighbor in graph[current]:

            if neighbor not in expanded: # Si el vecino es un nodo que no ha sido expandido, se crea un nuevo camino y se agrega a la cola.

                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_distance = distance + graph[current][neighbor] # Se calcula la nueva distancia acumulada sumando la distancia al vecino.

                tree_edges.append({
                    "parent": path.copy(),
                    "child": new_path.copy(),
                    "g": new_distance
                    }) # Se agrega la arista al árbol de expansión
                
                queue.append((new_distance, new_path)) # Se agrega el nuevo camino a la cola para su posterior exploración.

        expanded[current] = len(expanded) + 1  # Se agrega el nodo actual al diccionario expanded con su número de expansión

    return None

# Ejecución principal para probar la función bfs y generar la visualización del árbol de expansión
if __name__ == "__main__":
    
    from scripts.search_tree_graph import search_tree_graph

    graph = load_graph()
    origin, destination = "H30", "H29"
    result = bfs(graph, origin, destination)

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
    