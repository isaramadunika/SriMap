import L from 'leaflet';
import './style.css';

// Initialize the map
// Centered on Sri Lanka to match the railway data
const map = L.map('map').setView([9.77, 80.03], 12);

// Request user location
if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 13);

        // Add a marker for the user's location
        L.marker([latitude, longitude]).addTo(map)
            .bindPopup('You are here')
            .openPopup();
    }, (error) => {
        console.error('Error getting location:', error);
    });
}

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Function to load and display GeoJSON
// Function to fetch highways from local GeoJSON file (FAST - not API)
async function fetchHighwaysFromOSM() {
    try {
        const response = await fetch('/data/HW_all.geojson');
        if (!response.ok) throw new Error('Failed to load highway data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Error loading highway data:', error);
        return {
            type: 'FeatureCollection',
            features: []
        };
    }
}

// Function to fetch train routes from local GeoJSON file
async function fetchTrainRoutesFromOSM() {
    try {
        const response = await fetch('/data/ralway_All.geojson');
        if (!response.ok) throw new Error('Failed to load railway data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Error loading railway data:', error);
        return {
            type: 'FeatureCollection',
            features: []
        };
    }
}

// Function to load and display GeoJSON layers
async function loadLayers() {
    try {
        // Fetch all data in parallel for faster loading
        const [trainData, restaurantData, roadsData, riversData, districtsData, disastersData, highwayData] = await Promise.all([
            fetchTrainRoutesFromOSM(),
            fetch('/data/restaurants_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/HW_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/Oya_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/districts.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/Disaster_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetchHighwaysFromOSM()
        ]);

        // Create Train Layer
        const trainLayer = L.geoJSON(trainData, {
            style: (feature) => {
                if (feature.geometry.type === 'LineString') {
                    return { color: '#ef4444', weight: 4 };
                }
                return {};
            },
            pointToLayer: (feature, latlng) => {
                if (feature.properties.type === 'Station') {
                    return L.circleMarker(latlng, {
                        radius: 6,
                        fillColor: '#ef4444',
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 1
                    });
                }
                return L.marker(latlng);
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(`${feature.properties.name} (${feature.properties.type})`);
                }
            }
        });

        // Create Restaurant Layer
        const restaurantLayer = L.geoJSON(restaurantData, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#10b981',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                }
            }
        });

        // Create Highway Layer
        const highwayLayer = L.geoJSON(highwayData, {
            style: (feature) => {
                const highwayType = feature.properties.highway_type;
                let weight = 2;
                let color = '#888888';
                
                if (highwayType === 'motorway') {
                    color = '#e74c3c';
                    weight = 5;
                } else if (highwayType === 'trunk') {
                    color = '#f39c12';
                    weight = 4;
                } else if (highwayType === 'primary') {
                    color = '#f1c40f';
                    weight = 3.5;
                } else if (highwayType === 'secondary') {
                    color = '#2ecc71';
                    weight = 3;
                } else if (highwayType === 'tertiary') {
                    color = '#3498db';
                    weight = 2.5;
                } else if (highwayType === 'residential') {
                    color = '#95a5a6';
                    weight = 2;
                }
                
                return { color, weight, opacity: 0.7 };
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    const name = feature.properties.name || 'Road';
                    const type = feature.properties.highway_type || 'road';
                    const ref = feature.properties.ref ? ` (${feature.properties.ref})` : '';
                    layer.bindPopup(`<strong>${name}${ref}</strong><br>Type: ${type}`);
                }
            }
        });

        // Create Roads Layer
        const roadsLayer = L.geoJSON(roadsData, {
            style: {
                color: '#8B4513',
                weight: 2,
                opacity: 0.6
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    const name = feature.properties.name || 'Road';
                    const type = feature.properties.type || 'road';
                    layer.bindPopup(`<strong>${name}</strong><br>Type: ${type}`);
                }
            }
        });

        // Create Rivers Layer
        const riversLayer = L.geoJSON(riversData, {
            style: {
                color: '#3498db',
                weight: 2,
                opacity: 0.7
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    const name = feature.properties.name || 'River';
                    layer.bindPopup(`<strong>${name}</strong><br>Type: River`);
                }
            }
        });

        // Create Districts Layer
        const districtsLayer = L.geoJSON(districtsData, {
            style: {
                color: '#a855f7',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.1
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                }
            }
        });

        // Create Disasters Layer with Location-based Colors
        const disastersLayer = L.geoJSON(disastersData, {
            pointToLayer: (feature, latlng) => {
                let color = '#eab308'; // default yellow
                let disasterType = 'Hazard';
                let iconSvg = '';

                const props = feature.properties;
                const isIn = props.is_in?.toLowerCase() || '';
                const name = props.name?.toLowerCase() || '';
                const lat = latlng.lat;
                const lng = latlng.lng;

                // Location-based color assignment
                // Nuwara Eliya region - RED (Central highlands, around 6.9°N, 80.8°E)
                if (isIn.includes('nuwara') || isIn.includes('kandy') || isIn.includes('matara') || 
                    (lat >= 6.7 && lat <= 7.1 && lng >= 80.6 && lng <= 81.1)) {
                    color = '#dc2626'; // Red for Nuwara Eliya
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="9" y1="12" x2="15" y2="12"></line>
                    </svg>`;
                }
                // Colombo region - GREEN (Western coast, around 6.9°N, 79.9°E)
                else if (isIn.includes('colombo') || isIn.includes('gampaha') || isIn.includes('kalutara') ||
                         (lat >= 6.5 && lat <= 7.3 && lng >= 79.7 && lng <= 80.1)) {
                    color = '#10b981'; // Green for Colombo
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z"></path>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>`;
                }
                // Ratnapura region - YELLOW (Western slopes, around 6.6°N, 80.4°E)
                else if (isIn.includes('ratnapura') || isIn.includes('kegalle') || isIn.includes('sabaragamuwa') ||
                         (lat >= 6.4 && lat <= 6.8 && lng >= 80.2 && lng <= 80.6)) {
                    color = '#fbbf24'; // Amber/Yellow for Ratnapura
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>`;
                }
                // Jaffna region - ORANGE (Northern peninsula, around 9.7°N, 80.0°E)
                else if (isIn.includes('jaffna') || (lat >= 9.5 && lat <= 9.9 && lng >= 79.8 && lng <= 80.2)) {
                    color = '#f97316'; // Orange for Jaffna
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                    </svg>`;
                }
                // Eastern region - CYAN (Batticaloa, Trincomalee, around 8.3°N, 81.3°E)
                else if (isIn.includes('batticaloa') || isIn.includes('trincomalee') || isIn.includes('ampara') ||
                         (lat >= 7.8 && lat <= 8.8 && lng >= 81.1 && lng <= 81.5)) {
                    color = '#06b6d4'; // Cyan for Eastern region
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M12 2v20M2 12h20M6 6l12 12M18 6L6 18"></path>
                    </svg>`;
                }
                // Southern region - PURPLE (Galle, Matara, around 6.0°N, 80.2°E)
                else if (isIn.includes('galle') || isIn.includes('matara') || isIn.includes('southern') ||
                         (lat >= 5.8 && lat <= 6.3 && lng >= 80.0 && lng <= 80.5)) {
                    color = '#10b981'; // Purple for Southern region
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <polygon points="12 2 22 8 22 16 12 22 2 16 2 8 12 2"></polygon>
                    </svg>`;
                }
                // Default - Yellow
                else {
                    color = '#eab308'; // Yellow default
                    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>`;
                }

                // Create custom location-specific icon
                const icon = L.divIcon({
                    className: 'disaster-marker',
                    html: `
                        <div class="disaster-marker-container">
                            <div class="disaster-pulse" style="background-color: ${color}; box-shadow: 0 0 0 0 ${color}80;"></div>
                            <div class="disaster-icon" style="background-color: ${color};">
                                ${iconSvg}
                                <div class="disaster-severity-label">${disasterType}</div>
                            </div>
                        </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                return L.marker(latlng, { icon });
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    const props = feature.properties;
                    const popup = `
                        <strong>${props.name}</strong><br>
                        Location: ${props.is_in || 'Sri Lanka'}<br>
                        Type: ${props.natural || props.water || props.emergency || 'Natural Site'}
                    `;
                    layer.bindPopup(popup);
                }
            }
        });

        // Add layers to map immediately - FAST LOAD
        trainLayer.addTo(map);
        highwayLayer.addTo(map);
        roadsLayer.addTo(map);
        riversLayer.addTo(map);
        restaurantLayer.addTo(map);
        districtsLayer.addTo(map);
        disastersLayer.addTo(map);

        // Create layer control data structure (simpler, faster)
        const layerControls = {
            trains: trainLayer,
            highways: highwayLayer,
            roads: roadsLayer,
            rivers: riversLayer,
            restaurants: restaurantLayer,
            districts: districtsLayer,
            disasters: disastersLayer
        };

        // Initialize simplified layer control
        initQuickControl(layerControls);

    } catch (error) {
        console.error('Error loading layers:', error);
    }
}

