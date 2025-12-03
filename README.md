# SriMap - Interactive Map Viewer for Sri Lanka

A beautiful, interactive map application built with Vite, Leaflet.js, and modern web technologies. Displays various layers including railways, highways, roads, rivers, restaurants, districts, and disaster locations across Sri Lanka.

## Features

- 🗺️ **Interactive Map** - Centered on Sri Lanka with zoom controls
- 🚂 **Train Routes** - Railway networks and stations from local GeoJSON data
- 🛣️ **Highways** - Color-coded roads from OpenStreetMap Overpass API
- 🚗 **Roads** - Digitized road network visualization
- 💧 **Rivers** - Waterways and natural water bodies
- 🍽️ **Restaurants** - Dining locations across the country
- 📍 **Districts** - Administrative boundaries
- ⚠️ **Disasters** - Location and type-specific markers with custom icons
- 📍 **Geolocation** - Browser geolocation support to find your location
- 🎮 **Custom Layer Control** - Toggle layers on/off with descriptions and icons

## Technology Stack

- **Frontend Framework**: Vite 7.2.4
- **Map Library**: Leaflet.js 1.9.4
- **Data Format**: GeoJSON
- **Styling**: CSS3 with animations
- **Maps**: OpenStreetMap tiles + Overpass API

## Installation

```bash
# Clone or download the project
cd SriMap

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory, ready for deployment.

## Deployment on Vercel

This project is configured for easy deployment on Vercel:

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Deploy to Vercel
vercel
```

Or connect your repository to Vercel and it will auto-deploy on push.

## Data Sources

- **Railways**: `data/ralway_All.geojson`
- **Highways**: OpenStreetMap Overpass API (real-time)
- **Roads**: `data/roads.geojson`
- **Rivers**: `data/Oya_all.geojson`
- **Restaurants**: `data/restaurants_all.geojson`
- **Districts**: `data/districts.geojson`
- **Disasters**: `data/Disaster_all.geojson` with location-based coloring

## Layer Colors & Icons

Each disaster layer uses location-specific colors:
- **Nuwara Eliya** (Central) - 🔴 Red
- **Colombo** (Western) - 🟢 Green
- **Ratnapura** (Western Slopes) - 🟡 Yellow
- **Jaffna** (Northern) - 🟠 Orange
- **Eastern Region** (Batticaloa, Trincomalee) - 🔵 Cyan
- **Southern Region** (Galle, Matara) - 🟣 Purple

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires JavaScript enabled

## License

Open source - freely available for use and modification.

## Author

Created with ❤️ for Sri Lanka mapping and disaster awareness.
