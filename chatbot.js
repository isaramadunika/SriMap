// Chatbot module for map-based AI conversations
const GEMINI_API_KEY = 'AIzaSyDLZhafGRJdlzxIVCxcB_l_SHp43krwO5A';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Rate limiting and debouncing
let lastRequestTime = 0;
let isProcessing = false;
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests
let retryCount = 0;
const MAX_RETRIES = 2;

// User location tracking
let userLocation = null;

let geoJsonData = {
    disasters: [],
    restaurants: [],
    trains: [],
    highways: [],
    rivers: []
};

// GeoJSON Loader class for accessing data dynamically
class GeoJSONLoader {
    constructor() {
        this.cache = {};
        this.dataPath = '/data/';
    }

    async load(filename) {
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
            this.cache[filename] = data;
            console.log(`[GeoJSONLoader] Loaded ${filename}: ${data.features?.length || 0} features`);
            
            return data;
        } catch (error) {
            console.error(`[GeoJSONLoader] Error loading ${filename}:`, error);
            throw error;
        }
    }

    async findNearby(lat, lon, radiusKm = 50, type = 'disasters') {
        const fileMap = {
            disasters: 'Disaster_all.geojson',
            restaurants: 'restaurants_all.geojson',
            trains: 'ralway_All.geojson',
            highways: 'HW_all.geojson',
            rivers: 'Oya_all.geojson'
        };

        const filename = fileMap[type];
        if (!filename) throw new Error(`Unknown type: ${type}`);

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
                        properties: feature.properties
                    });
                }
            }
        });

        return nearby.sort((a, b) => a.distance_km - b.distance_km);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

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

    clearCache() {
        this.cache = {};
        console.log('[GeoJSONLoader] Cache cleared');
    }
}

const geoLoader = new GeoJSONLoader();

// Smart Chatbot for local responses without Gemini API
class SmartChatbot {
    constructor(geoLoader) {
        this.geoLoader = geoLoader;
    }

