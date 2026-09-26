const state = {
	hospitals: [],
	origin: "",
	destination: "",
	model: "",
	activeSelection: "origin"
};

const mapContainer = document.querySelector("#map");
const modeToggle = document.querySelector("#mode-toggle");
const modeLabel = document.querySelector("#mode-label");

const routeForm = document.querySelector("#route-form");
const calculateRoute = document.querySelector("#calculate-route");
const routeStatus = document.querySelector("#route-status");

const originPicker = document.querySelector("#origin-select");
const destinationPicker = document.querySelector("#destination-select");
const modelPicker = document.querySelector("#model-select");
const hospitalNotice = document.querySelector("#hospital-notice");
const hospitalNoticeText = document.querySelector("#hospital-notice-text");
let hospitalNoticeTimer;
let hospitalNoticeFrame;

const routeModels = [
	{ id: "bfs", name: "Anchura", icon: "account_tree" },
	{ id: "dijkstra", name: "Costo uniforme", icon: "paid" },
	{ id: "greedy", name: "Voraz", icon: "near_me" },
	{ id: "astar", name: "A*", icon: "star" }
];


/* =========================
   MARCADORES
========================= */

function updateMarkers() {
	mapView.mark(state.origin, "is-origin");
	mapView.mark(state.destination, "is-destination");
}


/* =========================
   ESTADO DE RUTA
========================= */

function updateRouteControls() {
	calculateRoute.disabled =
		!state.origin ||
		!state.destination ||
		!state.model;
}

function closeModelPicker() {
	modelPicker.classList.remove("is-open");
	modelPicker.setAttribute("aria-expanded", "false");
}

function updateModelPicker(value) {
	const text = modelPicker.querySelector(".model-picker-text");
	const icon = modelPicker.querySelector(".model-picker-icon");
	const model = routeModels.find(item => item.id === value);

	text.textContent = model ? model.name : "Elegir modelo";
	icon.textContent = model ? model.icon : "account_tree";
	text.classList.toggle("is-selected", Boolean(model));

	modelPicker.querySelectorAll(".model-option").forEach(option => {
		const selected = option.dataset.value === value;
		option.classList.toggle("is-selected", selected);
		option.setAttribute("aria-selected", selected ? "true" : "false");
	});
}

function setupModelPicker() {
	const optionsContainer = modelPicker.querySelector(".model-options");

	routeModels.forEach(model => {
		const option = document.createElement("button");
		option.type = "button";
		option.className = "model-option";
		option.dataset.value = model.id;
		option.setAttribute("role", "option");
		option.innerHTML = `
			<span class="model-option-copy">
				<strong>${model.name}</strong>
			</span>
		`;
		option.addEventListener("click", event => {
			event.stopPropagation();
			state.model = model.id;
			updateModelPicker(state.model);
			updateRouteControls();
			closeModelPicker();
		});
		optionsContainer.appendChild(option);
	});

	modelPicker.querySelector(".model-picker-button").addEventListener("click", event => {
		event.stopPropagation();
		const isOpen = modelPicker.classList.contains("is-open");
		closeAllPickers();
		closeModelPicker();
		if (!isOpen) {
			modelPicker.classList.add("is-open");
			modelPicker.setAttribute("aria-expanded", "true");
		}
	});

	modelPicker.addEventListener("keydown", event => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			modelPicker.querySelector(".model-picker-button").click();
		}
		if (event.key === "Escape") closeModelPicker();
	});

	updateModelPicker("");
}


/* =========================
   SELECCIÓN DESDE EL MAPA
========================= */

function setActiveSelection(type) {
	state.activeSelection = type === "destination" ? "destination" : "origin";
	originPicker.classList.toggle("is-active", state.activeSelection === "origin");
	destinationPicker.classList.toggle("is-active", state.activeSelection === "destination");
}

