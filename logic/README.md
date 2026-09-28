# Lógica de búsqueda

Esta carpeta construye el grafo de hospitales y calcula rutas entre un origen y un destino. Los IDs de hospitales y las distancias de cada conexión provienen de `data/hospitals.json` y `data/connections.json`.

| Archivo | Qué hace | Función y retorno |
| --- | --- | --- |
| `graph.py` | Carga los hospitales como nodos y las conexiones con sus distancias de ida y vuelta como aristas. | `load_graph()` devuelve un diccionario `graph[origen][destino] = distancia_km`. |
| `bfs.py` | Busca por anchura: explora primero los caminos con menos conexiones. | `bfs(graph, origin, destination)` devuelve el resultado común descrito abajo. |
| `uniform_cost.py` | Busca por costo uniforme: prioriza la menor distancia acumulada `g`. | `uniform_cost(graph, origin, destination)` devuelve el resultado común. |
| `greedy.py` | Busca de forma voraz: prioriza la distancia directa estimada `h` hasta el destino. | `greedy(graph, hospitals, origin, destination)` devuelve el resultado común. |
| `a_star.py` | Busca con A*: prioriza `f = g + h`. | `a_star(graph, hospitals, origin, destination)` devuelve el resultado común. |

En los dos últimos métodos, `hospitals` es un diccionario de datos de hospitales indexado por ID; la heurística `h` se calcula con `direct_distance_km()` de `scripts/fill_distances.py`. Las distancias `g` son la suma de los pesos guardados en `connections.json`.

## Resultado de los cuatro métodos

Si encuentran una ruta, devuelven la tupla:

```python
path, distance, tree_edges, expanded
```

- `path`: lista ordenada de IDs desde el origen hasta el destino.
- `distance`: distancia total acumulada de esa ruta, en kilómetros.
- `tree_edges`: conexiones generadas durante la búsqueda. Cada elemento incluye `parent` y `child` como caminos completos, y `g` como costo acumulado; Voraz añade `h` y A* añade `h` y `f`.
- `expanded`: diccionario por ID de hospital con `order` (número de expansión) y `path` (camino correspondiente a la aparición expandida en el árbol).

Si no existe una ruta, devuelven `None`. Si el origen o el destino no está en el grafo, lanzan `ValueError`.

El bloque `if __name__ == "__main__"` de cada método sirve para probarlo con un origen y destino definidos en el archivo: imprime la ruta y la distancia y genera los datos para visualizar su árbol. Al importar la función desde otra parte de la aplicación, ese bloque no se ejecuta.