    async generateAnswer(question, userLat, userLon) {
        const lowerQ = question.toLowerCase();
        
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
            return this.handleGeneralQuestion(question);
        }
    }

    isDisasterQuestion(q) { return ['disaster', 'earthquake', 'flood', 'landslide', 'danger', 'near', 'nearby'].some(k => q.includes(k)); }
    isRailwayQuestion(q) { return ['train', 'railway', 'station', 'rail', 'transport'].some(k => q.includes(k)); }
    isRestaurantQuestion(q) { return ['restaurant', 'food', 'eat', 'dining', 'cafe', 'where'].some(k => q.includes(k)); }
    isHighwayQuestion(q) { return ['highway', 'road', 'route', 'drive', 'path'].some(k => q.includes(k)); }
    isRiverQuestion(q) { return ['river', 'water', 'stream', 'oya'].some(k => q.includes(k)); }

    async handleDisasterQuestion(question, userLat, userLon) {
        try {
            const nearby = await this.geoLoader.findNearby(userLat, userLon, 50, 'disasters');
            if (nearby.length === 0) {
                return `✅ Good news! No major disasters recorded within 50 km of your location.`;
            }
            let response = `🚨 **Disaster Information Near You**\n\nFound ${nearby.length} disaster areas:\n\n`;
            const byType = {};
            nearby.forEach(d => {
                const type = d.properties?.natural || 'Unknown';
                if (!byType[type]) byType[type] = [];
                byType[type].push(d);
            });
            Object.entries(byType).forEach(([type, disasters]) => {
                response += `**${type} (${disasters.length}):**\n`;
                disasters.slice(0, 3).forEach(d => {
                    const location = d.properties?.is_in || 'Unknown';
                    response += `  • ${location} (${d.distance?.toFixed(1) || '?'} km away)\n`;
                });
                if (disasters.length > 3) response += `  • ...and ${disasters.length - 3} more\n`;
            });
            return response;
        } catch (e) { return `I couldn't fetch disaster info right now.`; }
    }

    async handleRailwayQuestion(question, userLat, userLon) {
        try {
            const railways = await this.geoLoader.load('ralway_All.geojson');
            if (!railways) return `No railway data available.`;
            const stations = railways.features.filter(f => f.properties?.type === 'Station');
            let response = `🚂 **Railway Information**\n\nTotal stations: ${stations.length}\n`;
            const nearby = [];
            stations.forEach(s => {
                const centroid = this.geoLoader.getGeometryCentroid(s.geometry);
                if (centroid) {
                    const dist = this.geoLoader.calculateDistance(userLat, userLon, centroid.lat, centroid.lon);
                    if (dist < 50) nearby.push({...s, distance: dist});
                }
            });
            if (nearby.length > 0) {
                response += `\nNearby stations (${nearby.length}):\n`;
                nearby.sort((a,b) => a.distance - b.distance).slice(0, 5).forEach(s => {
                    response += `  • ${s.properties?.name || 'Unnamed'} (${s.distance?.toFixed(1) || '?'} km)\n`;
                });
            } else {
                response += `\nNo stations within 50 km.`;
            }
            return response;
        } catch (e) { return `I couldn't fetch railway info right now.`; }
    }

    async handleRestaurantQuestion(question, userLat, userLon) {
        try {
            const restaurants = await this.geoLoader.load('restaurants_all.geojson');
            if (!restaurants) return `No restaurant data available.`;
            const nearby = [];
            restaurants.features.forEach(r => {
                if (r.geometry?.coordinates) {
                    const [lon, lat] = r.geometry.coordinates;
                    const dist = this.geoLoader.calculateDistance(userLat, userLon, lat, lon);
                    if (dist < 50) nearby.push({...r, distance: dist});
                }
            });
            if (nearby.length === 0) return `📍 No restaurants within 50 km of your location.`;
            nearby.sort((a,b) => a.distance - b.distance);
            let response = `🍽️ **Restaurants Near You**\n\nFound ${nearby.length} restaurants:\n\n`;
            nearby.slice(0, 10).forEach((r, i) => {
                response += `${i+1}. ${r.properties?.name || 'Restaurant'} (${r.distance?.toFixed(1) || '?'} km)\n`;
            });
            if (nearby.length > 10) response += `\n...and ${nearby.length - 10} more.`;
            return response;
        } catch (e) { return `I couldn't fetch restaurant info right now.`; }
    }

    async handleHighwayQuestion(question, userLat, userLon) {
        try {
            const highways = await this.geoLoader.load('HW_all.geojson');
            if (!highways) return `No highway data available.`;
            const types = {};
            highways.features.forEach(h => {
                const type = h.properties?.highway || 'Unknown';
                types[type] = (types[type] || 0) + 1;
            });
            let response = `🛣️ **Road Network**\n\nTotal roads: ${highways.features.length}\n\nRoad types:\n`;
            Object.entries(types).sort((a,b) => b[1] - a[1]).slice(0, 6).forEach(([type, count]) => {
                response += `  • ${type}: ${count}\n`;
            });
            return response;
        } catch (e) { return `I couldn't fetch highway info right now.`; }
    }

    async handleRiverQuestion(question, userLat, userLon) {
        try {
            const rivers = await this.geoLoader.load('Oya_all.geojson');
            if (!rivers) return `No river data available.`;
            const named = rivers.features.filter(r => r.properties?.name);
            let response = `💧 **Rivers & Waterways**\n\nTotal waterways: ${rivers.features.length}\n\n`;
            if (named.length > 0) {
                response += `Major rivers:\n`;
                named.slice(0, 8).forEach(r => {
                    response += `  • ${r.properties?.name}\n`;
                });
            }
            return response;
        } catch (e) { return `I couldn't fetch river info right now.`; }
    }

    handleGeneralQuestion(question) {
        let response = `I can help with:\n\n`;
        response += `🚨 **Disasters** - Near you\n`;
        response += `🚂 **Railways** - Stations & routes\n`;
        response += `🍽️ **Restaurants** - Dining options\n`;
        response += `🛣️ **Highways** - Road networks\n`;
        response += `💧 **Rivers** - Waterways\n\n`;
        response += `Try: "What nearby disasters?" or "Show restaurants near me"`;
        return response;
    }
}

