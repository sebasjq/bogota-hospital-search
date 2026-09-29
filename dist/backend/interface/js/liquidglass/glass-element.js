/**
 * Web Component GlassElement
 * Efecto de cristal líquido usando filtros SVG
 * 
 * Funciona mejor en navegadores basados en Chromium.
 * Incluye fallback automático con blur simple para otros navegadores.
 *
 * Optimización de rendimiento (mismo aspecto, menos trabajo):
 *  - Un solo render por elemento: los atributos que llegan juntos al crearlo se agrupan
 *    (antes cada atributo observado reconstruía el shadow DOM y regeneraba el filtro).
 *  - El shadow DOM solo se reconstruye si cambia algo estructural; el resto son cambios de estilo.
 *  - Los estilos solo se escriben cuando cambian, y ya no se quita/pone el filtro para medir.
 *  - Sin bucle de requestAnimationFrame para elementos ocultos (tamaño 0): ResizeObserver avisa
 *    cuando vuelven a tener tamaño.
 *  - Los cambios de tamaño (p. ej. tarjetas que se expanden animadas) regeneran el filtro como
 *    máximo cada RESIZE_INTERVAL ms, con una última actualización exacta al terminar.
 *  - Mientras el mapa se mueve (clase .is-map-moving en <html>) el fondo cambia en cada frame;
 *    en ese lapso se usa una sola pasada de desplazamiento en lugar de tres (sin franja RGB) y se
 *    restaura el efecto completo poco después de que el mapa se detiene.
 *  - Se limpian observers y listeners al quitar el elemento del DOM.
 */

class GlassElement extends HTMLElement {
    static RESIZE_INTERVAL = 100;   // ms mínimos entre regeneraciones del filtro al cambiar de tamaño
    static LITE_ENTER_DELAY = 80;   // el mapa debe moverse este tiempo antes de bajar la calidad
    static LITE_EXIT_DELAY = 220;   // espera tras detenerse el mapa antes de restaurar el efecto completo
    static _instances = new Set();
    static _lite = false;
    static _qualityReady = false;

    constructor() {
        super();
        this.clicked = false;
        this.attachShadow({ mode: 'open' });

        this._glassBox = null;
        this._templateKey = null;
        this._renderQueued = false;
        this._frame = 0;
        this._resizeTimer = 0;
        this._lastApply = 0;
        this._applied = {};
        this._resizeObserver = null;
        this._release = () => {
            if (!this.clicked) return;
            this.clicked = false;
            this.updateStyles();
        };
        
        // Detectar soporte de filtros SVG en backdrop-filter (solo una vez por clase)
        if (GlassElement._svgFilterSupport === undefined) {
            GlassElement._svgFilterSupport = this.detectSVGFilterSupport();
            console.log(`[GlassElement] SVG Filter Support: ${GlassElement._svgFilterSupport ? '✅ YES' : '❌ NO'} (${navigator.userAgent.match(/(chrome|firefox|safari|edg)/i)?.[0] || 'unknown'})`);
        }
    }

    /**
     * Detecta si el navegador soporta filtros SVG en backdrop-filter
     */
    detectSVGFilterSupport() {
        // Primero verificar si backdrop-filter está soportado
        const testElement = document.createElement('div');
        testElement.style.backdropFilter = 'blur(1px)';
        
        if (!testElement.style.backdropFilter) {
            return false;
        }

        // Detectar navegador específicamente
        const userAgent = navigator.userAgent.toLowerCase();
        const isChrome = /chrome|chromium|crios|edg/.test(userAgent) && !/firefox|fxios/.test(userAgent);
        const isFirefox = /firefox|fxios/.test(userAgent);
        const isSafari = /safari/.test(userAgent) && !/chrome|chromium|crios|edg/.test(userAgent);
        
        // Solo Chromium-based soportan filtros SVG en backdrop-filter
        // Firefox y Safari NO los soportan (al menos hasta 2025)
        if (isChrome) {
            return true;
        }
        
        if (isFirefox || isSafari) {
            return false;
        }
        
        // Para otros navegadores, intentar detección
        try {
            testElement.style.backdropFilter = 'url(#test)';
            return testElement.style.backdropFilter.includes('url');
        } catch (e) {
            return false;
        }
    }

