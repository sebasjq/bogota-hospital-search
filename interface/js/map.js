const mapView = (() => {
	const bounds = { west: -74.23, east: -73.98, south: 4.45, north: 4.82 };
	let svg; let viewport; let remoteMap; let remoteMarkers = new Map(); let remoteMode = "2d"; let scale = 1; let rotation = 0; let offsetX = 0; let offsetY = 0; let dragStart;
	function project(longitude, latitude) { return { x: ((longitude - bounds.west) / (bounds.east - bounds.west)) * 1000, y: ((bounds.north - latitude) / (bounds.north - bounds.south)) * 1400 }; }
	function transform() { viewport.setAttribute("transform", `translate(${offsetX} ${offsetY}) rotate(${rotation} 500 700) scale(${scale})`); }
	function line(points, className) {
		const element = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
		element.setAttribute("points", points.map(([longitude, latitude]) => { const point = project(longitude, latitude); return `${point.x},${point.y}`; }).join(" "));
		element.setAttribute("class", className); return element;
	}
	function init(container, hospitals, onSelect) {
		svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 1000 1400"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Mapa local esquemático de Bogotá");
		viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
		const background = document.createElementNS("http://www.w3.org/2000/svg", "rect"); background.setAttribute("width", "1000"); background.setAttribute("height", "1400"); background.setAttribute("class", "map-background"); viewport.appendChild(background);
		viewport.appendChild(line([[-74.16, 4.80], [-74.15, 4.73], [-74.17, 4.67], [-74.16, 4.60], [-74.18, 4.51]], "river"));
		const avenues = [[[-74.20, 4.65], [-73.99, 4.68]], [[-74.18, 4.59], [-74.00, 4.62]], [[-74.19, 4.54], [-74.01, 4.57]], [[-74.10, 4.47], [-74.08, 4.80]], [[-74.05, 4.48], [-74.06, 4.80]], [[-74.15, 4.48], [-74.14, 4.80]], [[-74.20, 4.71], [-74.00, 4.72]], [[-74.12, 4.45], [-74.12, 4.82]]];
		avenues.forEach(path => viewport.appendChild(line(path, "avenue")));
		[["Suba", -74.11, 4.77], ["Engativá", -74.14, 4.70], ["Chapinero", -74.06, 4.66], ["Kennedy", -74.16, 4.61], ["Usme", -74.10, 4.50]].forEach(([text, longitude, latitude]) => { const point = project(longitude, latitude); const label = document.createElementNS("http://www.w3.org/2000/svg", "text"); label.setAttribute("x", point.x); label.setAttribute("y", point.y); label.textContent = text; label.setAttribute("class", "district-label"); viewport.appendChild(label); });
		hospitals.forEach(hospital => { const point = project(hospital.longitude, hospital.latitude); const group = document.createElementNS("http://www.w3.org/2000/svg", "g"); group.setAttribute("class", "hospital-marker"); group.dataset.id = hospital.id; group.setAttribute("role", "button"); group.setAttribute("tabindex", "0"); group.setAttribute("aria-label", hospital.name); group.setAttribute("transform", `translate(${point.x} ${point.y})`); group.innerHTML = '<g class="marker-content"><rect class="marker-backdrop" x="-12" y="-12" width="24" height="24" rx="6"></rect><path class="marker-hospital" d="M-3.5-9h7v5.5H9v7H3.5V9h-7V3.5H-9v-7h5.5z"></path><path class="marker-location" d="M0 11C-1.7 8.2-7 3.4-7-1.5A7 7 0 1 1 7-1.5C7 3.4 1.7 8.2 0 11Zm0-9.2A2.8 2.8 0 1 0 0-3.8a2.8 2.8 0 0 0 0 5.6Z"></path></g>'; const selectMarker = () => onSelect(hospital.id); group.addEventListener("click", selectMarker); group.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectMarker(); } }); viewport.appendChild(group); });
		svg.appendChild(viewport); container.appendChild(svg);
		svg.addEventListener("wheel", event => { event.preventDefault(); setZoom(scale + (event.deltaY < 0 ? 0.15 : -0.15)); }, { passive: false });
		svg.addEventListener("pointerdown", event => { dragStart = { x: event.clientX - offsetX, y: event.clientY - offsetY }; svg.setPointerCapture(event.pointerId); });
		svg.addEventListener("pointermove", event => { if (dragStart) { offsetX = event.clientX - dragStart.x; offsetY = event.clientY - dragStart.y; transform(); } }); svg.addEventListener("pointerup", () => { dragStart = undefined; });
	}
	function setZoom(nextScale) { if (remoteMap) { remoteMap.zoomTo(Math.min(16, Math.max(10, remoteMap.getZoom() + (nextScale > 1 ? 1 : -1)))); return; } scale = Math.min(3, Math.max(0.8, nextScale)); transform(); }
	function zoomIn() { setZoom(remoteMap ? 2 : scale + 0.2); }
	function zoomOut() { setZoom(remoteMap ? 0 : scale - 0.2); }
	function rotate(degrees) { if (remoteMap) { remoteMap.rotateTo(remoteMap.getBearing() + degrees, { duration: 500 }); return; } rotation = (rotation + degrees) % 360; transform(); }
	function reset() { if (remoteMap) { remoteMap.flyTo({ center: [-74.08, 4.65], zoom: remoteMode === "3d" ? 14 : 11.3, pitch: remoteMode === "3d" ? 55 : 0, bearing: remoteMode === "3d" ? -20 : 0 }); return; } scale = 1; rotation = 0; offsetX = 0; offsetY = 0; transform(); }
	function mark(id, type) {
		if (remoteMap) {
			remoteMarkers.forEach((marker, markerId) => marker.getElement().classList.toggle(type, markerId === id));
			return;
		}
		document.querySelectorAll(".hospital-marker").forEach(marker => marker.classList.toggle(type, marker.dataset.id === id));
	}
	function enableRemoteMap(container, hospitals, key, onSelect) {
		if (remoteMap) return Promise.resolve();
		container.replaceChildren();
		remoteMap = new maplibregl.Map({
			container,
			style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}`,
			center: [-74.08, 4.65], zoom: 11.3, pitch: 0, bearing: 0,
			maxBounds: [[-74.23, 4.45], [-73.98, 4.82]],
			maxZoom: 16,
			renderWorldCopies: false,
			antialias: true
		});
		return new Promise((resolve, reject) => {
			remoteMap.once("error", event => { if (event.error) reject(event.error); });
		remoteMap.on("load", () => {
			const styleLayers = remoteMap.getStyle().layers || [];
			const buildingLayer = styleLayers.find(layer => layer.type === "fill" && layer['source-layer'] === "building");
			if (buildingLayer) {
				remoteMap.addLayer({ id: "bogota-buildings-3d", type: "fill-extrusion", source: buildingLayer.source, "source-layer": "building", layout: { visibility: "none" }, paint: { "fill-extrusion-color": "#b8aaa0", "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0], "fill-extrusion-opacity": 0.78 } });
			}
			hospitals.forEach(hospital => {
				const element = document.createElement("button");
				element.type = "button"; element.className = "remote-hospital-marker"; element.title = hospital.name; element.setAttribute("aria-label", hospital.name); element.dataset.id = hospital.id; element.innerHTML = '<span class="remote-marker-content"><span class="remote-marker-backdrop" aria-hidden="true"></span><span class="material-symbols-rounded remote-marker-hospital" aria-hidden="true">medical_services</span><span class="material-symbols-rounded remote-marker-location" aria-hidden="true">location_on</span></span>';
				element.addEventListener("click", () => onSelect(hospital.id));
				const marker = new maplibregl.Marker({ element }).setLngLat([hospital.longitude, hospital.latitude]).addTo(remoteMap);
				remoteMarkers.set(hospital.id, marker);
			});
				setRemoteMode(remoteMode);
			resolve();
		});
		});
	}
	function setRemoteMode(mode) {
		remoteMode = mode;
		if (!remoteMap) return;
		if (remoteMap.getLayer("bogota-buildings-3d")) remoteMap.setLayoutProperty("bogota-buildings-3d", "visibility", mode === "3d" ? "visible" : "none");
		remoteMap.easeTo({ center: [-74.08, 4.65], zoom: mode === "3d" ? 14 : 11.3, pitch: mode === "3d" ? 55 : 0, bearing: mode === "3d" ? -20 : 0, duration: 2200 });
	}
	function isRemote() { return Boolean(remoteMap); }
	function getMode() { return remoteMode; }
	return { init, setZoom, zoomIn, zoomOut, rotate, reset, mark, enableRemoteMap, setRemoteMode, isRemote, getMode };
})();
