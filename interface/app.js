const state = { hospitals: [], origin: "", destination: "" };
const originSelect = document.querySelector("#origin-select");
const destinationSelect = document.querySelector("#destination-select");
const statusPanel = document.querySelector("#route-status");
const enable3dButton = document.querySelector("#enable-3d");

function addOptions(select) {
	state.hospitals.forEach(hospital => {
		const option = document.createElement("option");
		option.value = hospital.id;
		option.textContent = `${hospital.id} · ${hospital.name}`;
		select.appendChild(option);
	});
}

function updateMarkers() {
	mapView.mark(state.origin, "is-origin");
	mapView.mark(state.destination, "is-destination");
}

function updateStatus(title, detail, ready = false) {
	statusPanel.classList.toggle("is-ready", ready);
	statusPanel.querySelector("strong").textContent = title;
	statusPanel.querySelector("p").textContent = detail;
}

function loadMapLibre() {
	return new Promise((resolve, reject) => {
		if (window.maplibregl) { resolve(); return; }
		const stylesheet = document.createElement("link");
		stylesheet.rel = "stylesheet";
		stylesheet.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
		document.head.appendChild(stylesheet);
		const script = document.createElement("script");
		script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
		script.onload = resolve;
		script.onerror = () => reject(new Error("No se pudo cargar MapLibre GL JS"));
		document.head.appendChild(script);
	});
}

async function enableRemote3d() {
	const key = window.APP_CONFIG?.mapTilerKey;
	if (!key) {
		updateStatus("Falta el token de MapTiler", "Añade tu clave en interface/config.js para activar la vista 3D.");
		return;
	}
	try {
		enable3dButton.disabled = true;
		if (!mapView.isRemote()) {
			updateStatus("Cargando mapa de Bogotá", "Se está conectando al servicio de mapas...");
			await loadMapLibre();
			await mapView.enableRemoteMap(document.querySelector("#map"), state.hospitals, key, id => {
				if (!state.origin || state.destination) { state.origin = id; state.destination = ""; originSelect.value = id; destinationSelect.value = ""; }
				else { state.destination = id; destinationSelect.value = id; }
				updateMarkers();
			});
		}
		mapView.setRemoteMode("3d");
		updateMarkers();
		enable3dButton.textContent = "Volver a 2D";
		updateStatus("Vista 3D activa", "Cámara inclinada y edificios extruidos de Bogotá.", true);
	} catch (error) {
		updateStatus("No se pudo cargar la vista 3D", "Comprueba la conexión y la clave de MapTiler.");
		console.error(error);
	} finally { enable3dButton.disabled = false; }
}

async function toggle3d() {
	if (mapView.isRemote() && mapView.getMode() === "3d") {
		mapView.setRemoteMode("2d");
		enable3dButton.textContent = "Activar 3D";
		updateStatus("Vista 2D activa", "Calles y hospitales visibles en Bogotá.", true);
		return;
	}
	await enableRemote3d();
}

async function loadHospitals() {
	try {
		const response = await fetch("../data/hospitals.json");
		if (!response.ok) throw new Error("No se pudo leer hospitals.json");
		state.hospitals = await response.json();
		addOptions(originSelect); addOptions(destinationSelect);
		document.querySelector("#hospital-count").textContent = `${state.hospitals.length} hospitales`;
		const selectHospital = id => {
			if (!state.origin || state.destination) { state.origin = id; state.destination = ""; originSelect.value = id; destinationSelect.value = ""; }
			else { state.destination = id; destinationSelect.value = id; }
			updateMarkers();
		};
		if (window.APP_CONFIG?.mapTilerKey) {
			try {
				await loadMapLibre();
				await mapView.enableRemoteMap(document.querySelector("#map"), state.hospitals, window.APP_CONFIG.mapTilerKey, selectHospital);
				updateStatus("Vista 2D activa", "Calles y hospitales visibles en Bogotá.", true);
			} catch (error) {
				mapView.init(document.querySelector("#map"), state.hospitals, selectHospital);
				updateStatus("Modo local activo", "No se pudo cargar el mapa remoto; se usa la vista local.");
				console.error(error);
			}
		} else {
			mapView.init(document.querySelector("#map"), state.hospitals, selectHospital);
		}
	} catch (error) {
		updateStatus("No se cargaron los datos", "Ejecuta la interfaz desde un servidor local para leer el JSON.");
		console.error(error);
	}
}

originSelect.addEventListener("change", event => { state.origin = event.target.value; updateMarkers(); });
destinationSelect.addEventListener("change", event => { state.destination = event.target.value; updateMarkers(); });
document.querySelector("#route-form").addEventListener("submit", event => {
	event.preventDefault();
	if (!state.origin || !state.destination || state.origin === state.destination) { updateStatus("Selecciona dos hospitales distintos", "Elige un origen y un destino para continuar."); return; }
	updateStatus("Parámetros listos", "La ruta se calculará cuando se conecte el algoritmo de búsqueda.", true);
});
document.querySelector("#zoom-in").addEventListener("click", () => mapView.setZoom(1.2));
document.querySelector("#zoom-out").addEventListener("click", () => mapView.setZoom(0.85));
document.querySelector("#reset-view").addEventListener("click", () => mapView.reset());
enable3dButton.addEventListener("click", toggle3d);
loadHospitals();
