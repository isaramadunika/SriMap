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
        const [trainData, restaurantData, roadsData, riversData, disastersData, highwayData] = await Promise.all([
            fetchTrainRoutesFromOSM(),
            fetch('/data/restaurants_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/roads.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/Oya_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
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

        // Create Districts Layer (commented out - file not available yet)
        // const districtsLayer = L.geoJSON(districtsData, {
        //     style: {
        //         color: '#a855f7',
        //         weight: 1.5,
        //         opacity: 0.7,
        //         fillOpacity: 0.08
        //     },
        //     filter: (feature) => feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'),
        //     onEachFeature: (feature, layer) => {
        //         if (feature.properties && feature.properties.name) {
        //             layer.bindPopup(`<strong>${feature.properties.name}</strong>`, { maxHeight: 200 });
        //         }
        //     }
        // });

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

        // Add layers to map initially
        trainLayer.addTo(map);
        highwayLayer.addTo(map);
        roadsLayer.addTo(map);
        riversLayer.addTo(map);
        restaurantLayer.addTo(map);
        // districtsLayer.addTo(map); // Commented - file missing
        disastersLayer.addTo(map);

        // Define layers for custom control
        const layers = [
            {
                id: 'trains',
                name: 'Train Routes',
                description: 'Railways and Stations',
                layer: trainLayer,
                iconColor: '#ef4444',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
            },
            {
                id: 'highways',
                name: 'Highways',
                description: 'Roads and highways',
                layer: highwayLayer,
                iconColor: '#e74c3c',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6-6 6 6M6 9h12M6 9v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/></svg>'
            },
            {
                id: 'roads',
                name: 'Roads',
                description: 'Digitized road network',
                layer: roadsLayer,
                iconColor: '#8B4513',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>'
            },
            {
                id: 'rivers',
                name: 'Rivers',
                description: 'Rivers and waterways',
                layer: riversLayer,
                iconColor: '#3498db',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2V4c0-1-1-2-2-2zM12 10c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2v-2c0-1-1-2-2-2zM12 18c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2v-2c0-1-1-2-2-2z"/></svg>'
            },
            {
                id: 'restaurants',
                name: 'Restaurants',
                description: 'Dining locations',
                layer: restaurantLayer,
                iconColor: '#10b981',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>'
            },
            {
                id: 'disasters',
                name: 'Disasters',
                description: 'Disaster incidents',
                layer: disastersLayer,
                iconColor: '#dc2626',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
            }
        ];

        initCustomControl(layers);

    } catch (error) {
        console.error('Error loading layers:', error);
    }
}

function initCustomControl(layers) {
    const layerList = document.querySelector('.layer-list');
    const layerControl = document.getElementById('layer-control');
    const closeBtn = document.getElementById('close-layers');
    const openBtn = document.getElementById('open-layers');

    // Generate layer items
    layers.forEach(item => {
        const div = document.createElement('div');
        div.className = 'layer-item active';
        div.innerHTML = `
            <div class="layer-info">
                <div class="layer-icon" style="background-color: ${item.iconColor}">
                    ${item.icon}
                </div>
                <div class="layer-text">
                    <h4>${item.name}</h4>
                    <p>${item.description}</p>
                </div>
            </div>
            <div class="layer-status">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </div>
        `;

        div.addEventListener('click', () => {
            const isActive = map.hasLayer(item.layer);

            if (isActive) {
                map.removeLayer(item.layer);
                div.classList.remove('active');
                div.querySelector('.layer-status').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            } else {
                map.addLayer(item.layer);
                div.classList.add('active');
                div.querySelector('.layer-status').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            }
        });

        layerList.appendChild(div);
    });

    // Toggle control visibility
    closeBtn.addEventListener('click', () => {
        layerControl.classList.add('hidden');
        openBtn.style.display = 'flex';
    });

    openBtn.addEventListener('click', () => {
        layerControl.classList.remove('hidden');
        openBtn.style.display = 'none';
    });
}

// Load the layers
loadLayers();
