# Capa de integración

`server.py` es el puente local entre la interfaz JavaScript y los algoritmos Python. Usa únicamente la biblioteca estándar (`http.server`) y no duplica ni modifica la lógica de `logic/` o `scripts/`.

## Ejecución

Desde la raíz del proyecto:

```powershell
python backend/server.py
```

Luego se abre `http://127.0.0.1:8000/interface/`. El mismo proceso entrega los archivos estáticos y la API, por lo que el frontend puede usar rutas relativas.

## API

`POST /api/search` recibe:

```json
{"origin": "H30", "destination": "H29", "algorithm": "a_star"}
```

`algorithm` puede ser `bfs`, `uniform_cost`, `greedy` o `a_star`. La respuesta conserva el resultado de los algoritmos: `path`, `distance`, `tree_edges` y `expanded`, además de los IDs y el nombre del algoritmo. Voraz y A* también incluyen `heuristic`.

La respuesta incluye `route_geometry`, una secuencia GeoJSON de coordenadas `[longitud, latitud]`. El adaptador obtiene la geometría vial de cada tramo dirigido mediante OSRM y la combina siguiendo `path`. Los tramos ya consultados se guardan en `data/connection_routes.json`; `data/connections.json` conserva únicamente las distancias y no se reescribe al seleccionar rutas.

La primera consulta de una conexión requiere Internet. Las siguientes reutilizan el caché local. Si OSRM no está disponible, la API devuelve un error y la interfaz no dibuja una línea recta engañosa.

`GET /api/hospitals` devuelve el catálogo de hospitales y `GET /api/health` verifica que el servidor esté activo.

Los errores de validación responden con HTTP 400 y un campo `error`; los errores inesperados responden con HTTP 500.