import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Terminal-style network node icons with selection states
const createNodeIcon = (color, isInterchange = false, isSelected = false, isDimmed = false) => {
  const size = isSelected ? (isInterchange ? '20px' : '16px') : (isInterchange ? '16px' : '12px')
  const borderWidth = isSelected ? '4px' : isInterchange ? '3px' : '2px'
  const opacity = isDimmed ? '0.4' : '1'
  const glowSize = isSelected ? '20px' : isDimmed ? '2px' : '8px'
  const borderColor = isSelected ? color : 'var(--terminal-green)'
  const animation = isSelected ? 'terminalGlow 0.8s ease-in-out infinite alternate' :
    isInterchange && !isDimmed ? 'terminalGlow 2s ease-in-out infinite alternate' : 'none'

  return L.divIcon({
    className: 'custom-node-marker node-marker',
    html: `<div style="
      width: ${size}; 
      height: ${size}; 
      background-color: ${color}; 
      border: ${borderWidth} solid ${borderColor}; 
      border-radius: 0; 
      box-shadow: 0 0 ${glowSize} ${color}, inset 0 0 4px rgba(0,0,0,0.5);
      opacity: ${opacity};
      animation: ${animation};
      filter: drop-shadow(0 0 ${isDimmed ? '1px' : isSelected ? '8px' : '3px'} ${color});
      transition: all 0.3s ease;
      transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
    "></div>`,
    iconSize: [parseInt(size), parseInt(size)],
    iconAnchor: [parseInt(size) / 2, parseInt(size) / 2]
  })
}

// Terminal-style user location marker
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="
    width: 20px; 
    height: 20px; 
    background-color: var(--terminal-green); 
    border: 3px solid var(--terminal-bg); 
    border-radius: 0; 
    box-shadow: 0 0 15px var(--terminal-green), inset 0 0 5px rgba(0,0,0,0.5);
    animation: pulse 2s infinite;
    filter: drop-shadow(0 0 5px var(--terminal-green));
  "></div>
  <style>
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0.7), 0 0 15px var(--terminal-green); }
      70% { box-shadow: 0 0 0 15px rgba(0, 255, 65, 0), 0 0 20px var(--terminal-green); }
      100% { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0), 0 0 15px var(--terminal-green); }
    }
  </style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

function MapUpdater({ userLocation, isInTunnel }) {
  const map = useMap()

  useEffect(() => {
    if (userLocation && !isInTunnel) {
      map.setView([userLocation.lat, userLocation.lng], 15)
    }
  }, [userLocation, isInTunnel, map])

  return null
}

