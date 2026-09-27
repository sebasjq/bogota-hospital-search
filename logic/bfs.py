from collections import deque
from graph import load_graph


def bfs(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    if origin == destination:
        return [origin]

    queue = deque([[origin]]) # Cola FIFO...
    expanded = set()

    while queue:
        path = queue.popleft()
        current = path[-1]

        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue  

        for neighbor in graph[current]:

            if neighbor in expanded: # Si el vecino es un nodo que ya ha sido expandido, se omite para evitar ciclos.
                continue

            new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.

            if neighbor == destination: # El camino encontrado es el destino...
                return new_path # ... se retorna el camino completo desde el origen hasta el destino.

            queue.append(new_path) # Se agrega el nuevo camino a la cola para su posterior exploración.

        expanded.add(current)  # Ya examinamos todos los vecinos de current

    return None


if __name__ == "__main__":
    graph = load_graph()
    route = bfs(graph, "H30", "H29")
    print(route)