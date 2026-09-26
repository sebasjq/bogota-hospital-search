from collections import deque
from graph import load_graph # Cargar el grafo de hospitales y sus conexiones desde archivos JSON.


def bfs(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    if origin == destination:
        return [origin]

    queue = deque([[origin]])
    visited = {origin}

    while queue: # Mientras haya rutas por explorar.
        path = queue.popleft() # Sacar la primera ruta de la cola.
        current = path[-1] # Último hospital de esa ruta.

        for neighbor in graph[current]:
            if neighbor in visited:
                continue

            new_path = path + [neighbor]

            if neighbor == destination:
                return new_path      # Destino descubierto: terminamos.

            visited.add(neighbor)
            queue.append(new_path)   # Agregar la nueva ruta al final.

    return None                       # No existe una ruta.

if __name__ == "__main__":
    graph = load_graph()
    route = bfs(graph, "H30", "H29")
    print(route)