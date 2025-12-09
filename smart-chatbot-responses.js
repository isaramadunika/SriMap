/**
 * Smart Chatbot Response Generator
 * Generates answers based on location data WITHOUT using Gemini API
 * Handles: Disasters, Railways, Restaurants, Highways, Rivers
 */

class SmartChatbot {
    constructor(geoLoader) {
        this.geoLoader = geoLoader;
        this.cache = {};
    }

    /**
     * Analyze user question and generate appropriate response
     */
    async generateAnswer(question, userLat, userLon) {
        const lowerQ = question.toLowerCase();
        
        console.log('[SmartChatbot] Processing question:', question);
        console.log('[SmartChatbot] User location:', userLat, userLon);

        // Route to appropriate response generator
        if (this.isDisasterQuestion(lowerQ)) {
            return await this.handleDisasterQuestion(question, userLat, userLon);
        } else if (this.isRailwayQuestion(lowerQ)) {
            return await this.handleRailwayQuestion(question, userLat, userLon);
        } else if (this.isRestaurantQuestion(lowerQ)) {
            return await this.handleRestaurantQuestion(question, userLat, userLon);
        } else if (this.isHighwayQuestion(lowerQ)) {
            return await this.handleHighwayQuestion(question, userLat, userLon);
        } else if (this.isRiverQuestion(lowerQ)) {
            return await this.handleRiverQuestion(question, userLat, userLon);
        } else {
            return await this.handleGeneralQuestion(question, userLat, userLon);
        }
    }

    // ===== QUESTION TYPE DETECTION =====

    isDisasterQuestion(q) {
        const keywords = ['disaster', 'earthquake', 'flood', 'landslide', 'danger', 'risk', 'hazard', 'natural', 'near', 'nearby', 'close', 'what'];
        return keywords.some(k => q.includes(k));
    }

    isRailwayQuestion(q) {
        const keywords = ['train', 'railway', 'station', 'rail', 'transport', 'track'];
        return keywords.some(k => q.includes(k));
    }

    isRestaurantQuestion(q) {
        const keywords = ['restaurant', 'food', 'eat', 'dining', 'cafe', 'hotel', 'place', 'where'];
        return keywords.some(k => q.includes(k));
    }

    isHighwayQuestion(q) {
        const keywords = ['highway', 'road', 'route', 'drive', 'path', 'street', 'network'];
        return keywords.some(k => q.includes(k));
    }

    isRiverQuestion(q) {
        const keywords = ['river', 'water', 'stream', 'waterway', 'flow', 'oya'];
        return keywords.some(k => q.includes(k));
    }

    // ===== DISASTER RESPONSES =====

    async handleDisasterQuestion(question, userLat, userLon) {
        try {
            console.log('[SmartChatbot] Loading disaster data...');
            const nearby = await this.geoLoader.findNearby(userLat, userLon, 50, 'disasters');
            
            if (nearby.length === 0) {
                return `Good news! No major disasters recorded within 50 km of your location (${userLat.toFixed(4)}, ${userLon.toFixed(4)}).`;
            }

            // Build response
            let response = `🚨 **Disaster Information Near You**\n\n`;
            response += `Found ${nearby.length} disaster areas within 50 km radius:\n\n`;

            // Group by type
            const byType = {};
            nearby.forEach(d => {
                const type = d.properties?.natural || d.properties?.water || 'Unknown';
                if (!byType[type]) byType[type] = [];
                byType[type].push(d);
            });

            // List each type
            Object.entries(byType).forEach(([type, disasters]) => {
                response += `**${this.capitalizeFirst(type)} (${disasters.length})**\n`;
                disasters.slice(0, 3).forEach(d => {
                    const location = d.properties?.is_in || 'Unknown location';
                    response += `  • ${location} (${d.distance?.toFixed(1) || '?'} km away)\n`;
                });
                if (disasters.length > 3) {
                    response += `  • ...and ${disasters.length - 3} more\n`;
                }
                response += '\n';
            });

            response += `⚠️ **Safety Note:** Stay informed about local warnings and follow government advisories.`;
            return response;
        } catch (error) {
            console.error('[SmartChatbot] Disaster error:', error);
            return `I couldn't fetch disaster information right now. Please try again later.`;
        }
    }

    // ===== RAILWAY RESPONSES =====

