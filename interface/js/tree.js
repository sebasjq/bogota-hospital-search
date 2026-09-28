function renderTree(result) {
    const id = path => JSON.stringify(path);

    const routeNodes = new Set(
        result.path.map((_, index) =>
            id(result.path.slice(0, index + 1)))
    );

    function makeNode(path, g, h = null, f = null) {

        const onRoute = routeNodes.has(id(path));
        
        const labelLines = [`<b>${path.at(-1)}</b>`, `g=${g.toFixed(3)}`];
        if (h != null) labelLines.push(`h=${h.toFixed(3)}`);
        if (f != null) labelLines.push(`f=${f.toFixed(3)}`);

        return {
            id: id(path),
            label: labelLines.join("\n"),

            title: path.join(" → "),
            level: path.length - 1,

            color: onRoute
                ? {
                    background: "#d8f3df",
                    border: "#198754",
                    highlight: { background: "#d8f3df", border: "#198754" }
                }
                : {
                    background: "#e7f0ff",
                    border: "#528ac7",
                    highlight: { background: "#e7f0ff", border: "#528ac7" }
                },
            borderWidth: onRoute ? 3 : 1,
            borderWidthSelected: 3
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
            color: onRoute ? "#198754" : "#9ca3af",
            width: onRoute ? 3 : 1
        });
    }   

    const edgeData = new vis.DataSet(edges);
    const originalStyles = edges.map(({ id, color, width }) => ({
        id, color, width
    }));

    const network = new vis.Network(
        document.getElementById("tree"),
        { nodes: [...nodes.values()], edges: edgeData },
        {
            nodes: {
                shape: "circle",
                margin: 14,
                font: {
                    size: 14,
                    multi: "html",
                    bold: { size: 22 }
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

            interaction: { selectConnectedEdges: false },
            physics: false
        }
    );

    network.on("click", ({ nodes: selected }) => {
        edgeData.update(originalStyles);

        if (selected.length === 0) return;

        const nodeId = selected[0];

        edgeData.update(
            network.getConnectedEdges(nodeId).map(edgeId => {
                const edge = edgeData.get(edgeId);
                const onRoute =
                    routeNodes.has(edge.from) && routeNodes.has(edge.to);

                return {
                    id: edgeId,
                    color: onRoute ? "#198754" : "#528ac7",
                    width: 4
                };
            })
        );
    });
}

// Permite pasarle un resultado después, desde la app.
window.renderTree = renderTree;

if (window.treeResult) {
    renderTree(window.treeResult);
    } else {
    document.getElementById("tree").textContent =
        "No hay datos del árbol. Ejecuta bfs.py primero.";
}