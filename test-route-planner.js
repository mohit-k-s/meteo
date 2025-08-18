#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load DMRC data
const dmrcData = JSON.parse(fs.readFileSync(path.join(__dirname, 'dmrc2.json'), 'utf8'));

// Route Planning Algorithm (extracted from App.jsx)
function buildMetroGraph(data) {
    const graph = {};
    const nodeMap = {};

    // Build node map and initialize graph
    data.lines.forEach(line => {
        line.stations.forEach(station => {
            if (!nodeMap[station.code]) {
                nodeMap[station.code] = {
                    ...station,
                    lines: []
                };
                graph[station.code] = [];
            }
            nodeMap[station.code].lines.push({
                id: line.id,
                name: line.name,
                color: line.color
            });
        });
    });

    // Connect adjacent stations on each line, handling subroutes
    data.lines.forEach(line => {
        // Check if line has subroutes
        const hasSubroutes = line.stations.some(station => station.subroute);

        if (hasSubroutes) {
            // Group stations by subroute
            const subrouteGroups = {};
            line.stations.forEach(station => {
                const subrouteName = station.subroute || 'main';
                if (!subrouteGroups[subrouteName]) {
                    subrouteGroups[subrouteName] = [];
                }
                subrouteGroups[subrouteName].push(station);
            });

            // Connect stations within each subroute
            Object.entries(subrouteGroups).forEach(([subrouteName, stations]) => {
                const sortedStations = stations.sort((a, b) => (a.order || 0) - (b.order || 0));

                for (let i = 0; i < sortedStations.length - 1; i++) {
                    const current = sortedStations[i].code;
                    const next = sortedStations[i + 1].code;

                    if (current === next) continue;

                    graph[current].push({
                        node: next,
                        line: line.id,
                        lineName: line.name,
                        lineColor: line.color,
                        subroute: subrouteName,
                        weight: 1
                    });
                    graph[next].push({
                        node: current,
                        line: line.id,
                        lineName: line.name,
                        lineColor: line.color,
                        subroute: subrouteName,
                        weight: 1
                    });
                }
            });
        } else {
            // Handle lines without subroutes (original logic)
            const stations = line.stations.sort((a, b) => (a.order || 0) - (b.order || 0));
            for (let i = 0; i < stations.length - 1; i++) {
                const current = stations[i].code;
                const next = stations[i + 1].code;

                if (current === next) continue;

                graph[current].push({
                    node: next,
                    line: line.id,
                    lineName: line.name,
                    lineColor: line.color,
                    weight: 1
                });
                graph[next].push({
                    node: current,
                    line: line.id,
                    lineName: line.name,
                    lineColor: line.color,
                    weight: 1
                });
            }
        }
    });

    return { graph, nodeMap };
}

function findAllRoutes(metroGraph, fromCode, toCode, maxRoutes = 10) {
    const { graph, nodeMap } = metroGraph;
    const routes = [];
    // console.log(JSON.stringify(graph, null, 2))


    const dfs = (current, target, path, visitedNodes, visitedLines, currentLine, interchanges) => {
        if (routes.length >= maxRoutes) return;

        if (current === target) {
            console.log("pushing ??")
            routes.push({
                path: [...path],
                totalStations: path.length,
                interchanges,
                lines: getRouteLinesInfo(path, nodeMap)
            });
            return;
        }

        // if (path.length > 50) return; // Prevent infinite loops - reduced limit
        if (interchanges > 5) return; // Limit interchanges to prevent excessive routes

        const neighbors = graph[current] || [];
        for (const neighbor of neighbors) {
            if (!visitedNodes.has(neighbor.node)) {
                const isInterchange = currentLine && currentLine !== neighbor.line;

                console.log(">>>>>>>>>", isInterchange, "  ", neighbor.line, current, " ", neighbor.node)

                // Skip if we've already visited this line (prevents loops)
                if (isInterchange && visitedLines.has(neighbor.line)) {
                    continue;
                }

                const newVisited = new Set(visitedNodes);
                newVisited.add(neighbor.node);

                const newVisitedLines = new Set(visitedLines);
                if (neighbor.line) {
                    newVisitedLines.add(neighbor.line);
                }

                const newInterchanges = isInterchange ? interchanges + 1 : interchanges;

                dfs(
                    neighbor.node,
                    target,
                    [...path, { ...nodeMap[neighbor.node], line: neighbor.line, lineName: neighbor.lineName, lineColor: neighbor.lineColor }],
                    newVisited,
                    newVisitedLines,
                    neighbor.line,
                    newInterchanges
                );
            }
        }
    };

    const startNode = { ...nodeMap[fromCode], line: null };
    dfs(fromCode, toCode, [startNode], new Set([fromCode]), new Set(), null, 0);

    console.log(routes)

    return routes;
}

function getRouteLinesInfo(path, nodeMap) {
    const lines = [];
    let currentLine = null;

    for (let i = 1; i < path.length; i++) {
        if (path[i].line !== currentLine) {
            currentLine = path[i].line;
            lines.push({
                id: currentLine,
                name: path[i].lineName,
                color: path[i].lineColor,
                stations: []
            });
        }
        lines[lines.length - 1].stations.push(path[i]);
    }

    return lines;
}

// Test Cases
function runTests() {
    console.log('🚇 METEO ROUTE PLANNER TEST SUITE');
    console.log('='.repeat(50));

    const metroGraph = buildMetroGraph(dmrcData);
    // console.log(JSON.stringify(metroGraph, null, 2))
    console.log(`📊 Network Stats:`);
    console.log(`   • Total Nodes: ${Object.keys(metroGraph.nodeMap).length}`);
    console.log(`   • Total Lines: ${dmrcData.lines.length}`);
    console.log('');

    // Test cases with actual station codes from dmrc.json
    const testCases = [
        {
            name: 'Sector 10 to Vaishali',
            from: 'DS10',
            to: 'CHHA'
        }
    ];

    testCases.forEach((testCase, index) => {
        console.log(`🧪 Test ${index + 1}: ${testCase.name}`);
        console.log(`   From: ${testCase.from} → To: ${testCase.to}`);

        try {
            const routes = findAllRoutes(metroGraph, testCase.from, testCase.to);

            if (routes.length === 0) {
                console.log('   ❌ No routes found');
            } else {
                console.log(`   ✅ Found ${routes.length} route(s):`);

                routes.forEach((route, routeIndex) => {
                    console.log(`   
   Route ${routeIndex + 1}:`);
                    console.log(`     • Stations: ${route.totalStations}`);
                    console.log(`     • Interchanges: ${route.interchanges}`);
                    console.log(`     • Lines: ${route.lines.map(l => l.name).join(' → ')}`);

                    // Show detailed path
                    const pathNames = route.path.map(node => `${node.code}(${node.name})`).join(' → ');
                    console.log(`     • Path: ${pathNames}`);
                });
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

    });

    console.log('🎯 Test Complete!');
}

// Run the tests
if (require.main === module) {
    runTests();
}

module.exports = {
    buildMetroGraph,
    findAllRoutes,
    getRouteLinesInfo,
    runTests
};
