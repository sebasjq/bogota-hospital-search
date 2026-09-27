from collections import deque
from graph import load_graph


def bfs(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    queue = deque([(0, [origin])]) # Cola FIFO con distancia acumulada y camino
    expanded = set()

    while queue:
        distance, path = queue.popleft()
        current = path[-1]

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado.
            return path, distance
        
        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue  

        for neighbor in graph[current]:

            if neighbor not in expanded: # Si el vecino es un nodo que no ha sido expandido, se crea un nuevo camino y se agrega a la cola.

                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_distance = distance + graph[current][neighbor] # Se calcula la nueva distancia acumulada sumando la distancia al vecino.
                queue.append((new_distance, new_path)) # Se agrega el nuevo camino a la cola para su posterior exploración.

        expanded.add(current)  # Ya examinamos todos los vecinos de current

    return None


if __name__ == "__main__":
    graph = load_graph()
    route = bfs(graph, "H16", "H23")
    print(route)