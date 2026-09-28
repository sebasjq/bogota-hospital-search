# Datos

Esta carpeta contiene las fuentes de datos de dominio que comparten el backend y la interfaz.

## Archivos

- `hospitals.json`: lista de hospitales con `id`, `name`, `latitude` y `longitude`. El ID es la clave usada por selectores, grafo, algoritmos y mapa.
- `connections.json`: lista de conexiones entre hospitales. Cada registro tiene `source`, `target`, `distance_forward_km` y `distance_backward_km`. No se debe convertir manualmente en otra estructura: `logic/graph.py` ya crea el diccionario dirigido que consumen los algoritmos.
- `connection_routes.json`: caché separado de geometrías de calles por dirección, con claves como `H30->H25`. Se genera bajo demanda desde OSRM y no reemplaza ni modifica `connections.json`.

La interfaz usa las coordenadas de `hospitals.json` para pintar marcadores y el backend usa `connection_routes.json` para devolver la geometría vial real de la ruta. El backend carga estos archivos desde la raíz del proyecto.

## Extensión

Al agregar un hospital, debe tener un ID único y conexiones válidas. Las distancias deben estar expresadas en kilómetros. La actualización de distancias se realiza con el script existente de `scripts/`, que permanece separado de la API.