document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Session Info
    fetch('/api/session')
        .then(res => res.json())
        .then(data => {
            if(data.username) document.getElementById('username').value = data.username;
            if(data.model) document.getElementById('activeModel').value = data.model;
            if(data.memoryLimit) document.getElementById('memoryLimit').value = data.memoryLimit;
        }).catch(err => console.log("No existing session data yet."));

    // 2. Handle Session Form
    document.getElementById('session-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
            username: document.getElementById('username').value,
            model: document.getElementById('activeModel').value,
            memoryLimit: parseInt(document.getElementById('memoryLimit').value)
        };
        
        fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => res.json()).then(data => {
            const toast = document.getElementById('toast');
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 2500);
        });
    });

    // 3. Graph Visualization
    const container = document.getElementById('mynetwork');
    let network = null;

    function loadGraph() {
        fetch('/api/graph')
            .then(res => res.json())
            .then(data => {
                document.getElementById('nodeCount').innerText = data.nodes.length;
                document.getElementById('edgeCount').innerText = data.edges.length;

                const nodes = new vis.DataSet(data.nodes);
                const edges = new vis.DataSet(data.edges);

                const options = {
                    nodes: {
                        shape: 'dot',
                        size: 24,
                        font: { color: '#c5c6c7', face: 'Outfit', size: 14 },
                        borderWidth: 2,
                        shadow: true
                    },
                    edges: {
                        width: 2,
                        color: { color: 'rgba(102, 252, 241, 0.3)', highlight: '#66fcf1' },
                        arrows: 'to',
                        smooth: { type: 'continuous' }
                    },
                    physics: {
                        barnesHut: { gravitationalConstant: -4000, centralGravity: 0.3, springLength: 200 },
                        stabilization: { iterations: 150 }
                    },
                    interaction: { hover: true, tooltipDelay: 200 }
                };

                if (network) {
                    network.destroy();
                }
                network = new vis.Network(container, { nodes, edges }, options);

                // Node Click Event
                network.on("click", function (params) {
                    if (params.nodes.length > 0) {
                        const nodeId = params.nodes[0];
                        const node = nodes.get(nodeId);
                        showNodeDetails(node);
                    } else {
                        hideNodeDetails();
                    }
                });
            })
            .catch(err => {
                console.error("Error loading graph:", err);
            });
    }

    function showNodeDetails(node) {
        const panel = document.getElementById('node-details');
        document.getElementById('detail-title').innerText = node.label || 'Node Details';
        
        let content = '';
        if(node.props) {
            Object.entries(node.props).forEach(([key, val]) => {
                if(typeof val === 'object') val = JSON.stringify(val);
                content += `${key.toUpperCase()}:\n${val}\n\n`;
            });
        } else {
            content = "No properties available.";
        }
        
        document.getElementById('detail-content').innerText = content;
        panel.classList.remove('hidden');
    }

    function hideNodeDetails() {
        document.getElementById('node-details').classList.add('hidden');
    }

    document.getElementById('close-details').addEventListener('click', hideNodeDetails);
    document.getElementById('refresh-btn').addEventListener('click', loadGraph);

    // Initial Load
    loadGraph();
});
