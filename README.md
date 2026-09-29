# Bogotá Hospital Search

Aplicación local para seleccionar hospitales de Bogotá, ejecutar algoritmos de búsqueda y visualizar rutas sobre un mapa esquemático. El frontend está servido por una API Python local que reutiliza los algoritmos existentes sin modificarlos.

## Estado actual

- `backend/server.py`: servidor local, archivos estáticos y endpoint `POST /api/search`.
- `interface/js/map.js`: visor SVG offline, zoom, desplazamiento, marcadores y ruta calculada.
- `interface/js/app.js`: carga hospitales, sincroniza selectores, ejecuta búsquedas y presenta resultados.
- `data/hospitals.json`: fuente de verdad de hospitales en WGS84 (`latitude`, `longitude`).
- `data/connections.json`: aristas de la red con distancia de ida y vuelta.
- `logic/`: algoritmos de búsqueda existentes. Es una carpeta protegida y no forma parte de la integración modificada.

La base actual es deliberadamente esquemática. No debe confundirse con datos OSM: sirve para validar UX y coordenadas sin conexión. La interfaz también incluye una vista 3D opcional con MapLibre y MapTiler; el modo local sigue funcionando si no hay token.

## Integración de rutas

El flujo es `selector -> POST /api/search -> algoritmo Python -> geometría OSRM -> resultado JSON -> mapa y árbol`. El frontend envía `origin`, `destination` y `algorithm`. El backend selecciona exactamente una función de `logic/`, conserva su tupla de retorno y serializa `path`, `distance`, `tree_edges`, `expanded` y `route_geometry`. El mapa dibuja la geometría vial combinada de los tramos dirigidos de `path`.

Los algoritmos disponibles son `bfs`, `uniform_cost`, `greedy` y `a_star`. `connections.json` se carga mediante `logic.graph.load_graph()`: cada registro contiene `source`, `target`, `distance_forward_km` y `distance_backward_km`, y se convierte en dos aristas dirigidas con sus respectivos costos.

## Ejecutar la aplicación completa

Desde la raíz:

```powershell
python backend/server.py
```

Abrir `http://127.0.0.1:8000/interface/`. El botón **Calcular ruta** requiere origen, destino y algoritmo. Después del cálculo, el panel muestra algoritmo, distancia y recorrido; **Ver árbol de búsqueda** reutiliza los datos de expansión generados por el algoritmo.

Para comprobar el contrato sin navegador:

```powershell
@'{"origin":"H30","destination":"H29","algorithm":"a_star"}'@ | curl.exe -X POST http://127.0.0.1:8000/api/search -H "Content-Type: application/json" --data-binary @-
```

La carpeta `backend/` contiene la documentación específica del endpoint. Las carpetas `logic/` y `scripts/` se mantienen intactas; cualquier algoritmo nuevo debe integrarse desde el adaptador, sin cambiar sus contratos existentes.

## Activar la vista 3D remota

1. Crear una clave de desarrollo en MapTiler Cloud.
2. Abrir `interface/js/config.js` y asignarla a `mapTilerKey`.
3. Ejecutar el servidor local. La aplicación iniciará en 2D y quedará centrada y limitada a Bogotá.
4. Pulsar **Activar 3D** para animar la cámara, inclinar la vista y mostrar edificios extruidos. El mismo botón permite volver a 2D.

La vista remota obtiene el estilo, calles y edificios desde MapTiler, inclina la cámara y añade extrusiones cuando la fuente contiene edificios. El token no debe publicarse en el repositorio ni considerarse un secreto de backend: las claves usadas en frontend pueden ser visibles y deben restringirse por dominio o aplicación desde el proveedor.

Esta modalidad requiere Internet. Para el `.exe` completamente offline habrá que descargar/procesar los datos OSM y cambiar el estilo remoto por GeoJSON o MBTiles incluidos como recursos locales.

## Arquitectura recomendada

Para este equipo recomiendo **HTML/CSS/JavaScript + Tauri** como empaquetador final. Tauri genera un `.exe` pequeño usando el WebView del sistema; Electron también funciona, pero incluye Chromium y consume más memoria. No se debe usar ninguna URL de tiles o API durante la ejecución.

### Flujo de datos cartográficos

1. Descargar un extracto de Colombia desde [Geofabrik](https://download.geofabrik.de/south-america/colombia.html) o producir un recorte con BBBike. Revisar la licencia ODbL de OpenStreetMap y conservar la atribución.
2. Instalar `osmium-tool` y recortar con un polígono de Bogotá para reducir el archivo:

	 `osmium extract -p bogota.poly colombia-latest.osm.pbf -o bogota.osm.pbf`

3. Para una primera capa local sencilla, convertir carreteras y edificios a GeoJSON con GDAL (`ogr2ogr`). Para un mapa mayor, generar vector tiles MBTiles con Planetiler o Tilemaker. GeoJSON es más simple; MBTiles es más eficiente.
4. Copiar el resultado a `data/map/` y leerlo desde el mismo paquete. En Tauri, declarar esa carpeta como recurso incluido.
5. Reemplazar las polilíneas esquemáticas de `map.js` por una capa GeoJSON o por un renderer de tiles local. MapLibre GL JS solo es apropiado si el estilo y todos los tiles están locales.

### Edificios pseudo-3D

Es viable con MapLibre y `fill-extrusion` si el extracto tiene `building:levels` o `height`. Es una mejora posterior: en Intel UHD y 8 GB conviene limitar zoom, edificios y capas. Una vista inclinada con extrusiones simples es suficiente para la demostración académica.

### Preparación del grafo

Mantener el grafo separado de la representación visual. A partir de OSM, filtrar `highway`, dividir geometrías en intersecciones, crear nodos y aristas y guardar un formato propio como `data/graph/road-network.json` o SQLite. Añadir cada hospital al nodo vial más cercano. BFS/Dijkstra/A* consumirán ese contrato y la UI recibirá una ruta GeoJSON para dibujar.

```text
data/
	hospitals.json          # datos de dominio existentes
	map/                    # GeoJSON o MBTiles locales generados
	graph/                  # red vial normalizada para IA
	interface/
		index.html
		css/styles.css theme.css
		js/app.js map.js config.js tree.js tree_data.js
	backend/
		server.py
logic/
	bfs.py a_star.py greedy.py uniform_cost.py graph.py
scripts/
		fill_distances.py search_tree_graph.py
tools/                    # scripts de descarga/conversión
```

## Ejecutar la interfaz

Desde la raíz del proyecto, iniciar la capa de integración porque el navegador no puede invocar Python al abrir el HTML con `file://`:

```powershell
python backend/server.py
```

Abrir `http://127.0.0.1:8000/interface/`. En el `.exe` final, Tauri podrá servir los mismos recursos incluidos y arrancar el backend como proceso local.

## Desarrollo frente al ejecutable

Descarga, recorte OSM, conversión, generación de tiles y construcción del grafo son pasos de desarrollo/build. El ejecutable debe incluir únicamente HTML/CSS/JS, hospitales, mapa local, estilo local y, cuando corresponda, el grafo. La atribución de OSM debe permanecer visible en la aplicación o en una pantalla de créditos.