function showHospitalNotice(hospital, type) {
	const selectionLabel = type === "destination" ? "Destino" : "Origen";

	hospitalNoticeText.textContent = `${selectionLabel}: ${hospital.name}`;
	hospitalNotice.classList.remove("is-visible");
	cancelAnimationFrame(hospitalNoticeFrame);
	hospitalNoticeFrame = requestAnimationFrame(() => hospitalNotice.classList.add("is-visible"));

	clearTimeout(hospitalNoticeTimer);
	hospitalNoticeTimer = setTimeout(() => {
		hospitalNotice.classList.remove("is-visible");
	}, 5200);
}

function clearHospital(type) {
	const targetType = type === "destination" ? "destination" : "origin";

	if (targetType === "origin") {
		state.origin = "";
	} else {
		state.destination = "";
	}

	updateHospitalPicker(originPicker, state.origin);
	updateHospitalPicker(destinationPicker, state.destination);
	updateMarkers();
	updateRouteControls();
	setActiveSelection(targetType);
}

function selectHospital(id, type) {
	const isMapSelection = !type;
	const targetType = isMapSelection
		? id === state.origin
			? "origin"
			: id === state.destination
				? "destination"
				: !state.origin
					? "origin"
					: "destination"
		: type === "destination" ? "destination" : "origin";

	if (isMapSelection && (id === state.origin || id === state.destination)) {
		clearHospital(targetType);
		return;
	}

	state.activeSelection = targetType;
	const hospital = state.hospitals.find(item => item.id === id);

	if (targetType === "origin") {
		state.origin = id;
	} else {
		state.destination = id;
	}

	updateHospitalPicker(originPicker, state.origin);
	updateHospitalPicker(destinationPicker, state.destination);

	if (currentDisplayMode === "3d") {
		mapView.focusHospital(id);
	}

	updateMarkers();
	updateRouteControls();
	setActiveSelection(targetType);
	if (hospital) showHospitalNotice(hospital, targetType);
}


/* =========================
   SELECTOR PERSONALIZADO
========================= */

function createHospitalOptions(picker, type) {

	const optionsContainer =
		picker.querySelector(".hospital-options");

	optionsContainer.innerHTML = "";

	state.hospitals.forEach(hospital => {

		const option = document.createElement("button");

		option.type = "button";
		option.className = "hospital-option";
		option.dataset.value = hospital.id;

		option.setAttribute("role", "option");

		option.innerHTML = `
			<span class="hospital-option-text">
				${hospital.name}
			</span>
		`;

		option.addEventListener("click", event => {

			event.stopPropagation();

			setActiveSelection(type);
			selectHospital(hospital.id, type);

			closeAllPickers();
		});

		optionsContainer.appendChild(option);
	});
}


function updateHospitalPicker(picker, value) {

	const text =
		picker.querySelector(".hospital-picker-text");

	const options =
		picker.querySelectorAll(".hospital-option");
	const arrow = picker.querySelector(".hospital-picker-arrow");

	const hospital =
		state.hospitals.find(item => item.id === value);

	if (hospital) {

		text.textContent = hospital.name;
		text.classList.add("is-selected");
		arrow.classList.add("is-clearable");

	} else {

		text.textContent =
			text.dataset.placeholder;

		text.classList.remove("is-selected");
		arrow.classList.remove("is-clearable");
	}

	options.forEach(option => {

		const selected =
			option.dataset.value === value;

		option.classList.toggle(
			"is-selected",
			selected
		);

		option.setAttribute(
			"aria-selected",
			selected ? "true" : "false"
		);
	});
}


function togglePicker(picker) {

	const isOpen =
		picker.classList.contains("is-open");

	closeAllPickers();

	if (!isOpen) {
		picker.classList.add("is-open");
		picker.setAttribute(
			"aria-expanded",
			"true"
		);
	}
}


function closeAllPickers() {

	document
		.querySelectorAll(".hospital-picker.is-open")
		.forEach(picker => {

			picker.classList.remove("is-open");

			picker.setAttribute(
				"aria-expanded",
				"false"
			);
		});
}


