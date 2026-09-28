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

    function makeNode(path, g, h = null, f = null) {

        const onRoute = routeNodes.has(id(path));
        const order = expansionOrder.get(id(path));
        
        const labelLines = [
            `<b>${path.at(-1)}</b>`,
            ...(order !== undefined ? [`Expansión ${order}`] : []),
            `g=${g.toFixed(3)}`
        ];
        
        if (h != null) labelLines.push(`h=${h.toFixed(3)}`);
        if (f != null) labelLines.push(`f=${f.toFixed(3)}`);

        return {
            id: id(path),
            label: labelLines.join("\n"),

            title: path.join(" → "),
            level: path.length - 1,

            color: onRoute
                ? {
                    background: "rgba(232, 244, 255, 0.96)",
                    border: "#007aff",
                    highlight: { background: "#dceeff", border: "#006ee6" }
                }
                : {
                    background: "rgba(248, 252, 255, 0.9)",
                    border: "#8eacc4",
                    highlight: { background: "#edf6ff", border: "#4d91cf" }
                },
            borderWidth: onRoute ? 2 : 1,
            borderWidthSelected: 2,
            shadow: {
                enabled: true,
                color: "rgba(35, 57, 62, 0.12)",
                size: 7,
                x: 0,
                y: 2
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
            color: onRoute ? "#4d91cf" : "#a6bbca",
            width: onRoute ? 2 : 1.25,
            smooth: { type: "cubicBezier", forceDirection: "vertical", roundness: 0.35 }
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
                shape: "circle",
                margin: 14,
                font: {
                    size: 13,
                    face: "DM Sans",
                    color: "rgba(27, 43, 58, 0.82)",
                    multi: "html",
                    bold: { size: 15, color: "#007aff" }
                }
            },

            layout: {
                hierarchical: {
                    direction: "UD",
                    sortMethod: "directed",
                    levelSeparation: 180,
                    nodeSpacing: 200
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
                    color: onRoute ? "#007aff" : "#4d91cf",
                    width: 2.5
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