// Simplified, faster layer control with card design and SVG icons
function initQuickControl(layerControls) {
    const layerControl = document.getElementById('layer-control');
    const closeBtn = document.getElementById('close-layers');
    const openBtn = document.getElementById('open-layers');
    const layerList = document.querySelector('.layer-list');

    if (!layerList) return; // Exit if HTML structure doesn't exist

    // Clear existing items
    layerList.innerHTML = '';

    // Layer configuration with SVG icons and descriptions
    const layerNames = {
        trains: { 
            name: 'Train Routes', 
            desc: 'Railways and Stations', 
            color: '#ef4444',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="10" rx="2"></rect><path d="M7 15v2M17 15v2M7 19h10M3 19h18"></path></svg>'
        },
        highways: { 
            name: 'Highways', 
            desc: 'Roads and highways', 
            color: '#e74c3c',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9v12M18 9v12M6 9h12V3H6v6zm3 6h6M9 15h6"></path></svg>'
        },
        roads: { 
            name: 'Roads', 
            desc: 'Digitized road network', 
            color: '#8B4513',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="10" y1="6" x2="14" y2="6"></line><line x1="10" y1="10" x2="14" y2="10"></line><line x1="10" y1="14" x2="14" y2="14"></line><line x1="10" y1="18" x2="14" y2="18"></line></svg>'
        },
        rivers: { 
            name: 'Rivers', 
            desc: 'Rivers and waterways', 
            color: '#3498db',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c0-2 1-4 2-5 1 2 2 4 4 5-1 1-2 3-1 5 1-1 3-1 4-2-1 2 0 4 1 5-2-1-3-3-4-5 0 2-1 4-2 5-1-2-2-4-2-5-1 0-1 2-2 3M22 12c0-2-1-4-2-5-1 2-2 4-4 5 1 1 2 3 1 5-1-1-3-1-4-2 1 2 0 4-1 5 2-1 3-3 4-5 0 2 1 4 2 5 1-2 2-4 2-5 1 0 1 2 2 3"></path></svg>'
        },
        restaurants: { 
            name: 'Restaurants', 
            desc: 'Dining locations', 
            color: '#10b981',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M18 8h-1V6c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-5 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM8 6h8v2H8V6z"></path></svg>'
        },
        districts: { 
            name: 'Districts', 
            desc: 'District boundaries', 
            color: '#a855f7',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>'
        },
        disasters: { 
            name: 'Disasters', 
            desc: 'Disaster incidents', 
            color: '#dc2626',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>'
        }
    };

    Object.keys(layerControls).forEach(key => {
        const layer = layerControls[key];
        const { name, desc, color, svg } = layerNames[key];
        
        const div = document.createElement('div');
        div.className = 'layer-item active';
        div.innerHTML = `
            <div class="layer-info">
                <div class="layer-icon" style="background-color: ${color};">
                    ${svg}
                </div>
                <div class="layer-text">
                    <h4>${name}</h4>
                    <p>${desc}</p>
                </div>
            </div>
            <svg class="layer-status-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;

        div.addEventListener('click', () => {
            const isActive = map.hasLayer(layer);
            const statusIcon = div.querySelector('.layer-status-icon');
            
            if (isActive) {
                map.removeLayer(layer);
                div.classList.remove('active');
                statusIcon.innerHTML = '<line x1="1" y1="1" x2="23" y2="23"></line><path d="M10.584 10.587a2 2 0 0 0 2.828 2.83m-3.414-3.415a2 2 0 1 1 2.828 2.829m-2.828-2.829L2 2m11 11l7 7"></path>';
            } else {
                map.addLayer(layer);
                div.classList.add('active');
                statusIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        });

        layerList.appendChild(div);
    });

    // Layer control toggle buttons
    if (closeBtn) closeBtn.addEventListener('click', () => {
        layerControl.style.display = 'none';
        if (openBtn) openBtn.style.display = 'flex';
    });

    if (openBtn) openBtn.addEventListener('click', () => {
        layerControl.style.display = 'block';
        openBtn.style.display = 'none';
    });
}

// Load the layers
loadLayers();
