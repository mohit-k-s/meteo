import React, { useState, useEffect } from 'react'
import MetroMap from './components/MetroMap'
import './App.css'

function App() {
  const [metroData, setMetroData] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [isInTunnel, setIsInTunnel] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [boardingNode, setBoardingNode] = useState(null)
  const [droppingNode, setDroppingNode] = useState(null)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [routeMode, setRouteMode] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [showMobileRoutes, setShowMobileRoutes] = useState(false)

  // Load DMRC data
  useEffect(() => {
    const loadMetroData = async () => {
      try {
        // Try to fetch from API endpoint that reads process.env
        const response = await fetch('/api/metro-data')
        if (response.ok) {
          const data = await response.json()
          setMetroData(data)
          setLoading(false)
          return
        }
        setMetroData(data)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    loadMetroData()
  }, [])

  // GPS tracking
  useEffect(() => {
    let watchId = null

    const startLocationTracking = () => {
      if ('geolocation' in navigator) {
        const options = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            }
            setUserLocation(newLocation)

            // Simple tunnel detection based on accuracy
            // In real implementation, this would be more sophisticated
            setIsInTunnel(position.coords.accuracy > 100)
          },
          (error) => {
            console.warn('Geolocation error:', error)
            // Could indicate tunnel if GPS fails repeatedly
            if (error.code === error.POSITION_UNAVAILABLE) {
              setIsInTunnel(true)
            }
          },
          options
        )
      }
    }

    startLocationTracking()

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  const handleNodeClick = (node) => {
    setSelectedNode(node)
  }

  const handleCloseNodeInfo = () => {
    setSelectedNode(null)
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    // Search through all nodes
    const allNodes = []
    metroData.lines.forEach(line => {
      line.stations.forEach(station => {
        allNodes.push({
          ...station,
          lineName: line.name,
          lineColor: line.color
        })
      })
    })

    // Filter nodes by name or code
    const results = allNodes.filter(node =>
      node.name.toLowerCase().includes(query.toLowerCase()) ||
      node.code.toLowerCase().includes(query.toLowerCase())
    )

    // Remove duplicates by code
    const uniqueResults = results.filter((node, index, self) =>
      index === self.findIndex(n => n.code === node.code)
    )

    setSearchResults(uniqueResults.slice(0, 10)) // Limit to 10 results
    setShowSearchResults(true)
  }

  const handleSearchResultClick = (node) => {
    if (routeMode) {
      if (!boardingNode) {
        setBoardingNode(node)
      } else if (!droppingNode && node.code !== boardingNode.code) {
        setDroppingNode(node)
        calculateRoutes(boardingNode, node)
      }
    } else {
      setSelectedNode(node)
    }
    setShowSearchResults(false)
    setSearchQuery('')

    // Pan map to the selected node
    if (window.meteoMapInstance) {
      window.meteoMapInstance.setView([node.position.lat, node.position.lng], 16)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  const calculateRoutes = (from, to) => {
    if (!metroData || !from || !to) return

    // Build graph of metro network
    const graph = buildMetroGraph(metroData)

    // Find all possible routes
    const allRoutes = findAllRoutes(graph, from.code, to.code)

    // Sort by number of interchanges, then by total stations
    const sortedRoutes = allRoutes.sort((a, b) => {
      if (a.interchanges !== b.interchanges) {
        return a.interchanges - b.interchanges
      }
      return a.totalStations - b.totalStations
    })

    setRoutes(sortedRoutes.slice(0, 3)) // Show top 3 routes
    setSelectedRoute(sortedRoutes[0] || null)
  }

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
            })
          }
        })
      } else {
        // Handle lines without subroutes (original logic)
        const stations = line.stations.sort((a, b) => (a.order || 0) - (b.order || 0))
        for (let i = 0; i < stations.length - 1; i++) {
          const current = stations[i].code
          const next = stations[i + 1].code

          if (current === next) continue

          graph[current].push({
            node: next,
            line: line.id,
            lineName: line.name,
            lineColor: line.color,
            weight: 1
          })
          graph[next].push({
            node: current,
            line: line.id,
            lineName: line.name,
            lineColor: line.color,
            weight: 1
          })
        }
      }
    })

    return { graph, nodeMap }
  }

  const findAllRoutes = (metroGraph, fromCode, toCode, maxRoutes = 20) => {
    const { graph, nodeMap } = metroGraph
    const routes = []

    const dfs = (current, target, path, visitedNodes, visitedLines, currentLine, interchanges) => {
      if (routes.length >= maxRoutes) return
      if (current === target) {
        routes.push({
          path: [...path],
          totalStations: path.length,
          interchanges,
          lines: getRouteLinesInfo(path, nodeMap)
        })
        return
      }

      if (path.length > 50) return // Prevent infinite loops
      if (interchanges > 5) return // Limit interchanges

      const neighbors = graph[current] || []
      for (const neighbor of neighbors) {
        if (!visitedNodes.has(neighbor.node)) {
          const isInterchange = currentLine && currentLine !== neighbor.line

          // Skip if we've already visited this line (prevents loops)
          if (isInterchange && visitedLines.has(neighbor.line)) {
            continue
          }

          const newVisited = new Set(visitedNodes)
          newVisited.add(neighbor.node)

          const newVisitedLines = new Set(visitedLines)
          if (neighbor.line) {
            newVisitedLines.add(neighbor.line)
          }

          const newInterchanges = isInterchange ? interchanges + 1 : interchanges

          dfs(
            neighbor.node,
            target,
            [...path, { ...nodeMap[neighbor.node], line: neighbor.line, lineName: neighbor.lineName, lineColor: neighbor.lineColor }],
            newVisited,
            newVisitedLines,
            neighbor.line,
            newInterchanges
          )
        }
      }
    }

    const startNode = { ...nodeMap[fromCode], line: null }
    dfs(fromCode, toCode, [startNode], new Set([fromCode]), new Set(), null, 0)

    return routes
  }

  const getRouteLinesInfo = (path, nodeMap) => {
    const lines = []
    let currentLine = null

    for (let i = 1; i < path.length; i++) {
      if (path[i].line !== currentLine) {
        currentLine = path[i].line
        lines.push({
          id: currentLine,
          name: path[i].lineName,
          color: path[i].lineColor,
          stations: []
        })
      }
      lines[lines.length - 1].stations.push(path[i])
    }

    return lines
  }

  const toggleRouteMode = () => {
    setRouteMode(!routeMode)
    setBoardingNode(null)
    setDroppingNode(null)
    setRoutes([])
    setSelectedRoute(null)
    setSelectedNode(null)
  }

  const clearRoute = () => {
    setBoardingNode(null)
    setDroppingNode(null)
    setRoutes([])
    setSelectedRoute(null)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center terminal-loading">
        <div className="text-center terminal-panel p-8">
          <div className="text-6xl mb-4 terminal-text">🚇</div>
          <h2 className="text-2xl font-bold terminal-text mb-2">INITIALIZING METEO.SYS</h2>
          <p className="text-sm terminal-text opacity-75">Loading Delhi Metro network data...</p>
          <div className="mt-4">
            <div className="loading-spinner text-2xl">⚡</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center terminal-error p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">SYSTEM ERROR</h2>
          <p className="text-sm font-mono">[FATAL] {error}</p>
          <p className="text-xs mt-2 opacity-75">Press F5 to restart system</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Terminal Header */}
      <header className="terminal-panel border-b p-2 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Logo - responsive */}
            <h1 className="text-lg sm:text-xl terminal-text font-mono font-bold">
              <span className="sm:hidden">METEO</span>
              <span className="hidden sm:inline">METEO.SYS</span>
            </h1>

            {/* Route Planning Toggle - hidden on mobile */}
            <button
              onClick={toggleRouteMode}
              className={`hidden sm:inline-block text-sm terminal-text font-mono border border-current px-2 py-1 ${routeMode ? 'bg-opacity-20 bg-white' : ''
                }`}
            >
              {routeMode ? '[ROUTE_MODE:ON]' : '[ROUTE_PLANNER]'}
            </button>

          </div>

          <div className="flex items-center space-x-2">
            {/* Search - responsive */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={routeMode ? (boardingNode ? "Drop station" : "Start station") : "Search"}
                className="bg-transparent border border-current text-xs sm:text-sm terminal-text font-mono px-2 py-1 w-24 sm:w-48 focus:outline-none focus:border-opacity-100 placeholder-opacity-50"
                style={{ borderColor: 'var(--terminal-green)' }}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="ml-1 text-xs terminal-text hover:opacity-75"
                >
                  ✕
                </button>
              )}

              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-1 terminal-panel border z-50 max-h-64 overflow-y-auto w-64">
                  <div className="p-2">
                    <div className="text-xs terminal-text opacity-75 mb-2 font-mono">
                      [{searchResults.length}] NODES_FOUND
                    </div>
                    {searchResults.map((node, index) => (
                      <div
                        key={`${node.code}-${index}`}
                        onClick={() => handleSearchResultClick(node)}
                        className="cursor-pointer hover:bg-opacity-20 hover:bg-white p-2 border-b border-current border-opacity-20 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm terminal-text font-mono font-bold">
                              [{node.code}] {node.name.toUpperCase()}
                            </div>
                            <div className="text-xs terminal-text opacity-75">
                              {node.lineName} • {node.depth === 'underground' ? 'UNDERGROUND' : 'ELEVATED'}
                              {node.is_interchange && ' • INTERCHANGE'}
                            </div>
                          </div>
                          <div
                            className="w-3 h-3 border"
                            style={{ backgroundColor: node.lineColor, borderColor: node.lineColor }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {showSearchResults && searchResults.length === 0 && searchQuery.trim() && (
                <div className="absolute top-full right-0 mt-1 terminal-panel border z-50 w-64">
                  <div className="p-3 text-center">
                    <div className="text-sm terminal-text opacity-75 font-mono">
                      [NO_NODES_FOUND]
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GPS/Tunnel Status - compact */}
            <div className="text-xs sm:text-sm terminal-text font-mono border border-current px-1 sm:px-2 py-1">
              {isInTunnel ? '[TUNNEL]' : (userLocation ? '[GPS]' : '[NO_GPS]')}
            </div>
          </div>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative">
        {/* Legend Toggle Button - Hidden on mobile */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="hidden sm:block absolute left-4 top-20 z-[1001] text-xs terminal-text font-mono border border-current px-2 py-1 bg-black bg-opacity-80"
        >
          {showLegend ? '[HIDE_LEGEND]' : '[SHOW_LEGEND]'}
        </button>

        {/* Map Legend - Hidden on mobile */}
        {showLegend && (
          <div className="hidden sm:block absolute left-4 top-32 z-[1000] terminal-panel border p-3 w-48 sm:w-56 md:w-64 max-h-80 sm:max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs terminal-text font-mono font-bold">[MAP_LEGEND]</div>
              <button
                onClick={() => setShowLegend(false)}
                className="text-xs terminal-text font-mono hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              {metroData.lines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-2 border border-gray-400 flex-shrink-0"
                    style={{ backgroundColor: line.color }}
                  ></div>
                  <span className="text-xs terminal-text font-mono truncate">
                    {line.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Route Mode Legend */}
            {routeMode && (
              <div className="mt-3 pt-2 border-t border-current">
                <div className="text-xs terminal-text font-mono font-bold mb-2">[ROUTE_LEGEND]</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2 bg-white border border-gray-400 flex-shrink-0"></div>
                    <span className="text-xs terminal-text font-mono">Selected Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full border border-gray-400 flex-shrink-0"></div>
                    <span className="text-xs terminal-text font-mono">Start Station</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full border border-gray-400 flex-shrink-0"></div>
                    <span className="text-xs terminal-text font-mono">End Station</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <MetroMap
          metroData={metroData}
          userLocation={userLocation}
          onNodeClick={handleNodeClick}
          isInTunnel={isInTunnel}
          selectedNode={selectedNode}
          boardingNode={boardingNode}
          droppingNode={droppingNode}
          selectedRoute={selectedRoute}
          routeMode={routeMode}
        />

        {/* Mobile Route Toggle - Bottom Right */}
        <div className="sm:hidden fixed bottom-4 right-4 z-[1001] flex flex-col gap-2">
          <button
            onClick={toggleRouteMode}
            className={`text-xs terminal-text font-mono border border-current px-3 py-2 bg-black bg-opacity-90 ${routeMode ? 'bg-opacity-20 bg-white' : ''
              }`}
          >
            {routeMode ? '[ROUTE]' : '[PLAN]'}
          </button>
          
          {/* Mobile Routes Button */}
          {routes.length > 1 && (
            <button
              onClick={() => setShowMobileRoutes(!showMobileRoutes)}
              className="text-xs terminal-text font-mono border border-current px-3 py-2 bg-black bg-opacity-90"
            >
              [{routes.length} ROUTES]
            </button>
          )}
        </div>

        {/* Mobile Routes Panel */}
        {showMobileRoutes && routes.length > 0 && (
          <div className="sm:hidden fixed bottom-20 right-4 left-4 z-[1000] terminal-panel p-3 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs terminal-text opacity-75 font-mono">
                [{routes.length}] ROUTES_FOUND
              </div>
              <button
                onClick={() => setShowMobileRoutes(false)}
                className="text-xs terminal-text font-mono hover:text-red-400"
              >
                ✕
              </button>
            </div>

            {routes.map((route, index) => (
              <div
                key={index}
                onClick={() => {
                  setSelectedRoute(route)
                  setShowMobileRoutes(false)
                }}
                className={`cursor-pointer border border-current p-2 mb-2 last:mb-0 ${selectedRoute === route ? 'bg-opacity-20 bg-white' : 'hover:bg-opacity-10 hover:bg-white'
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm terminal-text font-mono font-bold">
                    [ROUTE_{index + 1}]
                  </span>
                  <div className="text-xs terminal-text opacity-75 font-mono">
                    {route.totalStations} NODES • {route.interchanges} INTERCHANGES
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {route.lines.map((line, lineIndex) => (
                    <span
                      key={lineIndex}
                      className="text-xs font-mono px-1 border"
                      style={{
                        borderColor: line.color,
                        color: line.color,
                        textShadow: `0 0 3px ${line.color}`,
                      }}
                    >
                      [{line.name.toUpperCase()}]
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Route Planning Status Panel - Hidden on mobile */}
      {routeMode && (boardingNode || droppingNode) && (
        <div className="hidden sm:block absolute top-20 left-4 terminal-panel p-3 z-[1000] min-w-64">
          <div className="text-xs terminal-text opacity-75 mb-2 font-mono">[ROUTE_PLANNING]</div>

          {boardingNode && (
            <div className="mb-2">
              <span className="text-xs terminal-text opacity-75 font-mono">BOARD:</span>
              <div className="text-sm terminal-text font-mono font-bold">
                [{boardingNode.code}] {boardingNode.name.toUpperCase()}
              </div>
            </div>
          )}

          {droppingNode && (
            <div className="mb-2">
              <span className="text-xs terminal-text opacity-75 font-mono">DROP:</span>
              <div className="text-sm terminal-text font-mono font-bold">
                [{droppingNode.code}] {droppingNode.name.toUpperCase()}
              </div>
            </div>
          )}

          {boardingNode && droppingNode && routes.length === 0 && (
            <div className="text-xs terminal-text opacity-75 font-mono">
              [CALCULATING_ROUTES...]
            </div>
          )}

          {routes.length > 0 && (
            <div>
              <button
                onClick={clearRoute}
                className="text-xs terminal-button px-2 py-1 mb-2"
              >
                [CLEAR_ROUTE]
              </button>
            </div>
          )}
        </div>
      )}

      {/* Route Options Panel - Hidden on mobile */}
      {routes.length > 0 && (
        <div className="hidden sm:block absolute top-20 right-4 terminal-panel p-3 z-[1000] max-w-80">
          <div className="text-xs terminal-text opacity-75 mb-2 font-mono">
            [{routes.length}] ROUTES_FOUND
          </div>

          {routes.map((route, index) => (
            <div
              key={index}
              onClick={() => setSelectedRoute(route)}
              className={`cursor-pointer border border-current p-2 mb-2 last:mb-0 ${selectedRoute === route ? 'bg-opacity-20 bg-white' : 'hover:bg-opacity-10 hover:bg-white'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm terminal-text font-mono font-bold">
                  [ROUTE_{index + 1}]
                </span>
                <div className="text-xs terminal-text opacity-75 font-mono">
                  {route.totalStations} NODES • {route.interchanges} INTERCHANGES
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {route.lines.map((line, lineIndex) => (
                  <span
                    key={lineIndex}
                    className="text-xs font-mono px-1 border"
                    style={{
                      borderColor: line.color,
                      color: line.color,
                      textShadow: `0 0 3px ${line.color}`,
                    }}
                  >
                    [{line.name.toUpperCase()}]
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Node Info Panel */}
      {selectedNode && !routeMode && (
        <div className="absolute bottom-4 left-4 right-4 terminal-panel p-4 z-[1000]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold terminal-text mb-1">[NODE] {selectedNode.name.toUpperCase()}</h3>
              <p className="text-sm terminal-text opacity-75 font-mono mb-2">CODE: {selectedNode.code}</p>

              <div className="space-y-2">
                {/* Terminal-style line indicators */}
                <div className="flex flex-wrap gap-2">
                  {selectedNode.is_interchange && selectedNode.interchange_lines ? (
                    selectedNode.interchange_lines.map((lineId, index) => {
                      const lineData = metroData.lines.find(l => l.id === lineId)
                      return (
                        <span
                          key={index}
                          className="px-2 py-1 border text-xs font-mono terminal-text"
                          style={{
                            borderColor: lineData?.color || '#666666',
                            color: lineData?.color || '#666666',
                            textShadow: `0 0 5px ${lineData?.color || '#666666'}`
                          }}
                        >
                          [{lineData?.name?.toUpperCase() || lineId.replace('_', ' ').toUpperCase()}]
                        </span>
                      )
                    })
                  ) : (
                    <span className="px-2 py-1 border text-xs font-mono terminal-text"
                      style={{
                        borderColor: metroData.lines.find(l => l.stations.some(s => s.id === selectedNode.id))?.color,
                        color: metroData.lines.find(l => l.stations.some(s => s.id === selectedNode.id))?.color,
                        textShadow: `0 0 5px ${metroData.lines.find(l => l.stations.some(s => s.id === selectedNode.id))?.color}`
                      }}>
                      [{metroData.lines.find(l => l.stations.some(s => s.id === selectedNode.id))?.name?.toUpperCase()}]
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-4 text-sm font-mono">
                  <span className="terminal-text opacity-75">
                    {selectedNode.depth === 'underground' ? '[UNDERGROUND]' : '[ELEVATED]'}
                  </span>

                  {selectedNode.is_interchange && (
                    <span className="terminal-text border border-current px-1 text-xs">
                      [INTERCHANGE]
                    </span>
                  )}
                </div>
              </div>

              {selectedNode.subroute && !selectedNode.is_interchange && (
                <p className="text-xs terminal-text opacity-50 mt-1 font-mono">
                  ROUTE: {selectedNode.subroute.replace(/-/g, '_').toUpperCase()}
                </p>
              )}
            </div>

            <button
              onClick={handleCloseNodeInfo}
              className="terminal-button px-2 py-1 ml-2 text-xs"
            >
              [X]
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