function MetroMap({ metroData, userLocation, onNodeClick, isInTunnel, selectedNode, boardingNode, droppingNode, selectedRoute, routeMode }) {
  const mapRef = useRef()
  const [showStreetMap, setShowStreetMap] = React.useState(false)

  // Expose map instance globally for search navigation
  const handleMapReady = (e) => {
    window.meteoMapInstance = e.target
  }

  // Delhi Metro center coordinates
  const delhiCenter = [28.6139, 77.2090]

  // Generate line paths for rendering - handle subroutes for any line
  const generateLinePaths = (line) => {
    // Check if line has stations with subroute property
    const hasSubroutes = line.stations.some(station => station.subroute)

    if (hasSubroutes) {
      // Group stations by subroute
      const subroutes = {}
      line.stations.forEach(station => {
        const subroute = station.subroute || 'main'
        if (!subroutes[subroute]) {
          subroutes[subroute] = []
        }
        subroutes[subroute].push([station.position.lat, station.position.lng])
      })
      return subroutes
    }

    // For lines without subroutes, return single path
    return { main: line.stations.map(station => [station.position.lat, station.position.lng]) }
  }

  return (
    <div className="h-full relative">
      {/* Terminal Map Toggle Button */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowStreetMap(!showStreetMap)}
          className="terminal-button px-3 py-2 text-sm font-mono"
        >
          {showStreetMap ? '[STREET_VIEW]' : '[METRO_ONLY]'}
        </button>
      </div>

      <MapContainer
        center={delhiCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="terminal-map"
        ref={mapRef}
        whenReady={handleMapReady}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={showStreetMap ? 0.7 : 0}
          errorTileUrl="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
        />

        <MapUpdater userLocation={userLocation} isInTunnel={isInTunnel} />

        {/* Render metro lines and stations */}
        {metroData.lines.map((line) => {
          const linePaths = generateLinePaths(line)
          return (
            <React.Fragment key={line.id}>
              {/* Line paths - handle multiple subroutes */}
              {Object.entries(linePaths).map(([subrouteName, positions]) => (
                <Polyline
                  key={`${line.id}-${subrouteName}`}
                  positions={positions}
                  color={line.color}
                  weight={6}
                  opacity={1}
                  dashArray="5, 10"
                  className="terminal-line"
                />
              ))}

              {/* Network Nodes */}
              {line.stations.map((node) => {
                let isSelected = selectedNode && selectedNode.id === node.id
                let isDimmed = selectedNode && selectedNode.id !== node.id
                let nodeColor = line.color

                // Route mode styling
                if (routeMode) {
                  const isBoardingNode = boardingNode && boardingNode.code === node.code
                  const isDroppingNode = droppingNode && droppingNode.code === node.code
                  const isOnSelectedRoute = selectedRoute && selectedRoute.path.some(p => p.code === node.code)

                  // Hide nodes that are not on the selected route
                  if (selectedRoute && !isOnSelectedRoute && !isBoardingNode && !isDroppingNode) {
                    return null
                  }

                  if (isBoardingNode) {
                    isSelected = true
                    isDimmed = false
                    nodeColor = '#00ff00'
                  } else if (isDroppingNode) {
                    isSelected = true
                    isDimmed = false
                    nodeColor = '#ff0000'
                  } else if (isOnSelectedRoute) {
                    isSelected = false
                    isDimmed = false
                    nodeColor = line.color
                  } else {
                    isDimmed = true
                    isSelected = false
                  }
                }

                return (
                  <Marker
                    key={node.id}
                    position={[node.position.lat, node.position.lng]}
                    icon={createNodeIcon(nodeColor, node.is_interchange, isSelected, isDimmed)}
                    eventHandlers={{
                      click: () => onNodeClick(node)
                    }}
                  >
                    {/* Show node code and sequence for route path nodes */}
                    {routeMode && selectedRoute && (() => {
                      const routeIndex = selectedRoute.path.findIndex(p => p.code === node.code)
                      return routeIndex !== -1 ? (
                        <Tooltip permanent direction="top" offset={[0, -10]} className="node-code-tooltip">
                          <div className="bg-black text-green-400 font-mono text-xs px-1 border border-green-400">
                            {routeIndex + 1}. [{node.code}]
                          </div>
                        </Tooltip>
                      ) : null
                    })()}
                  </Marker>
                )
              })}
            </React.Fragment>
          )
        })}

        {/* Route Path Visualization */}
        {selectedRoute && routeMode && (
          <React.Fragment>
            {/* Draw route path with glowing white effect */}
            {selectedRoute.path.length > 1 && (
              <>
                {/* Outer glow layer */}
                <Polyline
                  positions={selectedRoute.path.map(node => [node.position.lat, node.position.lng])}
                  color="#ffffff"
                  weight={16}
                  opacity={0.3}
                  className="route-path-glow"
                />
                {/* Middle glow layer */}
                <Polyline
                  positions={selectedRoute.path.map(node => [node.position.lat, node.position.lng])}
                  color="#ffffff"
                  weight={12}
                  opacity={0.6}
                  className="route-path-glow-mid"
                />
                {/* Main route line */}
                <Polyline
                  positions={selectedRoute.path.map(node => [node.position.lat, node.position.lng])}
                  color="#ffffff"
                  weight={6}
                  opacity={1.0}
                  className="route-path-main"
                />
              </>
            )}
          </React.Fragment>
        )}

        {/* User location marker */}
        {userLocation && !isInTunnel && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: '<div style="width: 20px; height: 20px; background: var(--terminal-green); border: 3px solid var(--terminal-bg); border-radius: 50%; box-shadow: 0 0 15px var(--terminal-green); animation: terminalGlow 1s ease-in-out infinite alternate;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}
          />
        )}

        {/* User location popup */}
        {userLocation && !isInTunnel && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
          >
            <Popup>
              <div className="text-center bg-black text-green-400 font-mono p-2 border border-green-400">
                <h3 className="font-bold text-sm">[USER_POSITION]</h3>
                <p className="text-xs opacity-75">ACCURACY: ±{Math.round(userLocation.accuracy)}M</p>
                <p className="text-xs opacity-50">LAT: {userLocation.lat.toFixed(6)}</p>
                <p className="text-xs opacity-50">LNG: {userLocation.lng.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Tunnel notification - non-blocking */}
      {isInTunnel && (
        <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
          <div className="bg-black bg-opacity-80 text-green-400 font-mono text-sm px-3 py-2 border border-green-400 rounded">
            <div className="flex items-center gap-2">
              <div className="text-lg">🚇</div>
              <div>
                <div className="font-bold">[TUNNEL_MODE]</div>
                <div className="text-xs opacity-75">GPS signal lost</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MetroMap
