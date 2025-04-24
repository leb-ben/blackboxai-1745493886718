// Tree visualization configuration
const TREE_CONFIG = {
    width: 800,
    height: 600,
    nodeRadius: 5,
    nodeSpacing: 180,
    duration: 750,
    nodeColors: {
        page: "#3b82f6",      // blue-500
        admin: "#dc2626",     // red-600
        login: "#2563eb",     // blue-600
        api: "#059669",       // emerald-600
        payment: "#7c3aed",   // violet-600
        wallet: "#c026d3"     // fuchsia-600
    }
};

let treeData = null;
let svg = null;
let root = null;
let treemap = null;
let nodeId = 0;  // Add counter for unique node IDs

function initializeTreeVisualization(data) {
    // Reset node ID counter
    nodeId = 0;
    
    // Clear previous visualization
    const container = document.getElementById('treeVisualization');
    container.innerHTML = '';

    // Create new SVG container
    svg = d3.select('#treeVisualization')
        .append('svg')
        .attr('width', TREE_CONFIG.width)
        .attr('height', TREE_CONFIG.height)
        .append('g')
        .attr('transform', `translate(40,${TREE_CONFIG.height / 2})`);

    // Initialize tree layout
    treemap = d3.tree()
        .size([TREE_CONFIG.height - 100, TREE_CONFIG.width - 160]);

    // Create root node
    root = d3.hierarchy(data, d => d.children);
    root.x0 = TREE_CONFIG.height / 2;
    root.y0 = 0;

    // Initialize the display
    update(root);
}

function update(source) {
    // Compute the new tree layout
    const treeData = treemap(root);
    const nodes = treeData.descendants();
    const links = treeData.descendants().slice(1);

    // Normalize for fixed-depth
    nodes.forEach(d => {
        d.y = d.depth * TREE_CONFIG.nodeSpacing;
    });

    // Update the nodes
    const node = svg.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = ++nodeId));  // Use nodeId counter

    // Enter any new nodes at the parent's previous position
    const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .on('click', click);

    // Add Circle for the nodes
    nodeEnter.append('circle')
        .attr('class', 'node')
        .attr('r', 1e-6)
        .style('fill', d => getNodeColor(d.data))
        .style('stroke', d => d3.rgb(getNodeColor(d.data)).darker());

    // Add labels for the nodes
    nodeEnter.append('text')
        .attr('dy', '.35em')
        .attr('x', d => d.children || d._children ? -13 : 13)
        .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
        .text(d => formatNodeLabel(d.data))
        .style('fill-opacity', 1e-6);

    // Update the node attributes and style
    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.transition()
        .duration(TREE_CONFIG.duration)
        .attr('transform', d => `translate(${d.y},${d.x})`);

    nodeUpdate.select('circle.node')
        .attr('r', TREE_CONFIG.nodeRadius)
        .style('fill', d => getNodeColor(d.data))
        .style('stroke', d => d3.rgb(getNodeColor(d.data)).darker())
        .attr('cursor', 'pointer');

    nodeUpdate.select('text')
        .style('fill-opacity', 1);

    // Remove any exiting nodes
    const nodeExit = node.exit().transition()
        .duration(TREE_CONFIG.duration)
        .attr('transform', d => `translate(${source.y},${source.x})`)
        .remove();

    nodeExit.select('circle')
        .attr('r', 1e-6);

    nodeExit.select('text')
        .style('fill-opacity', 1e-6);

    // Update the links
    const link = svg.selectAll('path.link')
        .data(links, d => d.id);

    // Enter any new links at the parent's previous position
    const linkEnter = link.enter().insert('path', 'g')
        .attr('class', 'link')
        .attr('d', d => {
            const o = {x: source.x0, y: source.y0};
            return diagonal(o, o);
        });

    // Update the links
    const linkUpdate = linkEnter.merge(link);

    linkUpdate.transition()
        .duration(TREE_CONFIG.duration)
        .attr('d', d => diagonal(d, d.parent));

    // Remove any exiting links
    link.exit().transition()
        .duration(TREE_CONFIG.duration)
        .attr('d', d => {
            const o = {x: source.x, y: source.y};
            return diagonal(o, o);
        })
        .remove();

    // Store the old positions for transition
    nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

// Creates a curved (diagonal) path from parent to the child nodes
function diagonal(s, d) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
}

// Toggle children on click
function click(event, d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
    update(d);
}

function getNodeColor(node) {
    if (node.type === 'admin') return TREE_CONFIG.nodeColors.admin;
    if (node.type === 'login') return TREE_CONFIG.nodeColors.login;
    if (node.type === 'api') return TREE_CONFIG.nodeColors.api;
    if (node.type === 'payment') return TREE_CONFIG.nodeColors.payment;
    if (node.type === 'wallet') return TREE_CONFIG.nodeColors.wallet;
    return TREE_CONFIG.nodeColors.page;
}

function formatNodeLabel(node) {
    try {
        const url = new URL(node.url);
        let label = url.pathname;
        if (label === '/') label = url.hostname;
        if (label.length > 30) {
            label = label.substring(0, 27) + '...';
        }
        return label;
    } catch (e) {
        return node.url || 'Unknown';
    }
}

// Add zoom behavior
function initializeZoom() {
    const zoom = d3.zoom()
        .scaleExtent([0.5, 2])
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        });

    d3.select('#treeVisualization svg')
        .call(zoom);
}

// Export functions
window.initializeTreeVisualization = initializeTreeVisualization;
