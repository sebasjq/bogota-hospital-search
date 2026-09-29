let treeNetwork;

function renderTree(result) {
    if (treeNetwork) treeNetwork.destroy();
    const id = path => JSON.stringify(path);

    const expansionOrder = new Map(
    Object.values(result.expanded ?? {})
        .filter(item => item && Array.isArray(item.path))
        .map(item => [id(item.path), item.order])
    );

    const routeNodes = new Set(
        result.path.map((_, index) =>
            id(result.path.slice(0, index + 1)))
    );

    // Paleta del árbol (lenguaje Apple / Liquid Glass)
    const STYLE = {
        text: "rgba(27, 43, 58, 0.82)",
        textSecondary: "rgba(60, 72, 88, 0.55)",
        blue: "#007aff",
        node: {
            background: "rgba(255, 255, 255, 0.82)",
            border: "rgba(120, 144, 166, 0.55)",
            hoverBackground: "rgba(255, 255, 255, 0.96)",
            hoverBorder: "#4d91cf",
            shadow: "rgba(35, 57, 62, 0.12)"
        },
        route: {
            background: "rgba(226, 240, 255, 0.92)",
            border: "#007aff",
            hoverBackground: "#d3e8ff",
            hoverBorder: "#006ee6",
            shadow: "rgba(0, 122, 255, 0.22)"
        },
        edge: "rgba(84, 110, 133, 0.38)",
        edgeRoute: "rgba(0, 122, 255, 0.85)"
    };

    function makeNode(path, g, h = null, f = null) {

        const onRoute = routeNodes.has(id(path));
        const order = expansionOrder.get(id(path));
        const palette = onRoute ? STYLE.route : STYLE.node;

        // Tarjeta compacta: nombre, orden de expansión y métricas en pocas líneas.
        const metrics = [`g=${g.toFixed(3)}`];
        if (h != null) metrics.push(`h=${h.toFixed(3)}`);

        const labelLines = [
            `<b>${path.at(-1)}</b>`,
            ...(order !== undefined ? [`<i>Expansión ${order}</i>`] : []),
            metrics.join("  ·  ")
        ];

        if (f != null) labelLines.push(`f=${f.toFixed(3)}`);

        return {
            id: id(path),
            label: labelLines.join("\n"),

            title: path.join(" → "),
            level: path.length - 1,

            color: {
                background: palette.background,
                border: palette.border,
                highlight: { background: palette.hoverBackground, border: palette.hoverBorder },
                hover: { background: palette.hoverBackground, border: palette.hoverBorder }
            },
            borderWidth: onRoute ? 2 : 1,
            borderWidthSelected: 2.5,
            shadow: {
                enabled: true,
                color: palette.shadow,
                size: onRoute ? 16 : 12,
                x: 0,
                y: 4
            }
        };
    }

    const hasF = result.tree_edges.some(edge => edge.f != null);
    const rootF = hasF ? result.heuristic : null;

    const root = [result.origin];
    const nodes = new Map([[id(root), makeNode(root, 0, result.heuristic, rootF)]]);
    const edges = [];

    for (const edge of result.tree_edges) {

        nodes.set(id(edge.child), makeNode(edge.child, edge.g, edge.h, edge.f));

        const onRoute = routeNodes.has(id(edge.child));

        edges.push({
            id: `edge-${edges.length}`,
            from: id(edge.parent),
            to: id(edge.child),
            color: onRoute ? STYLE.edgeRoute : STYLE.edge,
            width: onRoute ? 2.5 : 1.5,
            smooth: { type: "cubicBezier", forceDirection: "vertical", roundness: 0.5 }
        });
    }   

    const edgeData = new vis.DataSet(edges);
    const originalStyles = edges.map(({ id, color, width }) => ({
        id, color, width
    }));

    treeNetwork = new vis.Network(
        document.getElementById("tree"),
        { nodes: [...nodes.values()], edges: edgeData },
        {
            nodes: {
                shape: "box",
                shapeProperties: { borderRadius: 18 },
                margin: { top: 12, right: 14, bottom: 12, left: 14 },
                widthConstraint: { minimum: 132, maximum: 132 },
                heightConstraint: { minimum: 84, valign: "middle" },
                font: {
                    size: 12,
                    face: "DM Sans",
                    color: STYLE.text,
                    multi: "html",
                    bold: { size: 16, color: STYLE.blue, face: "DM Sans", mod: "bold" },
                    ital: { size: 11, color: STYLE.textSecondary, face: "DM Sans", mod: "" }
                }
            },

            layout: {
                hierarchical: {
                    direction: "UD",
                    sortMethod: "directed",
                    levelSeparation: 150,
                    nodeSpacing: 170
                }
            },

            interaction: { selectConnectedEdges: false, hover: true, zoomView: true },
            physics: false
        }
    );

    window.treeNetwork = treeNetwork;

    treeNetwork.on("click", ({ nodes: selected }) => {
        edgeData.update(originalStyles);

        if (selected.length === 0) return;

        const nodeId = selected[0];

        edgeData.update(
                    treeNetwork.getConnectedEdges(nodeId).map(edgeId => {
                const edge = edgeData.get(edgeId);
                const onRoute =
                    routeNodes.has(edge.from) && routeNodes.has(edge.to);

                return {
                    id: edgeId,
                    color: onRoute ? STYLE.blue : "#4d91cf",
                    width: 3
                };
            })
        );
    });
}

window.zoomTree = factor => {
    if (!treeNetwork) return;
    const scale = Math.min(2.5, Math.max(0.25, treeNetwork.getScale() * factor));
    treeNetwork.moveTo({ scale, animation: { duration: 240, easingFunction: "easeInOutQuad" } });
};

window.fitTree = () => {
    if (!treeNetwork) return;
    treeNetwork.fit({ animation: { duration: 320, easingFunction: "easeInOutQuad" } });
};

// Permite pasarle un resultado después, desde la app.
window.renderTree = renderTree;

if (window.treeResult) {
    renderTree(window.treeResult);
    } else {
    document.getElementById("tree").textContent =
        "No hay datos del árbol. Ejecuta bfs.py primero.";
}