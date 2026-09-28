function renderTree(result) {
    const id = path => JSON.stringify(path);

    const routeNodes = new Set(
        result.path.map((_, index) =>
            id(result.path.slice(0, index + 1)))
    );

    function makeNode(path, g) {

        const onRoute = routeNodes.has(id(path));

        return {
            id: id(path),
            label: `${path.at(-1)}\ng=${g.toFixed(3)}`,
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

    const root = [result.origin];
    const nodes = new Map([[id(root), makeNode(root, 0)]]);
    const edges = [];

    for (const edge of result.tree_edges) {
        nodes.set(id(edge.child), makeNode(edge.child, edge.g));

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
            nodes: { shape: "circle" },
            layout: {
                hierarchical: { direction: "UD", sortMethod: "directed" }
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