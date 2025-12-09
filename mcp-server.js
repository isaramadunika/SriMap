#!/usr/bin/env node

/**
 * SriMap GeoJSON MCP Server
 * Provides tools to load and query GeoJSON data files for the chatbot
 */

const fs = require('fs');
const path = require('path');

// MCP Server setup
const mcp = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');
const { CallToolRequestSchema, TextContent } = require('@modelcontextprotocol/sdk/types');

const server = new mcp.Server({
    name: 'srimap-geojson',
    version: '1.0.0',
});

// Data folder path
const DATA_FOLDER = path.join(__dirname, 'data');

// Cache for loaded GeoJSON data
const geoJsonCache = {};

/**
 * Load a GeoJSON file and return its contents
 */
function loadGeoJsonFile(filename) {
    if (geoJsonCache[filename]) {
        return geoJsonCache[filename];
    }

    const filePath = path.join(DATA_FOLDER, filename);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filename}`);
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const geojson = JSON.parse(content);
        
        // Cache the data
        geoJsonCache[filename] = geojson;
        
        return geojson;
    } catch (error) {
        throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
}

/**
 * Get disaster data with location information
 */
function getDisasterData() {
    const data = loadGeoJsonFile('Disaster_all.geojson');
    return {
        type: 'disasters',
        filename: 'Disaster_all.geojson',
        feature_count: data.features?.length || 0,
        features: data.features || [],
        summary: {
            total_features: data.features?.length || 0,
            types: getFeatureTypes(data.features, ['natural', 'water']),
            locations: getFeatureLocations(data.features)
        }
    };
}

/**
 * Get restaurants data
 */
function getRestaurantData() {
    const data = loadGeoJsonFile('restaurants_all.geojson');
    return {
        type: 'restaurants',
        filename: 'restaurants_all.geojson',
        feature_count: data.features?.length || 0,
        features: data.features || [],
        summary: {
            total_features: data.features?.length || 0,
            locations: getFeatureLocations(data.features)
        }
    };
}

/**
 * Get train routes and stations data
 */
function getTrainData() {
    const data = loadGeoJsonFile('ralway_All.geojson');
    return {
        type: 'trains',
        filename: 'ralway_All.geojson',
        feature_count: data.features?.length || 0,
        features: data.features || [],
        summary: {
            total_features: data.features?.length || 0,
            types: getFeatureTypes(data.features, ['type']),
            stations: data.features?.filter(f => f.properties?.type === 'Station').length || 0
        }
    };
}

/**
 * Get highways data
 */
function getHighwayData() {
    const data = loadGeoJsonFile('HW_all.geojson');
    return {
        type: 'highways',
        filename: 'HW_all.geojson',
        feature_count: data.features?.length || 0,
        features: data.features || [],
        summary: {
            total_features: data.features?.length || 0,
            types: getFeatureTypes(data.features, ['highway'])
        }
    };
}

/**
 * Get rivers and waterways data
 */
function getRiverData() {
    const data = loadGeoJsonFile('Oya_all.geojson');
    return {
        type: 'rivers',
        filename: 'Oya_all.geojson',
        feature_count: data.features?.length || 0,
        features: data.features || [],
        summary: {
            total_features: data.features?.length || 0,
            types: getFeatureTypes(data.features, ['waterway', 'natural'])
        }
    };
}

/**
 * Extract unique types from features
 */
function getFeatureTypes(features, propertyNames) {
    const types = new Set();
    features?.forEach(feature => {
        propertyNames.forEach(prop => {
            if (feature.properties?.[prop]) {
                types.add(feature.properties[prop]);
            }
        });
    });
    return Array.from(types);
}

/**
 * Extract unique locations from features
 */
function getFeatureLocations(features) {
    const locations = new Set();
    features?.forEach(feature => {
        if (feature.properties?.is_in) {
            locations.add(feature.properties.is_in);
        }
    });
    return Array.from(locations).slice(0, 10); // Return first 10
}

/**
 * Query features by property
 */
function queryFeatures(filename, propertyName, propertyValue) {
    const data = loadGeoJsonFile(filename);
    const results = data.features?.filter(f => 
        f.properties?.[propertyName] === propertyValue
    ) || [];
    
    return {
        filename,
        query: `${propertyName} = ${propertyValue}`,
        matches: results.length,
        features: results.slice(0, 20) // Limit to 20 results
    };
}

/**
 * Search features by location
 */
function searchByLocation(filename, locationKeyword) {
    const data = loadGeoJsonFile(filename);
    const results = data.features?.filter(f => 
        f.properties?.is_in?.toLowerCase().includes(locationKeyword.toLowerCase())
    ) || [];
    
    return {
        filename,
        search: `location contains "${locationKeyword}"`,
        matches: results.length,
        features: results.slice(0, 20)
    };
}

// Define tools
const tools = [
    {
        name: 'load_disasters',
        description: 'Load disaster data (floods, earthquakes, landslides, etc.) from Disaster_all.geojson',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'load_restaurants',
        description: 'Load restaurant locations from restaurants_all.geojson',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'load_trains',
        description: 'Load train routes and stations from ralway_All.geojson',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'load_highways',
        description: 'Load highway/road network data from HW_all.geojson',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'load_rivers',
        description: 'Load rivers and waterways from Oya_all.geojson',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'query_disasters',
        description: 'Query disaster features by property (e.g., type, location)',
        inputSchema: {
            type: 'object',
            properties: {
                property: { type: 'string', description: 'Property name to query (e.g., "natural", "water", "is_in")' },
                value: { type: 'string', description: 'Value to match' }
            },
            required: ['property', 'value']
        }
    },
    {
        name: 'search_disasters_by_location',
        description: 'Search for disasters in a specific location',
        inputSchema: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'Location name to search (e.g., "Colombo", "Galle")' }
            },
            required: ['location']
        }
    },
    {
        name: 'search_restaurants_by_location',
        description: 'Search for restaurants in a specific location',
        inputSchema: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'Location name to search' }
            },
            required: ['location']
        }
    },
    {
        name: 'get_nearby_disasters',
        description: 'Get disasters near a specific location with distance estimates',
        inputSchema: {
            type: 'object',
            properties: {
                latitude: { type: 'number', description: 'Latitude coordinate' },
                longitude: { type: 'number', description: 'Longitude coordinate' },
                radius_km: { type: 'number', description: 'Search radius in kilometers (default: 50)' }
            },
            required: ['latitude', 'longitude']
        }
    }
];

// Register tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request;

    try {
        let result;

        switch (name) {
            case 'load_disasters':
                result = getDisasterData();
                break;
            case 'load_restaurants':
                result = getRestaurantData();
                break;
            case 'load_trains':
                result = getTrainData();
                break;
            case 'load_highways':
                result = getHighwayData();
                break;
            case 'load_rivers':
                result = getRiverData();
                break;
            case 'query_disasters':
                result = queryFeatures('Disaster_all.geojson', args.property, args.value);
                break;
            case 'search_disasters_by_location':
                result = searchByLocation('Disaster_all.geojson', args.location);
                break;
            case 'search_restaurants_by_location':
                result = searchByLocation('restaurants_all.geojson', args.location);
                break;
            case 'get_nearby_disasters':
                result = getNearbyDisasters(args.latitude, args.longitude, args.radius_km || 50);
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`,
                    isError: true
                }
            ]
        };
    }
});

