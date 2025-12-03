import L from 'leaflet';
import './style.css';

// Initialize the map
const map = L.map('map').setView([9.77, 80.03], 12);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Request user location
if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 13);
        L.marker([latitude, longitude]).addTo(map)
            .bindPopup('You are here')
            .openPopup();
    });
}

// Create Train Layer
function createTrainLayer(data) {
    return L.geoJSON(data, {
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
}

// Create Highway Layer
function createHighwayLayer(data) {
    return L.geoJSON(data, {
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
}

// Create Rivers Layer
function createRiversLayer(data) {
    return L.geoJSON(data, {
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
}

// Create Restaurant Layer
function createRestaurantLayer(data) {
    return L.geoJSON(data, {
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
}

// Create Disasters Layer
function createDisastersLayer(data) {
    return L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
            let color = '#eab308';
            const props = feature.properties;
            const isIn = props.is_in?.toLowerCase() || '';
            const lat = latlng.lat;
            const lng = latlng.lng;

            if (isIn.includes('nuwara') || isIn.includes('kandy') || isIn.includes('matara') || 
                (lat >= 6.7 && lat <= 7.1 && lng >= 80.6 && lng <= 81.1)) {
                color = '#dc2626';
            } else if (isIn.includes('colombo') || isIn.includes('gampaha') || isIn.includes('kalutara') ||
                     (lat >= 6.5 && lat <= 7.3 && lng >= 79.7 && lng <= 80.1)) {
                color = '#10b981';
            } else if (isIn.includes('ratnapura') || isIn.includes('kegalle') || isIn.includes('sabaragamuwa') ||
                     (lat >= 6.4 && lat <= 6.8 && lng >= 80.2 && lng <= 80.6)) {
                color = '#fbbf24';
            } else if (isIn.includes('jaffna') || (lat >= 9.5 && lat <= 9.9 && lng >= 79.8 && lng <= 80.2)) {
                color = '#f97316';
            } else if (isIn.includes('batticaloa') || isIn.includes('trincomalee') || isIn.includes('ampara') ||
                     (lat >= 7.8 && lat <= 8.8 && lng >= 81.1 && lng <= 81.5)) {
                color = '#06b6d4';
            } else if (isIn.includes('galle') || isIn.includes('matara') || isIn.includes('southern') ||
                     (lat >= 5.8 && lat <= 6.3 && lng >= 80.0 && lng <= 80.5)) {
                color = '#a855f7';
            }

            const icon = L.divIcon({
                className: 'disaster-marker',
                html: `<div class="disaster-marker-container"><div class="disaster-pulse" style="background-color: ${color}; box-shadow: 0 0 0 0 ${color}80;"></div><div class="disaster-icon" style="background-color: ${color};"></div></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            return L.marker(latlng, { icon });
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                const props = feature.properties;
                const popup = `<strong>${props.name}</strong><br>Location: ${props.is_in || 'Sri Lanka'}`;
                layer.bindPopup(popup);
            }
        }
    });
}

// Store layer references globally
let restaurantLayer = null;
let disastersLayer = null;

// Optimized data loading - load essential layers first
async function loadLayers() {
    try {
        // Load essential layers in parallel (Train, Highway, Rivers)
        const [trainData, highwayData, riversData] = await Promise.all([
            fetch('/data/ralway_All.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/HW_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/Oya_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] }))
        ]);

        // Create and add essential layers immediately
        const trainLayer = createTrainLayer(trainData);
        const highwayLayer = createHighwayLayer(highwayData);
        const riversLayer = createRiversLayer(riversData);
        
        trainLayer.addTo(map);
        highwayLayer.addTo(map);
        riversLayer.addTo(map);

        // Define layers for control panel
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
                id: 'rivers',
                name: 'Rivers',
                description: 'Rivers and waterways',
                layer: riversLayer,
                iconColor: '#3498db',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2V4c0-1-1-2-2-2zM12 10c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2v-2c0-1-1-2-2-2zM12 18c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2v-2c0-1-1-2-2-2z"/></svg>'
            }
        ];

        initCustomControl(layers);

        // Load secondary layers asynchronously
        Promise.all([
            fetch('/data/restaurants_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
            fetch('/data/Disaster_all.geojson').then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] }))
        ]).then(([restaurantData, disastersData]) => {
            restaurantLayer = createRestaurantLayer(restaurantData);
            disastersLayer = createDisastersLayer(disastersData);
            
            restaurantLayer.addTo(map);
            disastersLayer.addTo(map);

            // Add to layer control
            const layerList = document.querySelector('.layer-list');
            
            [
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
            ].forEach(item => createLayerItem(item, layerList));
        });

    } catch (error) {
        console.error('Error loading layers:', error);
    }
}

function createLayerItem(item, container) {
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

    container.appendChild(div);
}

function initCustomControl(layers) {
    const layerList = document.querySelector('.layer-list');
    const layerControl = document.getElementById('layer-control');
    const closeBtn = document.getElementById('close-layers');
    const openBtn = document.getElementById('open-layers');

    layers.forEach(item => createLayerItem(item, layerList));

    closeBtn.addEventListener('click', () => {
        layerControl.classList.add('hidden');
        openBtn.style.display = 'flex';
    });

    openBtn.addEventListener('click', () => {
        layerControl.classList.remove('hidden');
        openBtn.style.display = 'none';
    });
}

// Start loading layers
loadLayers();
