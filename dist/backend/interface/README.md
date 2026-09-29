# Interfaz

La interfaz es una aplicación estática de HTML, CSS y JavaScript. `index.html` compone los controles, `css/styles.css` conserva el lenguaje visual glass y los archivos de `js/` implementan el mapa, la selección y las visualizaciones.

## Flujo

`app.js` carga los hospitales, mantiene origen/destino/algoritmo y envía una petición `POST ../api/search`. Al recibir la respuesta, llama a `mapView.setRoute(result.path, result.route_geometry)` y muestra la información recibida. `tree.js` usa `tree_edges` y `expanded` para generar el árbol; no vuelve a ejecutar ningún algoritmo.

`map.js` soporta el mapa SVG local y la vista MapLibre opcional. La línea usa `result.route_geometry`, que contiene coordenadas de calles reales; los IDs de `path` se mantienen para el árbol, los marcadores y la trazabilidad. Si no hay geometría, la interfaz muestra un error y no dibuja una línea recta alternativa.

## Archivos importantes

- `index.html`: controles, panel de resultados y popup del árbol.
- `js/app.js`: estado de la aplicación y comunicación con la API.
- `js/map.js`: marcadores, navegación y capa de ruta.
- `js/tree.js`: renderer reutilizable basado en `vis-network`.
- `js/tree_data.js`: resultado precargado para abrir el árbol desde el popup.
- `css/styles.css`: estilos de controles, resultado, línea de ruta y modal.

La interfaz debe ejecutarse a través de `backend/server.py` o de un servidor estático compatible con una API en `/api/search`; abrir el HTML directamente no permite completar el flujo de comunicación.