/**
 * Get nearby disasters using Haversine formula
 */
function getNearbyDisasters(lat, lon, radiusKm = 50) {
    const data = loadGeoJsonFile('Disaster_all.geojson');
    const nearby = [];

    data.features?.forEach(feature => {
        const centroid = getGeometryCentroid(feature.geometry);
        if (centroid) {
            const distance = calculateDistance(lat, lon, centroid.lat, centroid.lon);
            if (distance <= radiusKm) {
                nearby.push({
                    name: feature.properties?.name || 'Unnamed',
                    type: feature.properties?.natural || feature.properties?.water || 'Unknown',
                    location: feature.properties?.is_in || 'Unknown',
                    distance_km: distance.toFixed(2),
                    properties: feature.properties
                });
            }
        }
    });

    return {
        center: { lat, lon },
        radius_km: radiusKm,
        disasters_found: nearby.length,
        nearby: nearby.sort((a, b) => parseFloat(a.distance_km) - parseFloat(b.distance_km))
    };
}

/**
 * Calculate distance using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Get centroid of geometry
 */
function getGeometryCentroid(geometry) {
    if (!geometry) return null;
    
    if (geometry.type === 'Point') {
        return { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
    } else if (geometry.type === 'LineString' || geometry.type === 'Polygon') {
        let coords = geometry.coordinates;
        if (geometry.type === 'Polygon' && Array.isArray(coords[0])) {
            coords = coords[0];
        }
        if (Array.isArray(coords[0])) {
            return { lat: coords[0][1], lon: coords[0][0] };
        }
        return { lat: coords[1], lon: coords[0] };
    }
    return null;
}

// Tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }))
    };
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
console.error('[SriMap MCP] Server started successfully');
