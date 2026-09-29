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
const routeResult = document.querySelector("#route-result");
const resultAlgorithm = document.querySelector("#result-algorithm");
const resultDistance = document.querySelector("#result-distance");
const viewTreeButton = document.querySelector("#view-tree");
const treeDialog = document.querySelector("#tree-dialog");
const closeTreeButton = document.querySelector("#close-tree");
const treeZoomInButton = document.querySelector("#tree-zoom-in");
const treeZoomOutButton = document.querySelector("#tree-zoom-out");
const treeFitButton = document.querySelector("#tree-fit");
const routeModelCard = document.querySelector(".route-model-card");
const mapToolbar = document.querySelector(".map-toolbar");

const originPicker = document.querySelector("#origin-select");
const destinationPicker = document.querySelector("#destination-select");
const modelPicker = document.querySelector("#model-select");
const noticeStack = document.querySelector("#notice-stack");
const NOTICE_DURATION = 2800;   // ms que permanece cada aviso
const NOTICE_MAX_VISIBLE = 3;   // máximo de avisos apilados
const NOTICE_EXIT_MS = 340;     // debe coincidir con la salida en CSS (.notice-item.is-leaving)
let activeNotices = [];         // el más nuevo primero

/* Indicador de carga centrado (reemplaza al aviso "cargando" de la pila) */
const loadingOverlay = document.querySelector("#loading-overlay");
const LOADING_MIN_MS = 450;     // tiempo mínimo visible para que no parpadee
const ROUTE_MIN_LOADING_MS = 1200; // el cálculo siempre tarda al menos esto, aunque el backend responda al instante
const LOADING_MAX_MS = 30000;   // seguro: se cierra solo si nadie lo cierra
let loadingShownAt = 0;
let loadingHideTimer;
let loadingFailsafe;
let lastRouteResult = window.location.hash === "#tree" ? window.treeResult : undefined;

function alignMapToolbar() {
	if (window.innerWidth <= 520) {
		mapToolbar.style.bottom = "12px";
		return;
	}
	const modelCardBottom = routeModelCard.getBoundingClientRect().bottom;
	mapToolbar.style.bottom = `${Math.max(20, window.innerHeight - modelCardBottom)}px`;
}

