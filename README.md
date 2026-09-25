# Bogotá Hospital Search

Interfaz local para seleccionar hospitales de Bogotá y preparar la integración de algoritmos de búsqueda de Inteligencia Artificial. Esta primera fase no calcula rutas: muestra una base cartográfica esquemática sin recursos externos, carga `data/hospitals.json` y deja definidos los puntos de extensión.

## Estado actual

- `interface/map.js`: visor SVG offline, zoom, desplazamiento y marcadores.
- `interface/app.js`: carga hospitales, sincroniza selectores y selección sobre el mapa.
- `data/hospitals.json`: fuente de verdad de hospitales en WGS84 (`latitude`, `longitude`).
- `data/connections.json`: reservado para la red/grafo futuro.
- `logic/search.py`: reservado para BFS, Dijkstra, A* u otro algoritmo.

La base actual es deliberadamente esquemática. No debe confundirse con datos OSM: sirve para validar UX y coordenadas sin conexión. La interfaz también incluye una vista 3D opcional con MapLibre y MapTiler; el modo local sigue funcionando si no hay token.

## Activar la vista 3D remota

1. Crear una clave de desarrollo en MapTiler Cloud.
2. Abrir `interface/config.js` y asignarla a `mapTilerKey`.
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
	index.html app.js map.js styles.css
logic/
	search.py               # algoritmos, fase posterior
tools/                    # scripts de descarga/conversión
```

## Ejecutar la interfaz

Desde la raíz del proyecto, iniciar un servidor estático porque el navegador restringe `fetch` de JSON con `file://`:

```powershell
python -m http.server 8000
```

Abrir `http://localhost:8000/interface/`. En el `.exe` final, Tauri servirá los mismos recursos incluidos y no habrá dependencia de Internet.

## Desarrollo frente al ejecutable

Descarga, recorte OSM, conversión, generación de tiles y construcción del grafo son pasos de desarrollo/build. El ejecutable debe incluir únicamente HTML/CSS/JS, hospitales, mapa local, estilo local y, cuando corresponda, el grafo. La atribución de OSM debe permanecer visible en la aplicación o en una pantalla de créditos.