    /**
     * Getter para saber si el navegador soporta filtros SVG
     */
    get hasSVGFilterSupport() {
        return GlassElement._svgFilterSupport;
    }

    static get observedAttributes() {
        return [
            'width', 
            'height', 
            'radius', 
            'depth', 
            'blur', 
            'strength', 
            'chromatic-aberration', 
            'debug',
            'background-color',
            'responsive',
            'base-width',
            'base-height',
            'auto-size',
            'performance-mode',
            'min-width',
            'min-height'
        ];
    }

    /* ---------- Calidad adaptativa mientras el mapa se mueve ---------- */

    static _initQuality() {
        if (GlassElement._qualityReady) return;
        GlassElement._qualityReady = true;

        const root = document.documentElement;
        let timer = 0;

        const evaluate = () => {
            const moving = root.classList.contains('is-map-moving');
            clearTimeout(timer);
            timer = 0;
            if (moving === GlassElement._lite) return;
            timer = setTimeout(() => {
                timer = 0;
                GlassElement._lite = moving;
                GlassElement._instances.forEach(glass => glass.updateStyles());
            }, moving ? GlassElement.LITE_ENTER_DELAY : GlassElement.LITE_EXIT_DELAY);
        };

        new MutationObserver(evaluate).observe(root, { attributes: true, attributeFilter: ['class'] });
        evaluate();
    }

    /* ---------- Ciclo de vida ---------- */

    connectedCallback() {
        GlassElement._instances.add(this);
        GlassElement._initQuality();
        this._queueRender();
        this.setupResponsive();
    }

