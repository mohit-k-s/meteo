# Meteo 🌐🚇

Right now i am still working on data and consolidating it. 

But below is the goal


An intelligent browser-based metro navigation PWA that provides **real-time GPS tracking** inside metro systems. Know exactly where you are on your metro journey without relying on announcements or static maps.

## Features

### 🚇 **Live Route Tracking**
- GPS-based real-time position tracking on metro routes
- Automatic tunnel detection when GPS signal is lost
- Visual indicators for underground/elevated stations

### 🔄 **Smart Interchange Handling**
- Detects stations with multiple metro lines
- Prompts users to select their line at interchange stations
- Auto-detection based on movement patterns

### 📍 **Detailed Station Information**
- Station codes, names, and line information
- Entry/exit gate details
- Facilities (washrooms, lifts, parking)
- Nearby landmarks

### 📱 **PWA Experience**
- Works offline with cached route data
- Installable on mobile devices
- Responsive design optimized for mobile use

## Tech Stack

- **Frontend**: React 18 with Vite
- **Maps**: Leaflet.js with React-Leaflet
- **Styling**: TailwindCSS
- **PWA**: Vite PWA plugin
- **Data**: GeoJSON format for metro network data

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meteo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Navigate to `http://localhost:3000`
   - Allow location permissions for GPS tracking

### Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
meteo/
├── src/
│   ├── components/
│   │   └── MetroMap.jsx      # Interactive metro map component
│   ├── App.jsx               # Main application component
│   ├── main.jsx              # Application entry point
│   └── index.css             # Global styles
├── assets/
│   └── intersections.json    # Interchange station data
├── dmrc.json                 # Delhi Metro network data
├── dmrc-consolidator.js      # Data processing script
├── fix-coordinates.js        # Coordinate correction utilities
├── fix-station-codes.js      # Station code standardization
└── index.html                # PWA entry point
```

## Data Processing Scripts

The project includes several Node.js scripts for processing and cleaning metro data:

- **`dmrc-consolidator.js`** - Consolidates metro line data into unified format
- **`fix-coordinates.js`** - Corrects and validates station coordinates
- **`fix-station-codes.js`** - Standardizes station codes across lines

## Current Coverage

### Delhi Metro (DMRC)
- ✅ **10 Lines** with complete station data
- ✅ **285+ Stations** with coordinates and metadata
- ✅ **Interchange detection** and line mapping
- ✅ **Station facilities** and depth information

## Usage

1. **Open the app** and allow location permissions
2. **View your position** on the metro map in real-time
3. **Tap stations** to view detailed information
4. **Navigate confidently** with tunnel detection and offline support

## Development

### Adding New Metro Networks

1. Create data files in GeoJSON format following the DMRC structure
2. Add line configurations in the consolidator script
3. Update the data loading logic in `App.jsx`

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] **Enhanced tunnel detection** with more sophisticated algorithms
- [ ] **Multi-city support** (Bangalore, Mumbai metros)
- [ ] **Community contributions** for station metadata
- [ ] **AR features** for exit navigation
- [ ] **Real-time service updates** integration

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Delhi Metro Rail Corporation (DMRC) for public transit data
- OpenStreetMap contributors for geographic data
- React and Leaflet.js communities

---

**Built with ❤️ for better metro navigation**
