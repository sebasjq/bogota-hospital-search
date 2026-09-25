const state = {
	hospitals: [],
	origin: "",
	destination: ""
};

const mapContainer = document.querySelector("#map");
const modeToggle = document.querySelector("#mode-toggle");
const modeLabel = document.querySelector("#mode-label");

function updateMarkers() {
	mapView.mark(state.origin, "is-origin");
	mapView.mark(state.destination, "is-destination");
}

function loadMapLibre() {
	return new Promise((resolve, reject) => {
		if (window.maplibregl) {
			resolve();
			return;
		}

		const stylesheet = document.createElement("link");
		stylesheet.rel = "stylesheet";
		stylesheet.href =
			"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

		document.head.appendChild(stylesheet);

		const script = document.createElement("script");
		script.src =
			"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

		script.onload = resolve;
		script.onerror = () =>
			reject(new Error("No se pudo cargar MapLibre GL JS"));

		document.head.appendChild(script);
	});
}

async function loadHospitals() {
	try {
		const response = await fetch("../data/hospitals.json");

		if (!response.ok) {
			throw new Error("No se pudo leer hospitals.json");
		}

		state.hospitals = await response.json();

		const selectHospital = id => {
			if (!state.origin || state.destination) {
				state.origin = id;
				state.destination = "";
			} else {
				state.destination = id;
			}

			updateMarkers();
		};

		if (window.APP_CONFIG?.mapTilerKey) {
			try {
				await loadMapLibre();

				await mapView.enableRemoteMap(
					mapContainer,
					state.hospitals,
					window.APP_CONFIG.mapTilerKey,
					selectHospital
				);
			} catch (error) {
				mapView.init(
					mapContainer,
					state.hospitals,
					selectHospital
				);

				console.error(error);
			}
		} else {
			mapView.init(
				mapContainer,
				state.hospitals,
				selectHospital
			);
		}
	} catch (error) {
		console.error(error);
	}
}


/* =========================
   CONTROLES DEL MAPA
   ========================= */

document.querySelector("#zoom-in").addEventListener("click", () => {
	mapView.zoomIn();
});

document.querySelector("#zoom-out").addEventListener("click", () => {
	mapView.zoomOut();
});

document.querySelector("#rotate-map").addEventListener("click", () => {
	mapView.rotate(45);
});


/* =========================
   CAMBIO 2D / 3D
   ========================= */

/*
	Guardamos nuestro propio estado visual.
	Esto evita que el icono se desincronice
	con el estado interno de mapView.
*/
let currentDisplayMode = "2d";

function updateModeControl() {
	modeLabel.textContent = currentDisplayMode === "3d" ? "map" : "view_in_ar";
	modeToggle.setAttribute(
		"aria-label",
		currentDisplayMode === "3d"
			? "Cambiar a vista 2D"
			: "Cambiar a vista 3D"
	);
}

updateModeControl();

modeToggle.addEventListener("click", () => {

	// Cambiar al modo contrario
	currentDisplayMode =
		currentDisplayMode === "3d"
			? "2d"
			: "3d";

	// Cambiar realmente la vista del mapa
	mapView.setRemoteMode(currentDisplayMode);

	updateModeControl();
});


/* =========================
   INICIALIZACIÓN
   ========================= */

loadHospitals();