    disconnectedCallback() {
        GlassElement._instances.delete(this);
        cancelAnimationFrame(this._frame);
        clearTimeout(this._resizeTimer);
        this._frame = 0;
        this._resizeTimer = 0;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        document.removeEventListener('mouseup', this._release);
        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }
        // Al reconectarse se reconstruye y se vuelve a observar
        this._templateKey = null;
    }

    /* Agrupa todos los cambios de atributos de un mismo momento en un único render */
    _queueRender() {
        if (this._renderQueued) return;
        this._renderQueued = true;
        queueMicrotask(() => {
            this._renderQueued = false;
            if (this.isConnected) this.render();
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        this._queueRender();
    }

    setupResponsive() {
        // Configurar responsive si está habilitado
        if (this.hasAttribute('responsive') && !this._onWindowResize) {
            this.updateResponsiveSize();
            this._onWindowResize = () => this.updateResponsiveSize();
            window.addEventListener('resize', this._onWindowResize);
        }
    }

    updateResponsiveSize() {
        const baseWidth = parseInt(this.getAttribute('base-width') || this.getAttribute('width')) || 200;
        const baseHeight = parseInt(this.getAttribute('base-height') || this.getAttribute('height')) || 200;
        
        const viewport = window.innerWidth;
        let scale = 1;
        
        if (viewport < 480) {
            scale = 0.6; // Móvil pequeño
        } else if (viewport < 768) {
            scale = 0.8; // Móvil/Tablet
        } else if (viewport < 1024) {
            scale = 0.9; // Tablet
        }
        
        const newWidth = Math.round(baseWidth * scale);
        const newHeight = Math.round(baseHeight * scale);
        
        // Solo actualizar si cambió el tamaño
        if (newWidth !== this.width || newHeight !== this.height) {
            this.setAttribute('width', newWidth);
            this.setAttribute('height', newHeight);
        }
    }

    // Getters para los atributos con valores por defecto
    get width() {
        return parseInt(this.getAttribute('width')) || 200;
    }

    get height() {
        return parseInt(this.getAttribute('height')) || 200;
    }

    get radius() {
        return parseInt(this.getAttribute('radius')) || 50;
    }

    get baseDepth() {
        return parseInt(this.getAttribute('depth')) || 10;
    }

    get blur() {
        const value = parseInt(this.getAttribute('blur'));
        return Number.isNaN(value) ? 2 : value;
    }

    get strength() {
        return parseInt(this.getAttribute('strength')) || 100;
    }

    get chromaticAberration() {
        return parseInt(this.getAttribute('chromatic-aberration')) || 0;
    }

    get debug() {
        return this.getAttribute('debug') === 'true';
    }

    get backgroundColor() {
        return this.getAttribute('background-color') || 'rgba(255, 255, 255, 0.4)';
    }

    get autoSize() {
        return this.hasAttribute('auto-size');
    }

    get performanceMode() {
        return this.getAttribute('performance-mode') === 'optimized';
    }

    get minWidth() {
        return parseInt(this.getAttribute('min-width')) || 0;
    }

    get minHeight() {
        return parseInt(this.getAttribute('min-height')) || 0;
    }

    // Calcular la profundidad dinámica basada en el estado de click
    get depth() {
        return this.baseDepth / (this.clicked ? 0.7 : 1);
    }

    /* ---------- Eventos ---------- */

    setupEventListeners() {
        const glassBox = this._glassBox;

        if (!glassBox || this.hasAttribute('disable-click-animation')) {
            return;
        }
        
        glassBox.addEventListener('mousedown', () => {
            this.clicked = true;
            this.updateStyles();
            // Evita perder el mouseup si se suelta fuera; el listener se retira solo
            document.addEventListener('mouseup', this._release, { once: true });
        });

        glassBox.addEventListener('mouseup', this._release);
        glassBox.addEventListener('mouseleave', this._release);
    }

    setupAutoSizeObserver() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (!window.ResizeObserver || !this._glassBox) return;

        // El filtro solo depende del tamaño: no hace falta observar cambios de contenido
        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(this._glassBox);
    }

    _onResize() {
        const wait = GlassElement.RESIZE_INTERVAL - (performance.now() - this._lastApply);
        if (wait <= 0) {
            this.scheduleStyleUpdate();
            return;
        }
        if (this._resizeTimer) return;
        this._resizeTimer = setTimeout(() => {
            this._resizeTimer = 0;
            this.scheduleStyleUpdate();
        }, wait);
    }

    /* ---------- Estilos ---------- */

    updateStyles() {
        if (this._glassBox) {
            this.applyDynamicStyles(this._glassBox);
        }
    }

    scheduleStyleUpdate() {
        if (this._frame) return;
        this._frame = requestAnimationFrame(() => {
            this._frame = 0;
            this.updateStyles();
        });
    }

    /* Escribe solo las propiedades que realmente cambiaron (evita invalidar el backdrop-filter) */
    _assign(element, styles) {
        for (const prop in styles) {
            if (this._applied[prop] === styles[prop]) continue;
            element.style[prop] = styles[prop];
            this._applied[prop] = styles[prop];
        }
    }

    applyDynamicStyles(element) {
        const { getDisplacementFilter, getDisplacementMap } = window.DisplacementUtils;
        const styles = { borderRadius: `${this.radius}px` };
        let width;
        let height;

        if (this.autoSize) {
            // Tamaño de layout (no se altera por transform, p. ej. la animación de los avisos).
            // Si es 0 (elemento oculto) no se reintenta: ResizeObserver avisará cuando tenga tamaño.
            width = element.offsetWidth;
            height = element.offsetHeight;
            if (!width || !height) return;

            // Aplicar tamaños mínimos si están especificados
            width = Math.max(width, this.minWidth);
            height = Math.max(height, this.minHeight);

            // Asegurar tamaños mínimos razonables para el filtro SVG
            width = Math.max(width, 50);
            height = Math.max(height, 30);
        } else {
            // Fixed size: usar dimensiones específicas
            width = this.width;
            height = this.height;
            styles.height = `${height}px`;
            styles.width = `${width}px`;
        }

        this._lastApply = performance.now();

        const insetShadow = '1px 1px 1px 0px rgba(255,255,255, 0.60) inset, -1px -1px 1px 0px rgba(255,255,255, 0.60) inset, 0px 0px 16px 0px rgba(0,0,0, 0.04)';

        if (this.debug) {
            styles.background = `url("${getDisplacementMap({ height, width, radius: this.radius, depth: this.depth })}")`;
            styles.boxShadow = 'none';
            styles.backdropFilter = 'none';
        } else if (this.performanceMode || !this.hasSVGFilterSupport) {
            // Fallback para navegadores sin soporte
            styles.backdropFilter = `blur(${this.performanceMode ? this.blur : this.blur * 2}px) saturate(130%)`;
            styles.background = this.backgroundColor;
            styles.boxShadow = insetShadow;
            styles.border = '1px solid rgba(255, 255, 255, 0.3)';
        } else {
            // Efecto completo con SVG filters (una sola pasada mientras el mapa se mueve)
            const filterUrl = getDisplacementFilter({
                height,
                width,
                radius: this.radius,
                depth: this.depth,
                strength: this.strength,
                chromaticAberration: this.chromaticAberration,
                lite: GlassElement._lite
            });
            styles.backdropFilter = `blur(${this.blur / 2}px) url('${filterUrl}') blur(${this.blur}px) brightness(1.1) saturate(1.5)`;
            styles.background = this.backgroundColor;
            styles.boxShadow = insetShadow;
        }

        this._assign(element, styles);
    }

    /* ---------- Render ---------- */

    _buildShadow() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: ${this.autoSize ? 'inline-block' : 'block'};
                }

                :host(.route-card) {
                    display: block;
                    width: 100%;
                }
                
                .glass-box {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.46);
                    box-shadow: 1px 1px 1px 0px rgba(255,255,255, 0.72) inset, -1px -1px 1px 0px rgba(255,255,255, 0.34) inset, 0px 10px 22px 0px rgba(20, 44, 52, 0.18);
                    cursor: ${this.hasAttribute('disable-click-animation') ? 'default' : 'pointer'};
                    ${this.hasAttribute('disable-click-animation') ? '' : 'transition: transform 0.16s ease, box-shadow 0.16s ease;'}
                    position: relative;
                    isolation: isolate;
                    box-sizing: border-box;
                    ${this.autoSize ? `display: inline-block; width: fit-content; min-width: ${this.minWidth}px; min-height: ${this.minHeight}px;` : ''}
                }
                
                ${this.hasAttribute('disable-click-animation') ? '' : `.glass-box:active {
                    transform: scale(0.96);
                    box-shadow: 1px 1px 1px 0px rgba(255,255,255, 0.54) inset, -1px -1px 1px 0px rgba(255,255,255, 0.24) inset, 0px 4px 14px 0px rgba(20, 44, 52, 0.14);
                }`}

                .content {
                    ${this.autoSize ? '' : 'width: 100%; height: 100%;'}
                    display: flex;
                    align-items: center;
                    justify-content: center;
					box-sizing: border-box;
                    color: white;
                    text-align: center;
                    font-family: sans-serif;
                    ${this.autoSize ? 'padding: var(--glass-padding, 16px 24px);' : ''}
                }

				:host(.route-card) .glass-box,
				:host(.route-card) .content {
					width: 100%;
				}

                :host(.route-card) .content {
                    display: block;
                    text-align: center;
                }
            </style>
            <div class="glass-box">
                <div class="content">
                    <slot></slot>
                </div>
            </div>
        `;

        this._glassBox = this.shadowRoot.querySelector('.glass-box');
        this._applied = {};
        this.setupEventListeners();
        if (this.autoSize) {
            this.setupAutoSizeObserver();
        } else if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    render() {
        // Solo se reconstruye el shadow DOM si cambió algo que forma parte de su estructura/CSS
        const templateKey = [
            this.autoSize,
            this.hasAttribute('disable-click-animation'),
            this.minWidth,
            this.minHeight
        ].join('|');

        if (templateKey !== this._templateKey) {
            this._buildShadow();
            this._templateKey = templateKey;
        }

        // Un único frame: el layout ya está resuelto y ResizeObserver corrige cambios posteriores
        this.scheduleStyleUpdate();
    }
}

// Registrar el Web Component
customElements.define('glass-element', GlassElement);