function setupHospitalPicker(picker, type) {

	createHospitalOptions(
		picker,
		type
	);

	updateHospitalPicker(
		picker,
		""
	);

	const button =
		picker.querySelector(".hospital-picker-button");
	const arrow =
		picker.querySelector(".hospital-picker-arrow");

	button.addEventListener("click", event => {

		event.stopPropagation();
		setActiveSelection(type);
		togglePicker(picker);
	});

	arrow.addEventListener("click", event => {
		event.stopPropagation();
		if (picker.querySelector(".hospital-picker-text").classList.contains("is-selected")) {
			clearHospital(type);
			return;
		}

		setActiveSelection(type);
		togglePicker(picker);
	});


	picker.addEventListener("keydown", event => {

		if (
			event.key === "Enter" ||
			event.key === " "
		) {
			event.preventDefault();

			togglePicker(picker);
		}

		if (event.key === "Escape") {
			closeAllPickers();
		}
	});
}


/* =========================
   MAPLIBRE
========================= */

function loadMapLibre() {

	return new Promise((resolve, reject) => {

		if (window.maplibregl) {
			resolve();
			return;
		}

		const stylesheet =
			document.createElement("link");

		stylesheet.rel = "stylesheet";

		stylesheet.href =
			"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

		document.head.appendChild(
			stylesheet
		);

		const script =
			document.createElement("script");

		script.src =
			"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

		script.onload = resolve;

		script.onerror = () =>
			reject(
				new Error(
					"No se pudo cargar MapLibre GL JS"
				)
			);

		document.head.appendChild(
			script
		);
	});
}


/* =========================
   CARGAR HOSPITALES
========================= */

async function loadHospitals() {

	try {

		const response =
			await fetch("../data/hospitals.json");

		if (!response.ok) {
			throw new Error(
				"No se pudo leer hospitals.json"
			);
		}

		state.hospitals =
			await response.json();


		/* Crear selectores */

		setupHospitalPicker(
			originPicker,
			"origin"
		);

		setupHospitalPicker(
			destinationPicker,
			"destination"
		);


		/* Inicializar mapa */

		if (window.APP_CONFIG?.mapTilerKey) {

			try {

				await loadMapLibre();

				await mapView.enableRemoteMap(
					mapContainer,
					state.hospitals,
					window.APP_CONFIG.mapTilerKey,
					id => selectHospital(id)
				);

			} catch (error) {

				mapView.init(
					mapContainer,
					state.hospitals,
					id => selectHospital(id)
				);

				console.error(error);
			}

		} else {

			mapView.init(
				mapContainer,
				state.hospitals,
				id => selectHospital(id)
			);
		}

	} catch (error) {

		console.error(error);
	}
}


/* =========================
   CERRAR MENÚS AL HACER
   CLIC FUERA
========================= */

document.addEventListener("click", () => {
	closeAllPickers();
	closeModelPicker();
});


/* =========================
   CONTROLES DEL MAPA
========================= */

document
	.querySelector("#zoom-in")
	.addEventListener("click", () => {

		mapView.zoomIn();
	});


document
	.querySelector("#zoom-out")
	.addEventListener("click", () => {

		mapView.zoomOut();
	});


document
	.querySelector("#rotate-map")
	.addEventListener("click", () => {

		mapView.rotate(45);
	});


/* =========================
   CALCULAR RUTA
========================= */

routeForm.addEventListener(
	"submit",
	event => {

		event.preventDefault();

		routeStatus.textContent =
			"La red de rutas todavía no está disponible.";
	}
);

setupModelPicker();


/* =========================
   CAMBIO 2D / 3D
========================= */

let currentDisplayMode = "2d";


function updateModeControl() {

	modeLabel.textContent =
		currentDisplayMode === "3d"
			? "map"
			: "view_in_ar";

	modeToggle.setAttribute(
		"aria-label",
		currentDisplayMode === "3d"
			? "Cambiar a vista 2D"
			: "Cambiar a vista 3D"
	);
}


updateModeControl();


modeToggle.addEventListener(
	"click",
	() => {

		currentDisplayMode =
			currentDisplayMode === "3d"
				? "2d"
				: "3d";

		mapView.setRemoteMode(
			currentDisplayMode
		);

		updateModeControl();
	}
);


/* =========================
   INICIALIZACIÓN
========================= */

loadHospitals();