    async handleRailwayQuestion(question, userLat, userLon) {
        try {
            console.log('[SmartChatbot] Loading railway data...');
            const railways = await this.geoLoader.load('ralway_All.geojson');
            
            if (!railways || railways.features.length === 0) {
                return `Sorry, I couldn't find railway information at the moment.`;
            }

            const stations = railways.features.filter(f => f.properties?.type === 'Station');
            const routes = railways.features.filter(f => f.properties?.type !== 'Station');

            let response = `🚂 **Railway Information in Sri Lanka**\n\n`;
            
            response += `**Total Railway Features:**\n`;
            response += `  • Stations: ${stations.length}\n`;
            response += `  • Routes/Lines: ${routes.length}\n\n`;

            // Get nearby stations
            const nearby = [];
            stations.forEach(station => {
                const centroid = this.geoLoader.getGeometryCentroid(station.geometry);
                if (centroid) {
                    const dist = this.geoLoader.calculateDistance(
                        userLat, userLon, centroid.lat, centroid.lon
                    );
                    if (dist < 50) {
                        nearby.push({ ...station, distance: dist });
                    }
                }
            });

            if (nearby.length > 0) {
                nearby.sort((a, b) => a.distance - b.distance);
                response += `**Nearby Stations (within 50 km):**\n`;
                nearby.slice(0, 5).forEach(station => {
                    const name = station.properties?.name || 'Unnamed Station';
                    response += `  • ${name} (${station.distance?.toFixed(1) || '?'} km away)\n`;
                });
            } else {
                response += `No railway stations found within 50 km of your location.\n`;
            }

            response += `\n📍 Check the map for complete railway network visualization.`;
            return response;
        } catch (error) {
            console.error('[SmartChatbot] Railway error:', error);
            return `I couldn't fetch railway information right now. Please try again later.`;
        }
    }

    // ===== RESTAURANT RESPONSES =====

    async handleRestaurantQuestion(question, userLat, userLon) {
        try {
            console.log('[SmartChatbot] Loading restaurant data...');
            const restaurants = await this.geoLoader.load('restaurants_all.geojson');
            
            if (!restaurants || restaurants.features.length === 0) {
                return `Sorry, I couldn't find restaurant information at the moment.`;
            }

            // Find nearby restaurants
            const nearby = [];
            restaurants.features.forEach(restaurant => {
                if (restaurant.geometry?.coordinates) {
                    const [lon, lat] = restaurant.geometry.coordinates;
                    const dist = this.geoLoader.calculateDistance(userLat, userLon, lat, lon);
                    if (dist < 50) {
                        nearby.push({ ...restaurant, distance: dist });
                    }
                }
            });

            if (nearby.length === 0) {
                return `📍 There are ${restaurants.features.length} restaurants in our database, but none within 50 km of your location. Try moving to a different area or expanding your search range.`;
            }

            nearby.sort((a, b) => a.distance - b.distance);

            let response = `🍽️ **Restaurants Near You**\n\n`;
            response += `Found ${nearby.length} restaurants within 50 km:\n\n`;

            nearby.slice(0, 10).forEach((restaurant, index) => {
                const name = restaurant.properties?.name || 'Unnamed Restaurant';
                const amenity = restaurant.properties?.amenity || 'Restaurant';
                response += `${index + 1}. **${name}** (${restaurant.distance?.toFixed(1) || '?'} km)\n`;
                if (restaurant.properties?.cuisine) {
                    response += `   Cuisine: ${restaurant.properties.cuisine}\n`;
                }
            });

            if (nearby.length > 10) {
                response += `\n...and ${nearby.length - 10} more restaurants in your area.`;
            }

            response += `\n\n💡 Total restaurants in database: ${restaurants.features.length}`;
            return response;
        } catch (error) {
            console.error('[SmartChatbot] Restaurant error:', error);
            return `I couldn't fetch restaurant information right now. Please try again later.`;
        }
    }

    // ===== HIGHWAY RESPONSES =====