const smartChatbot = new SmartChatbot(geoLoader);
export function initChatbot(disasterData, restaurantData, trainData, highwayData, riverData) {
    geoJsonData.disasters = disasterData.features || [];
    geoJsonData.restaurants = restaurantData.features || [];
    geoJsonData.trains = trainData.features || [];
    geoJsonData.highways = highwayData.features || [];
    geoJsonData.rivers = riverData.features || [];

    setupChatbotUI();
}

function setupChatbotUI() {
    const chatbotPanel = document.getElementById('chatbot-panel');
    const openBtn = document.getElementById('open-chatbot');
    const closeBtn = document.getElementById('toggle-chatbot');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');

    if (!chatbotPanel || !sendBtn || !input) {
        console.warn('Chatbot UI elements not found');
        return;
    }

    // Get user location
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            console.log('[Chatbot] User location:', userLocation);
        }, (error) => {
            console.warn('[Chatbot] Could not get user location:', error);
        });
    }

    // Send message
    sendBtn.addEventListener('click', handleSendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
}

async function handleSendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();

    if (!message) return;
    if (isProcessing) {
        console.warn('[Chatbot] Already processing a message');
        return;
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        console.warn(`[Chatbot] Rate limit: wait ${MIN_REQUEST_INTERVAL - timeSinceLastRequest}ms`);
        addMessageToChat(`Please wait ${Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000)} seconds before sending another message.`, 'bot');
        return;
    }

    isProcessing = true;
    retryCount = 0;

    // Disable input while processing
    input.disabled = true;
    const sendBtn = document.getElementById('chatbot-send');
    sendBtn.disabled = true;

    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';

    // Show typing indicator
    const typingId = addTypingIndicator();

    try {
        const response = await getAIResponseWithRetry(message);
        removeTypingIndicator(typingId);
        addMessageToChat(response, 'bot');
        lastRequestTime = Date.now();
    } catch (error) {
        removeTypingIndicator(typingId);
        console.error('[Chatbot] Error in handleSendMessage:', error);
        console.error('[Chatbot] Error type:', error.constructor.name);
        console.error('[Chatbot] Error message:', error.message);
        
        // Provide helpful error message based on error type
        let errorMessage = 'Sorry, I encountered an error. ';
        
        if (error.message.includes('CORS')) {
            errorMessage += 'API access is blocked - this might be a browser security issue.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage += 'Authentication failed - the API key may be invalid.';
        } else if (error.message.includes('403')) {
            errorMessage += 'Access denied - check API permissions.';
        } else if (error.message.includes('429')) {
            errorMessage += 'API rate limit exceeded. Please wait 30-60 seconds and try again.';
        } else if (error.message.includes('500') || error.message.includes('502')) {
            errorMessage += 'API server error - please try again later.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
            errorMessage += 'Network error - check your connection.';
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
            errorMessage += 'Invalid API response - data format error.';
        } else if (error.message.includes('candidates') || error.message.includes('content')) {
            errorMessage += 'API response structure is unexpected.';
        } else {
            errorMessage += 'Please try again. Check the browser console (F12) for details.';
        }
        addMessageToChat(errorMessage, 'bot');
    } finally {
        // Re-enable input
        isProcessing = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

async function getAIResponseWithRetry(userMessage) {
    let lastError;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Chatbot] Attempt ${attempt + 1} of ${MAX_RETRIES + 1}`);
            const response = await getAIResponse(userMessage);
            return response;
        } catch (error) {
            lastError = error;
            console.error(`[Chatbot] Attempt ${attempt + 1} failed:`, error.message);
            
            // If it's a rate limit error, wait before retrying
            if (error.message.includes('429') && attempt < MAX_RETRIES) {
                const waitTime = Math.min(3000 * Math.pow(2, attempt), 10000); // Exponential backoff
                console.log(`[Chatbot] Rate limited, waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (attempt < MAX_RETRIES && !error.message.includes('401') && !error.message.includes('403')) {
                // Only retry non-auth errors
                const waitTime = 1000 * (attempt + 1);
                console.log(`[Chatbot] Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                // Don't retry auth errors or if max retries reached
                throw lastError;
            }
        }
    }
    
    throw lastError;
}

async function getAIResponse(userMessage) {
    // Use Smart Chatbot for local responses (no API needed!)
    try {
        console.log('[Chatbot] Using SmartChatbot for response...');
        
        if (!userLocation) {
            return `I need your location to provide accurate information. Please enable location services.`;
        }

        const response = await smartChatbot.generateAnswer(
            userMessage, 
            userLocation.lat, 
            userLocation.lon
        );
        
        console.log('[Chatbot] SmartChatbot response generated');
        return response;
    } catch (error) {
        console.error('[Chatbot] SmartChatbot error:', error);
        return `I couldn't process that request. Please try again.`;
    }
}

// Legacy: Call Gemini API if needed (commented out - not used by default)
/*
async function getAIResponseWithGemini(userMessage) {
    const context = await buildContextForAI();
    
    const prompt = `You are a helpful map assistant for Sri Lanka. User asked: "${userMessage}"`;

    try {
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('[Chatbot] Gemini API error:', error);
        throw error;
    }
}
*/

// Calculate distance between two coordinates in kilometers
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

// Get centroid of a geometry
function getGeometryCentroid(geometry) {
    if (!geometry) return null;
    
    if (geometry.type === 'Point') {
        return { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
    } else if (geometry.type === 'LineString' || geometry.type === 'Polygon') {
        // Get first coordinate as approximation
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

// Find nearby disasters within radius (in km)
function getNearbyDisasters(radiusKm = 50) {
    if (!userLocation) return [];
    
    const nearby = [];
    geoJsonData.disasters.forEach(feature => {
        const centroid = getGeometryCentroid(feature.geometry);
        if (centroid) {
            const distance = calculateDistance(userLocation.lat, userLocation.lon, centroid.lat, centroid.lon);
            if (distance <= radiusKm) {
                nearby.push({
                    ...feature,
                    distance: distance,
                    type: feature.properties?.natural || feature.properties?.water || 'Unknown'
                });
            }
        }
    });
    
    // Sort by distance
    return nearby.sort((a, b) => a.distance - b.distance);
}

async function buildContextForAI() {
    let context = '';

    // Add user location info
    if (userLocation) {
        context += `USER LOCATION: Latitude ${userLocation.lat.toFixed(4)}, Longitude ${userLocation.lon.toFixed(4)}\n`;
        context += `Location accuracy: ±${Math.round(userLocation.accuracy)} meters\n\n`;
    } else {
        context += 'USER LOCATION: Not available\n\n';
    }

    // Nearby disasters (within 50 km) - Using GeoJSONLoader for real-time data
    try {
        if (userLocation) {
            const nearbyDisasters = await geoLoader.findNearby(
                userLocation.lat,
                userLocation.lon,
                50,
                'disasters'
            );
            
            if (nearbyDisasters.length > 0) {
                context += 'NEARBY DISASTERS (within 50 km):\n';
                nearbyDisasters.slice(0, 5).forEach(disaster => {
                    const location = disaster.properties?.is_in || 'Unknown location';
                    const type = disaster.properties?.natural || disaster.properties?.water || 'Unknown';
                    context += `- ${type} at ${location} (${disaster.distance.toFixed(1)} km away)\n`;
                });
                context += '\n';
            }
        }
    } catch (error) {
        console.warn('[Chatbot] Error loading nearby disasters:', error);
        // Fall back to original method if loader fails
        const nearbyDisasters = getNearbyDisasters(50);
        if (nearbyDisasters.length > 0) {
            context += 'NEARBY DISASTERS (within 50 km):\n';
            nearbyDisasters.slice(0, 5).forEach(disaster => {
                const location = disaster.properties?.is_in || 'Unknown location';
                context += `- ${disaster.type} at ${location} (${disaster.distance.toFixed(1)} km away)\n`;
            });
            context += '\n';
        }
    }

    // Disasters summary - Using GeoJSONLoader
    try {
        const disasters = await geoLoader.load('Disaster_all.geojson');
        if (disasters && disasters.features.length > 0) {
            const disastersByType = {};
            disasters.features.forEach(feature => {
                const type = feature.properties?.natural || feature.properties?.water || 'Unknown';
                const location = feature.properties?.is_in || 'Unknown location';
                if (!disastersByType[type]) disastersByType[type] = [];
                disastersByType[type].push(location);
            });

            context += 'DISASTERS BY TYPE (all):\n';
            Object.entries(disastersByType).forEach(([type, locations]) => {
                context += `- ${type}: Found in ${locations.slice(0, 3).join(', ')}${locations.length > 3 ? ` and ${locations.length - 3} more` : ''}\n`;
            });
        }
    } catch (error) {
        console.warn('[Chatbot] Error loading disaster data:', error);
        // Fall back to static data
        if (geoJsonData.disasters.length > 0) {
            const disastersByType = {};
            geoJsonData.disasters.forEach(feature => {
                const type = feature.properties?.natural || feature.properties?.water || 'Unknown';
                const location = feature.properties?.is_in || 'Unknown location';
                if (!disastersByType[type]) disastersByType[type] = [];
                disastersByType[type].push(location);
            });

            context += 'DISASTERS BY TYPE (all):\n';
            Object.entries(disastersByType).forEach(([type, locations]) => {
                context += `- ${type}: Found in ${locations.slice(0, 3).join(', ')}${locations.length > 3 ? ` and ${locations.length - 3} more` : ''}\n`;
            });
        }
    }

    // Restaurants summary - Using GeoJSONLoader
    try {
        const restaurants = await geoLoader.load('restaurants_all.geojson');
        if (restaurants && restaurants.features.length > 0) {
            context += `\nRESTAURANTS: Total ${restaurants.features.length} restaurants available\n`;
            restaurants.features.slice(0, 5).forEach(feature => {
                if (feature.properties?.name) {
                    context += `- ${feature.properties.name}\n`;
                }
            });
        }
    } catch (error) {
        console.warn('[Chatbot] Error loading restaurant data:', error);
        // Fall back to static data
        if (geoJsonData.restaurants.length > 0) {
            context += `\nRESTAURANTS: Total ${geoJsonData.restaurants.length} restaurants available\n`;
            geoJsonData.restaurants.slice(0, 5).forEach(feature => {
                if (feature.properties?.name) {
                    context += `- ${feature.properties.name}\n`;
                }
            });
        }
    }

    // Trains summary
    if (geoJsonData.trains.length > 0) {
        const stations = geoJsonData.trains.filter(f => f.properties?.type === 'Station');
        context += `\nTRAIN STATIONS: ${stations.length} stations available across Sri Lanka\n`;
    }

    // Rivers summary
    if (geoJsonData.rivers.length > 0) {
        context += `\nRIVERS: ${geoJsonData.rivers.length} rivers and waterways mapped\n`;
    }

    return context;
}

function addMessageToChat(message, sender) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `chatbot-message ${sender}-message`;
    
    const p = document.createElement('p');
    p.textContent = message;
    messageEl.appendChild(p);
    messagesContainer.appendChild(messageEl);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageEl;
}

function addTypingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    const typingEl = document.createElement('div');
    typingEl.className = 'chatbot-message bot-message';
    typingEl.id = 'typing-indicator';
    
    typingEl.innerHTML = `<p><span>.</span><span>.</span><span>.</span></p>`;
    const style = document.createElement('style');
    style.textContent = `
        #typing-indicator p {
            animation: pulse 1.4s infinite;
        }
        #typing-indicator span {
            animation: typing 1.4s infinite;
        }
        #typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }
        #typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }
        @keyframes typing {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
        }
    `;
    if (!document.querySelector('#typing-style')) {
        style.id = 'typing-style';
        document.head.appendChild(style);
    }

    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return typingEl;
}

function removeTypingIndicator(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}
