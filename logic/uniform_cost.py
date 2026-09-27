import heapq
from graph import load_graph


def uniform_cost(graph, origin, destination):
    if origin not in graph or destination not in graph:
        raise ValueError("Origin or destination does not exist")

    queue = [(0, [origin])] # Heap: cada elemento contiene (costo acumulado, camino)
    expanded = set() # Conjunto de nodos ya expandidos con el menor co para evitar ciclos

    while queue:
        cost, path = heapq.heappop(queue) # Remueve y retorna el elemento más pequeño de la cola de prioridad
        current = path[-1] # Nodo actual es el último nodo del camino

        if current == destination: # Si el nodo actual es el destino, se retorna el camino encontrado y su costo acumulado
            return path, cost

        if current in expanded: # Si ya se ha expandido este nodo, se omite para evitar ciclos.
            continue

        for neighbor in graph[current]:

            distance = graph[current][neighbor] # Obtiene la distancia al vecino

            if neighbor not in expanded:
                new_path = path + [neighbor] # Se construye el nuevo camino agregando el vecino al camino actual.
                new_cost = cost + distance # Acumulador de costo para el nuevo camino
                heapq.heappush(queue, (new_cost, new_path)) # Se agrega el nuevo camino a la cola de prioridad para su posterior exploración.

        expanded.add(current) # Se marca el nodo actual como expandido para no volver a procesarlo

    return None


if __name__ == "__main__":
    graph = load_graph()
    result = uniform_cost(graph, "H16", "H23")
    print(result)