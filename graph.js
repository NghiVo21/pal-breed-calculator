class Node {
    constructor(id) {
        this.id = id;
        this.result = new Map();
    }

    addResult(adjacentId, resultId) {
        if (!this.result.has(resultId)) {
            this.result.set(resultId, []);
        }
        this.result.get(resultId).push(adjacentId);
    }
}

class Graph {
    constructor() {
        this.nodes = new Map();
    }

    addNode(id) {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, new Node(id));
        }
    }

    addEdge(id1, id2, resultId) {
        if (!this.nodes.has(id1) || !this.nodes.has(id2)) {
            throw new Error('Start or end node not found');
        }
        this.nodes.get(id1).addResult(id2, resultId);
    }

    getNode(id) {
        return this.nodes.get(id);
    }
}

const LEEWAY = 1;
let graphData, idNameMap;
let graph = new Graph();

function loadJSON(filePath) {
    return fetch(filePath).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    ).catch(error => {
        console.error('Error fetching JSON:', error);
    }
    );
}

async function init() {
    try {
        graphData = await loadJSON('graph_data.json');
        graph = buildGraph(graphData);

        idNameMap = await loadJSON('id_name_map.json');
        populateSelectBoxes();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
    validateInput();
}

function buildGraph(graphData) {
    for (let node in graphData) {
        let nodeNum = parseInt(node, 10);
        graph.addNode(nodeNum);
        for (let resultNode in graphData[nodeNum]) {
            let adjIds = graphData[node][resultNode].map(id => parseInt(id, 10));
            for (let adjId of adjIds) {
                graph.addNode(parseInt(adjId, 10));
                graph.addEdge(nodeNum, adjId, parseInt(resultNode, 10));
            }
        }
    }
    return graph;
}

function populateSelectBoxes() {
    const list1Select = document.getElementById('list1');
    const list2Select = document.getElementById('list2');
    const targetIdSelect = document.getElementById('targetId');

    for (let [id, name] of Object.entries(idNameMap)) {
        const option = new Option(`${name} (${id})`, id);
        list1Select.add(option.cloneNode(true));
        list2Select.add(option.cloneNode(true));
        targetIdSelect.add(option.cloneNode(true));
    }

    const list1Choices = new Choices(list1Select, {
        removeItemButton: true,
        searchEnabled: true
    });
    const list2Choices = new Choices(list2Select, {
        removeItemButton: true,
        searchEnabled: true
    });
    const targetIdChoices = new Choices(targetIdSelect, {
        searchEnabled: true
    });
}

function bfs(startIds, targetId) {
    const visited = startIds.reduce((acc, num) => {
        acc[num] = new Map();
        return acc;
    }, {});

    let minLength = Infinity;
    let queue = startIds.map(startId => ({ path: [{ left: null, right: null, to: startId }], nodes: new Set([startId]) }));
    let paths = [];
    while (queue.length > 0) {
        let { path, nodes } = queue.shift();
        if (path.length > (minLength + LEEWAY)) break;
        let lastNodeId = path[path.length - 1].to;
        if (lastNodeId === targetId) {
            if (path.length < minLength) {
                minLength = path.length;
            }
            paths.push(path);
            continue;
        }
        let lastNode = graph.getNode(lastNodeId);
        lastNode.result.forEach((adjacentIds, resultId) => {
            if (visited[path[0].to].has(resultId) && visited[path[0].to].get(resultId) < path.length) return;
            if (resultId !== targetId) visited[path[0].to].set(resultId, path.length);
            if (!nodes.has(resultId)) {
                let newPath = [...path, { left: lastNodeId, right: adjacentIds, to: resultId }];
                let newNodes = new Set([...nodes, resultId]);
                queue.push({ path: newPath, nodes: newNodes });
            }
        });
    }
    return paths;
}

function getPathsAdjacentWithIds(paths, ids) {
    const validPaths = [];
    paths.forEach(path => {
        let valid = false;
        path.forEach(step => {
            if (!step.right) return;
            const intersection = step.right.filter(right => ids.includes(right))
            if (intersection.length !== 0) {
                step.right = intersection;
                valid = true;
            }
        })
        if (valid) validPaths.push(path);
    })
    return validPaths;
}

function filterShortestArrays(arrays) {
    const minLength = Math.min(...arrays.map(arr => arr.length));
    return arrays.filter(arr => arr.length === minLength);
}

function getPathsEncounterIds(paths, ids) {
    const validPaths = [];
    paths.forEach(path => {
        let valid = false;
        path.forEach(step => {
            if (!step.right) return;
            if (ids.includes(step.to)) valid = true;
        })
        if (valid) validPaths.push(path);
    })
    return validPaths;
}

function findShortestPaths(graph, list1, list2, targetId) {
    let pathsFromStart1 = bfs(list1, targetId);

    if (!list2 || list2.length === 0) {
        return filterShortestArrays(pathsFromStart1).map(path => ({ path1: path }));
    }
    const pathsAdjacentWithIds = getPathsAdjacentWithIds(pathsFromStart1, list2);
    if (pathsAdjacentWithIds.length !== 0) return filterShortestArrays(pathsAdjacentWithIds).map(path => ({ path1: path }));
    const pathsEncounterIds = getPathsEncounterIds(pathsFromStart1, list2);
    if (pathsEncounterIds.length !== 0) return filterShortestArrays(pathsEncounterIds).map(path => ({ path1: path }));

    let pathsFromStart2 = list2.length > 0 ? bfs(list2, targetId) : [];
    return mergeAndEvaluatePaths(pathsFromStart1, pathsFromStart2);
}

function mergeAndEvaluatePaths(pathsFromStart1, pathsFromStart2) {
    let bestPaths = [];
    let minUniqueNodes = Infinity;

    pathsFromStart1.forEach(path1 => {
        pathsFromStart2.forEach(path2 => {
            let convergeAtParent = false;
            let convergenceIndex2;
            let convergenceIndex1 = path1.findIndex(step1 =>
                path2.some((step2, index) => {
                    const valid = step1.right?.includes(step2.to);
                    if (valid) convergenceIndex2 = index;
                    return valid;
                })
            );
            if (convergenceIndex2 !== undefined) {
                convergeAtParent = true;
            }
            convergenceIndex1 = convergenceIndex1 !== undefined ? path1.findIndex(step1 =>
                path2.some((step2, index) => {
                    const valid = step2.to === step1.to;
                    if (valid) convergenceIndex2 = index;
                    return valid;
                })
            ) : convergenceIndex1;
            let convergencePoint = convergenceIndex1 !== -1 ? path1[convergenceIndex1] : null;

            let adjustedPath1 = convergenceIndex1 !== -1 ? path1.slice(0, convergenceIndex1 + 1) : path1;
            let adjustedPath2 = convergenceIndex2 !== -1 ? path2.slice(0, convergenceIndex2 + 1) : path2;
            let convergedPath = convergencePoint ? path1.slice(convergenceIndex1 + 1) : [];
            if (convergeAtParent) {
                adjustedPath1[adjustedPath1.length - 1].right = [adjustedPath2[adjustedPath2.length - 1].to];
            } else {
                convergedPath.splice(0, 0, { left: adjustedPath1[adjustedPath1.length - 1].to, right: [adjustedPath2[adjustedPath2.length - 1].to], to: adjustedPath1[adjustedPath1.length - 1].to })
            }

            let totalNodes = [...adjustedPath1, ...adjustedPath2, ...convergedPath].filter(step => step.left).length;

            if (totalNodes < minUniqueNodes) {
                bestPaths = [{ path1: adjustedPath1, path2: adjustedPath2, converge: convergedPath }];
                minUniqueNodes = totalNodes;
            } else if (totalNodes === minUniqueNodes) {
                bestPaths.push({ path1: adjustedPath1, path2: adjustedPath2, converge: convergedPath });
            }
        });
    });

    return bestPaths;
}

function displayPaths(paths) {
    if (paths.length === 0) return 'No path found';
    return paths.map(({ path1, path2, converge }, index) => {
        const pathDescription = [path1, path2, converge].filter(path => path && path.length > 1).map(path => path.slice(1).map((step, stepIndex) => {
            const left = step.left !== null ? idNameMap[step.left] || step.left : null;
            const right = step.right !== null ? step.right.map(rightId => `${idNameMap[rightId] || rightId} (${rightId})`).join(', ') : null;
            const result = step.to !== null ? idNameMap[step.to.toString()] || step.to : null;


            if (left !== null && right !== null) {
                return `${stepIndex === 0 ? 'Start with ' : ''}${left} (${step.left}) + ${right} = ${result} (${step.to})`;
            }
            return `Start at node ${result} (${step.to})`;
        }).join('<br>')).join('<br>');

        return `Path ${index + 1}:<br>${pathDescription}`;
    }).join('<br><br>');
}

function validateInput() {
    const list1 = document.getElementById('list1');
    const targetId = document.getElementById('targetId');
    const findPathButton = document.getElementById('findPathButton');

    if (list1.value && targetId.value) {
        findPathButton.disabled = false;
    } else {
        findPathButton.disabled = true;
    }
}

function findPath() {
    const list1 = Array.from(document.getElementById('list1').selectedOptions).map(o => parseInt(o.value, 10));
    const list2Select = document.getElementById('list2');
    const list2 = list2Select ? Array.from(list2Select.selectedOptions).map(o => parseInt(o.value, 10)) : [];
    const targetId = parseInt(document.getElementById('targetId').value, 10);

    if (!isNaN(targetId) && list1.length > 0) {
        const shortestPaths = findShortestPaths(graph, list1, list2, targetId);
        const pathResultElement = document.getElementById('pathResult');
        pathResultElement.innerHTML = displayPaths(shortestPaths);
    } else {
        document.getElementById('pathResult').textContent = 'Please select a valid target ID.';
    }
}

window.onload = init;
