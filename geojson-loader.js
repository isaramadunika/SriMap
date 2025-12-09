/**
 * GeoJSON Data Loader for SriMap Chatbot
 * Dynamically loads and queries GeoJSON files from the public/data folder
 */

class GeoJSONLoader {
    constructor() {
        this.cache = {};
        this.dataPath = '/data/';
    }

    /**
     * Load a GeoJSON file from the data folder
     * @param {string} filename - Name of the GeoJSON file (e.g., 'Disaster_all.geojson')
     * @returns {Promise<Object>} The parsed GeoJSON object
     */
    async load(filename) {
        // Check cache first
        if (this.cache[filename]) {
            console.log(`[GeoJSONLoader] Using cached data for ${filename}`);
            return this.cache[filename];
        }

        try {
            console.log(`[GeoJSONLoader] Loading ${filename}...`);
            const response = await fetch(this.dataPath + filename);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the data
            this.cache[filename] = data;
            console.log(`[GeoJSONLoader] Loaded ${filename}: ${data.features?.length || 0} features`);
            
            return data;
        } catch (error) {
            console.error(`[GeoJSONLoader] Error loading ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Load all available GeoJSON files
     * @returns {Promise<Object>} Object with all loaded data
     */
    async loadAll() {
        const files = [
            'Disaster_all.geojson',
            'restaurants_all.geojson',
            'ralway_All.geojson',
            'HW_all.geojson',
            'Oya_all.geojson'
        ];

        const results = {};
        
        for (const file of files) {
            try {
                results[file] = await this.load(file);
            } catch (error) {
                console.error(`[GeoJSONLoader] Failed to load ${file}`);
                results[file] = { error: error.message };
            }
        }

        return results;
    }

    /**
     * Search for disasters in a specific location
     * @param {string} location - Location name to search
     * @returns {Promise<Array>} Array of matching disasters
     */
    async findDisastersByLocation(location) {
        const data = await this.load('Disaster_all.geojson');
        const results = [];

        data.features?.forEach(feature => {
            if (feature.properties?.is_in?.toLowerCase().includes(location.toLowerCase())) {
                results.push({
                    name: feature.properties?.name,
                    type: feature.properties?.natural || feature.properties?.water,
                    location: feature.properties?.is_in,
                    geometry: feature.geometry
                });
            }
        });

        return results;
    }

    /**
     * Find nearby features (within radius in km)
     * @param {number} lat - User latitude
     * @param {number} lon - User longitude
     * @param {number} radiusKm - Search radius in kilometers
     * @param {string} type - Type of features to search ('disasters', 'restaurants', 'trains', 'highways', 'rivers')
     * @returns {Promise<Array>} Array of nearby features sorted by distance
     */
    async findNearby(lat, lon, radiusKm = 50, type = 'disasters') {
        const fileMap = {
            disasters: 'Disaster_all.geojson',
            restaurants: 'restaurants_all.geojson',
            trains: 'ralway_All.geojson',
            highways: 'HW_all.geojson',
            rivers: 'Oya_all.geojson'
        };

        const filename = fileMap[type];
        if (!filename) {
            throw new Error(`Unknown type: ${type}`);
        }

        const data = await this.load(filename);
        const nearby = [];

        data.features?.forEach(feature => {
            const centroid = this.getGeometryCentroid(feature.geometry);
            if (centroid) {
                const distance = this.calculateDistance(lat, lon, centroid.lat, centroid.lon);
                if (distance <= radiusKm) {
                    nearby.push({
                        name: feature.properties?.name || 'Unnamed',
                        type: feature.properties?.natural || feature.properties?.water || feature.properties?.type || 'Unknown',
                        location: feature.properties?.is_in || 'Unknown',
                        distance_km: parseFloat(distance.toFixed(2)),
                        properties: feature.properties,
                        geometry: feature.geometry
                    });
                }
            }
        });

        // Sort by distance
        return nearby.sort((a, b) => a.distance_km - b.distance_km);
    }

    /**
     * Get summary statistics about a dataset
     * @param {string} filename - Name of the GeoJSON file
     * @returns {Promise<Object>} Statistics about the dataset
     */
    async getStats(filename) {
        const data = await this.load(filename);
        const features = data.features || [];

        const stats = {
            filename,
            total_features: features.length,
            geometry_types: this.getGeometryTypes(features),
            properties: this.getPropertySummary(features),
            sample: features.slice(0, 3)
        };

        return stats;
    }

    /**
     * Get all unique geometry types in the dataset
     */
    getGeometryTypes(features) {
        const types = new Set();
        features.forEach(f => {
            if (f.geometry?.type) {
                types.add(f.geometry.type);
            }
        });
        return Array.from(types);
    }

    /**
     * Get summary of all properties in the dataset
     */
    getPropertySummary(features) {
        const properties = {};
        
        features.forEach(feature => {
            Object.keys(feature.properties || {}).forEach(key => {
                if (!properties[key]) {
                    properties[key] = {
                        name: key,
                        sample_value: feature.properties[key],
                        count: 0
                    };
                }
                properties[key].count++;
            });
        });

        return properties;
    }

    /**
     * Search all datasets for a keyword
     * @param {string} keyword - Search keyword
     * @returns {Promise<Object>} Results from all datasets
     */
    async searchAll(keyword) {
        const files = ['Disaster_all.geojson', 'restaurants_all.geojson', 'ralway_All.geojson', 'HW_all.geojson', 'Oya_all.geojson'];
        const results = {};
        const lowercaseKeyword = keyword.toLowerCase();

        for (const file of files) {
            try {
                const data = await this.load(file);
                const matches = [];

                data.features?.forEach(feature => {
                    // Search in all property values
                    Object.values(feature.properties || {}).forEach(value => {
                        if (value && String(value).toLowerCase().includes(lowercaseKeyword)) {
                            matches.push({
                                name: feature.properties?.name,
                                location: feature.properties?.is_in,
                                match: value
                            });
                        }
                    });
                });

                if (matches.length > 0) {
                    results[file] = {
                        matches: matches.slice(0, 5),
                        total: matches.length
                    };
                }
            } catch (error) {
                console.error(`Error searching ${file}:`, error);
            }
        }

        return results;
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
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
     * Get centroid of a geometry
     */
    getGeometryCentroid(geometry) {
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

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache = {};
        console.log('[GeoJSONLoader] Cache cleared');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoJSONLoader;
}