const routeModels = [
	{ id: "bfs", name: "Anchura", icon: "account_tree" },
	{ id: "uniform_cost", name: "Costo uniforme", icon: "paid" },
	{ id: "greedy", name: "Voraz", icon: "near_me" },
	{ id: "a_star", name: "A*", icon: "star" }
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

function setRouteStatus(message, stateClass = "") {
	routeStatus.textContent = message;
	showNotice(message, stateClass === "is-error" ? "error" : stateClass === "is-loading" ? "progress_activity" : "check", stateClass);
}

function showRouteResult(result) {
	lastRouteResult = result;
	const model = routeModels.find(item => item.id === result.algorithm);
	resultAlgorithm.textContent = model?.icon || "account_tree";
	resultAlgorithm.setAttribute("aria-label", `Algoritmo utilizado: ${result.algorithm_name}`);
	resultDistance.textContent = `${Number(result.distance).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
	routeResult.classList.remove("is-hidden");
	routeResult.setAttribute("aria-hidden", "false");
	routeResult.classList.remove("is-visible");
	requestAnimationFrame(() => routeResult.classList.add("is-visible"));
}

if (lastRouteResult) showRouteResult(lastRouteResult);

function hideRouteResult() {
	lastRouteResult = undefined;
	routeResult.classList.remove("is-visible");
	routeResult.classList.add("is-hidden");
	routeResult.setAttribute("aria-hidden", "true");
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
			showNotice(`Modelo: ${model.name}`, model.icon, "is-model");
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

const NOTICE_TEMPLATE = `
	<glass-element class="glass-control notice-item" disable-click-animation auto-size radius="999" blur="3" depth="8"
		strength="40" chromatic-aberration="3" background-color="rgba(255, 255, 255, 0.3)"
		style="--glass-padding: 8px 14px 8px 8px;">
		<div class="hospital-notice-content">
			<span class="material-symbols-rounded hospital-notice-icon" aria-hidden="true"></span>
			<span class="hospital-notice-text"></span>
		</div>
	</glass-element>`;

/* Posiciona cada aviso según su lugar en la pila (0 = el más nuevo, al frente). */
function layoutNotices() {
	activeNotices.forEach((notice, index) => {
		notice.el.style.setProperty("--i", index);
		notice.el.style.zIndex = String(100 - index);
	});
}

function dismissNotice(notice) {
	if (notice.leaving) return;
	notice.leaving = true;
	clearTimeout(notice.timer);
	activeNotices = activeNotices.filter(item => item !== notice);
	notice.el.classList.remove("is-visible");
	notice.el.classList.add("is-leaving");
	layoutNotices();
	setTimeout(() => notice.el.remove(), NOTICE_EXIT_MS + 60);
}

function showLoading() {
	clearTimeout(loadingHideTimer);
	clearTimeout(loadingFailsafe);
	loadingShownAt = performance.now();
	loadingOverlay.setAttribute("aria-hidden", "false");
	loadingOverlay.classList.add("is-visible");
	loadingFailsafe = setTimeout(hideLoading, LOADING_MAX_MS);
}

function hideLoading() {
	if (!loadingOverlay.classList.contains("is-visible")) return;
	clearTimeout(loadingHideTimer);
	clearTimeout(loadingFailsafe);
	const remaining = Math.max(0, LOADING_MIN_MS - (performance.now() - loadingShownAt));
	loadingHideTimer = setTimeout(() => {
		loadingOverlay.classList.remove("is-visible");
		loadingOverlay.setAttribute("aria-hidden", "true");
	}, remaining);
}

function showNotice(message, icon = "check", tone = "") {
	// "Cargando" se muestra como indicador centrado, no como aviso apilado.
	if (tone === "is-loading") {
		showLoading();
		return;
	}
	hideLoading();

	// Mismo mensaje repetido: solo reinicia el tiempo del que ya está al frente.
	const front = activeNotices[0];
	if (front && front.message === message && front.tone === tone) {
		clearTimeout(front.timer);
		front.timer = setTimeout(() => dismissNotice(front), NOTICE_DURATION);
		return;
	}

	const holder = document.createElement("div");
	holder.innerHTML = NOTICE_TEMPLATE.trim();
	const el = holder.firstElementChild;
	const iconEl = el.querySelector(".hospital-notice-icon");
	iconEl.textContent = icon;
	iconEl.className = `material-symbols-rounded hospital-notice-icon ${tone}`.trim();
	el.querySelector(".hospital-notice-text").textContent = message;

	const notice = { el, message, tone, leaving: false, timer: 0 };
	activeNotices.unshift(notice);
	activeNotices.slice(NOTICE_MAX_VISIBLE).forEach(dismissNotice);
	layoutNotices();

	noticeStack.appendChild(el);
	void el.offsetWidth; // fija el estado inicial (fuera de pantalla) antes de animar
	requestAnimationFrame(() => {
		if (!notice.leaving) el.classList.add("is-visible");
	});

	notice.timer = setTimeout(() => dismissNotice(notice), NOTICE_DURATION);
}

function showHospitalNotice(hospital, type) {
	const selectionLabel = type === "destination" ? "Destino" : "Origen";
	showNotice(`${selectionLabel}: ${hospital.name}`, "check", "is-hospital");
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

		// MapLibre empieza a descargarse ya, en paralelo con los JSON.
		const mapLibrePromise = window.APP_CONFIG?.mapTilerKey ? loadMapLibre() : null;
		mapLibrePromise?.catch(() => {});

		const [response, connectionsResponse] = await Promise.all([
			fetch("../data/hospitals.json"),
			fetch("../data/connections.json")
		]);

		if (!response.ok) {
			throw new Error(
				"No se pudo leer hospitals.json"
			);
		}

		state.hospitals =
			await response.json();
		if (!connectionsResponse.ok) throw new Error("No se pudo leer connections.json");
		const connections = await connectionsResponse.json();


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

				await mapLibrePromise;

				await mapView.enableRemoteMap(
					mapContainer,
					state.hospitals,
					connections,
					window.APP_CONFIG.mapTilerKey,
					id => selectHospital(id)
				);

			} catch (error) {

				mapView.init(
					mapContainer,
					state.hospitals,
					connections,
					id => selectHospital(id)
				);

				console.error(error);
			}

		} else {

			mapView.init(
				mapContainer,
				state.hospitals,
				connections,
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
	async event => {

		event.preventDefault();
		if (!state.origin || !state.destination || !state.model) return;
		if (state.origin === state.destination) {
			setRouteStatus("El origen y el destino deben ser diferentes.", "is-error");
			return;
		}
		calculateRoute.disabled = true;
		calculateRoute.classList.add("is-loading");
		setRouteStatus("Calculando ruta...", "is-loading");
		const minLoading = new Promise(resolve => setTimeout(resolve, ROUTE_MIN_LOADING_MS));
		hideRouteResult();
		mapView.setRoute([]);
		try {
			const response = await fetch("../api/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ origin: state.origin, destination: state.destination, algorithm: state.model })
			});
			const responseText = await response.text();
			let result;
			try {
				result = responseText ? JSON.parse(responseText) : null;
			} catch {
				throw new Error("El servidor activo no es la API de rutas. Ejecuta: python backend/server.py");
			}
			if (!response.ok) throw new Error(result?.error || "No fue posible calcular la ruta.");
			if (!result) throw new Error("El backend no devolvió una respuesta válida.");
			if (!result.found) throw new Error("No se encontró una ruta entre los hospitales seleccionados.");
			if (!Array.isArray(result.route_geometry) || result.route_geometry.length < 2) {
				throw new Error("No se obtuvo la geometría de las calles para esta ruta.");
			}
			await minLoading; // espera el tiempo mínimo antes de mostrar el resultado
			mapView.setRoute(result.path, result.route_geometry);
			showRouteResult(result);
			setRouteStatus("Ruta calculada correctamente.", "is-success");
		} catch (error) {
			await minLoading; // los errores rápidos también respetan el tiempo mínimo
			setRouteStatus(error.message || "No se pudo comunicar con el backend.", "is-error");
		} finally {
			calculateRoute.disabled = !state.origin || !state.destination || !state.model;
			calculateRoute.classList.remove("is-loading");
			hideLoading();
		}
	}
);

/* vis-network y tree.js solo se descargan la primera vez que se abre el árbol. */
let treeScriptsPromise;
function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.onload = resolve;
		script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
		document.head.appendChild(script);
	});
}
function ensureTreeScripts() {
	if (window.renderTree) return Promise.resolve();
	treeScriptsPromise ??= (async () => {
		// tree.js pinta window.treeResult (datos de ejemplo) al cargarse; se evita esa pintura inicial.
		const sample = window.treeResult;
		window.treeResult = undefined;
		try {
			if (!window.vis) await loadScript("js/vendor/vis-network.min.js");
			await loadScript("js/tree.js");
		} finally {
			window.treeResult = sample;
		}
	})().catch(error => { treeScriptsPromise = undefined; throw error; });
	return treeScriptsPromise;
}

viewTreeButton.addEventListener("click", async () => {
	if (!lastRouteResult) return;
	openTreeDialog();
	try {
		await ensureTreeScripts();
	} catch (error) {
		console.error(error);
		return;
	}
	requestAnimationFrame(() => renderTree(lastRouteResult));
});

treeZoomInButton.addEventListener("click", () => window.zoomTree?.(1.2));
treeZoomOutButton.addEventListener("click", () => window.zoomTree?.(0.8));
treeFitButton.addEventListener("click", () => window.fitTree?.());
/* Apertura/cierre animados: el <dialog> sigue [open] hasta que termina la transición de salida. */
let treeClosing = false;
function openTreeDialog() {
	if (treeDialog.open && !treeClosing) return;
	treeClosing = false;
	if (!treeDialog.open) treeDialog.showModal();
	void treeDialog.offsetWidth; // fija el estado oculto antes de animar la entrada
	treeDialog.classList.add("is-visible");
}
function closeTreeDialog() {
	if (!treeDialog.open || treeClosing) return;
	treeClosing = true;
	treeDialog.classList.remove("is-visible");
	let done = false;
	const finish = () => {
		if (done) return;
		done = true;
		treeDialog.removeEventListener("transitionend", onEnd);
		if (treeClosing) treeDialog.close();
		treeClosing = false;
	};
	const onEnd = event => { if (event.target === treeDialog && event.propertyName === "transform") finish(); };
	treeDialog.addEventListener("transitionend", onEnd);
	setTimeout(finish, 600);
}
closeTreeButton.addEventListener("click", closeTreeDialog);
treeDialog.addEventListener("click", event => {
	if (event.target === treeDialog) closeTreeDialog();
});
treeDialog.addEventListener("cancel", event => { // tecla Esc
	event.preventDefault();
	closeTreeDialog();
});

setupModelPicker();
window.addEventListener("resize", alignMapToolbar);
requestAnimationFrame(alignMapToolbar);


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