    async handleHighwayQuestion(question, userLat, userLon) {
        try {
            console.log('[SmartChatbot] Loading highway data...');
            const highways = await this.geoLoader.load('HW_all.geojson');
            
            if (!highways || highways.features.length === 0) {
                return `Sorry, I couldn't find highway information at the moment.`;
            }

            // Analyze highway types
            const types = {};
            highways.features.forEach(hw => {
                const type = hw.properties?.highway || 'Unknown';
                if (!types[type]) types[type] = 0;
                types[type]++;
            });

            let response = `🛣️ **Highway & Road Network**\n\n`;
            response += `**Total Roads:** ${highways.features.length}\n\n`;
            
            response += `**Road Types:**\n`;
            Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([type, count]) => {
                response += `  • ${this.capitalizeFirst(type)}: ${count} roads\n`;
            });

            // Find nearby highways
            const nearby = [];
            highways.features.forEach(hw => {
                if (hw.geometry?.coordinates) {
                    const coords = Array.isArray(hw.geometry.coordinates[0]) 
                        ? hw.geometry.coordinates[0] 
                        : hw.geometry.coordinates;
                    const [lon, lat] = coords;
                    const dist = this.geoLoader.calculateDistance(userLat, userLon, lat, lon);
                    if (dist < 30) {
                        nearby.push({ ...hw, distance: dist });
                    }
                }
            });

            if (nearby.length > 0) {
                response += `\n**Roads Near You (within 30 km):**\n`;
                nearby.slice(0, 3).forEach(hw => {
                    const type = hw.properties?.highway || 'Road';
                    response += `  • ${this.capitalizeFirst(type)} (${hw.distance?.toFixed(1) || '?'} km)\n`;
                });
            }

            response += `\n🗺️ View the map for complete road network visualization.`;
            return response;
        } catch (error) {
            console.error('[SmartChatbot] Highway error:', error);
            return `I couldn't fetch highway information right now. Please try again later.`;
        }
    }

    // ===== RIVER RESPONSES =====

    async handleRiverQuestion(question, userLat, userLon) {
        try {
            console.log('[SmartChatbot] Loading river data...');
            const rivers = await this.geoLoader.load('Oya_all.geojson');
            
            if (!rivers || rivers.features.length === 0) {
                return `Sorry, I couldn't find river information at the moment.`;
            }

            let response = `💧 **Rivers & Waterways**\n\n`;
            response += `**Total Waterways:** ${rivers.features.length}\n\n`;

            // Get named rivers
            const named = rivers.features.filter(r => r.properties?.name);
            if (named.length > 0) {
                response += `**Major Rivers:**\n`;
                named.slice(0, 10).forEach(river => {
                    const name = river.properties?.name || 'Unnamed River';
                    const type = river.properties?.water || 'Waterway';
                    response += `  • ${name} (${type})\n`;
                });
            }

            // Find nearby waterways
            const nearby = [];
            rivers.features.forEach(river => {
                if (river.geometry?.coordinates) {
                    const coords = Array.isArray(river.geometry.coordinates[0]) 
                        ? river.geometry.coordinates[0] 
                        : river.geometry.coordinates;
                    const [lon, lat] = coords;
                    const dist = this.geoLoader.calculateDistance(userLat, userLon, lat, lon);
                    if (dist < 50) {
                        nearby.push({ ...river, distance: dist });
                    }
                }
            });

            if (nearby.length > 0) {
                response += `\n**Waterways Near You (within 50 km):**\n`;
                response += `  • ${nearby.length} waterways found\n`;
            } else {
                response += `\nNo major waterways within 50 km of your current location.`;
            }

            response += `\n\n🌊 Rivers are essential for agriculture, hydropower, and drinking water in Sri Lanka.`;
            return response;
        } catch (error) {
            console.error('[SmartChatbot] River error:', error);
            return `I couldn't fetch river information right now. Please try again later.`;
        }
    }

    // ===== GENERAL RESPONSES =====

    async handleGeneralQuestion(question, userLat, userLon) {
        let response = `I can help you with information about:\n\n`;
        response += `🚨 **Disasters** - Earthquakes, floods, landslides near you\n`;
        response += `🚂 **Railways** - Train stations and routes\n`;
        response += `🍽️ **Restaurants** - Dining options and eateries\n`;
        response += `🛣️ **Highways** - Road networks and routes\n`;
        response += `💧 **Rivers** - Waterways and streams\n\n`;
        response += `Try asking:\n`;
        response += `  • "What nearby disasters?"\n`;
        response += `  • "Show restaurants near me"\n`;
        response += `  • "Where are train stations?"\n`;
        response += `  • "What roads are near me?"\n`;
        response += `  • "Tell me about rivers"\n`;
        
        return response;
    }

    // ===== UTILITY FUNCTIONS =====

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Alternative response if no specific match
    async handleFallback(question) {
        return `I'm not sure how to answer that. I can help with disasters, railways, restaurants, highways, and rivers in Sri Lanka. What would you like to know?`;
    }
}

// Export for use in chatbot.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartChatbot;
}
