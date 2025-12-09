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

// Initialize chatbot
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
    const closeBtn = document.getElementById('close-chatbot');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');

    if (!chatbotPanel || !sendBtn || !input) {
        console.warn('Chatbot UI elements not found');
        return;
    }

    // Toggle chatbot panel with open button
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Chatbot] Open button clicked - toggling panel');
            const isHidden = chatbotPanel.classList.contains('hidden');
            if (isHidden) {
                chatbotPanel.classList.remove('hidden');
                closeBtn.classList.remove('hidden');
                input.focus();
            } else {
                chatbotPanel.classList.add('hidden');
                closeBtn.classList.add('hidden');
            }
        });
    }

    // Close chatbot panel with floating X button
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Chatbot] Close button clicked');
            chatbotPanel.classList.add('hidden');
            closeBtn.classList.add('hidden');
            
            // Clear all messages and reset chatbot to welcome state
            const messagesContainer = document.getElementById('chatbot-messages');
            messagesContainer.innerHTML = `
                <div class="chatbot-message bot-message">
                    <div class="message-content">
                        <p>Hi! 👋 I'm your Map Assistant. Ask me about:</p>
                        <ul>
                            <li>Dangerous areas & disasters</li>
                            <li>Restaurants & food places</li>
                            <li>Train stations & routes</li>
                            <li>Roads & highways</li>
                            <li>Rivers & waterways</li>
                        </ul>
                    </div>
                </div>
            `;
        });
    } else {
        console.warn('[Chatbot] Close button not found');
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

/**
 * Local answer function - provides answers without Gemini API
 * Uses GeoJSON data for dangerous areas, railways, restaurants, highways, and rivers
 */
async function getLocalAnswer(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Keywords for different topics
    const dangerousKeywords = ['danger', 'risk', 'disaster', 'earthquake', 'flood', 'landslide', 'tsunami', 'hazard', 'unsafe', 'careful'];
    const railwayKeywords = ['train', 'railway', 'station', 'transport', 'rail', 'locomotive', 'track'];
    const restaurantKeywords = ['restaurant', 'food', 'eat', 'dining', 'cafe', 'hotel', 'meal', 'cuisine', 'where eat'];
    const highwayKeywords = ['highway', 'road', 'drive', 'route', 'path', 'traffic', 'way', 'street'];
    const riverKeywords = ['river', 'water', 'stream', 'waterway', 'flow', 'oya', 'lake'];
    
    // Check which category the question belongs to
    let answer = '';
    let dataLoaded = false;

    // Check for dangerous/disaster related questions
    if (dangerousKeywords.some(keyword => message.includes(keyword))) {
        answer = await getDisasterAnswer(message);
        dataLoaded = true;
    }
    
    // Check for railway related questions
    if (!dataLoaded && railwayKeywords.some(keyword => message.includes(keyword))) {
        answer = await getRailwayAnswer(message);
        dataLoaded = true;
    }
    
    // Check for restaurant related questions
    if (!dataLoaded && restaurantKeywords.some(keyword => message.includes(keyword))) {
        answer = await getRestaurantAnswer(message);
        dataLoaded = true;
    }
    
    // Check for highway related questions
    if (!dataLoaded && highwayKeywords.some(keyword => message.includes(keyword))) {
        answer = await getHighwayAnswer(message);
        dataLoaded = true;
    }
    
    // Check for river/water related questions
    if (!dataLoaded && riverKeywords.some(keyword => message.includes(keyword))) {
        answer = await getRiverAnswer(message);
        dataLoaded = true;
    }
    
    // If we found an answer, return it
    if (dataLoaded && answer) {
        return answer;
    }
    
    // If no match found, return null so it uses Gemini API as fallback
    return null;
}

/**
 * Get answers about dangerous areas and disasters
 */
async function getDisasterAnswer(message) {
    try {
        const disasters = await geoLoader.load('Disaster_all.geojson');
        
        if (!disasters || !disasters.features.length) {
            return '❌ No disaster data available currently.';
        }

        let answer = '';

        // Check if asking for nearby dangers
        if (message.includes('nearby') || message.includes('near me') || message.includes('close')) {
            if (userLocation) {
                const nearbyDisasters = await geoLoader.findNearby(
                    userLocation.lat,
                    userLocation.lon,
                    50,
                    'disasters'
                );
                
                if (nearbyDisasters.length > 0) {
                    answer = '⚠️ **NEARBY DANGEROUS AREAS (within 50 km):**\n\n';
                    nearbyDisasters.slice(0, 5).forEach(disaster => {
                        const type = disaster.properties?.natural || disaster.properties?.water || 'Hazard';
                        const location = disaster.properties?.is_in || 'Unknown area';
                        const distance = disaster.distance.toFixed(1);
                        answer += `🔴 **${type}** at ${location} (${distance} km away)\n`;
                    });
                } else {
                    answer = '✅ No dangerous areas detected nearby (within 50 km). You are safe!';
                }
            } else {
                answer = '📍 Please enable location access to check for nearby dangers.';
            }
        }
        // Check for specific location disasters
        else if (message.includes('colombo') || message.includes('kandy') || message.includes('galle')) {
            const location = message.match(/colombo|kandy|galle|matara|jaffna|trincomalee/)?.[0] || 'your area';
            const locationDisasters = await geoLoader.findDisastersByLocation(location);
            
            if (locationDisasters.length > 0) {
                answer = `⚠️ **DANGEROUS AREAS IN ${location.toUpperCase()}:**\n\n`;
                locationDisasters.slice(0, 5).forEach(disaster => {
                    const type = disaster.properties?.natural || 'Hazard';
                    answer += `🔴 ${type}\n`;
                });
            } else {
                answer = `✅ No major disaster risks recorded in ${location}. It appears relatively safe.`;
            }
        }
        // General disaster info
        else {
            const disasterTypes = {};
            disasters.features.slice(0, 10).forEach(feature => {
                const type = feature.properties?.natural || feature.properties?.water || 'Unknown';
                disasterTypes[type] = (disasterTypes[type] || 0) + 1;
            });

            answer = '📊 **DISASTER & HAZARD OVERVIEW:**\n\n';
            Object.entries(disasterTypes).slice(0, 5).forEach(([type, count]) => {
                answer += `⚠️ ${type}: ${count} areas recorded\n`;
            });
            answer += '\n💡 *Use "nearby dangers" to check your area*';
        }

        return answer;
    } catch (error) {
        console.error('[Chatbot] Error in getDisasterAnswer:', error);
        return null;
    }
}

/**
 * Get answers about railways and trains
 */
async function getRailwayAnswer(message) {
    try {
        const trains = await geoLoader.load('ralway_All.geojson');
        
        if (!trains || !trains.features.length) {
            return '❌ No railway data available currently.';
        }

        let answer = '';

        // Check for nearby stations
        if (message.includes('nearby') || message.includes('near me') || message.includes('close')) {
            if (userLocation) {
                const nearbyTrains = await geoLoader.findNearby(
                    userLocation.lat,
                    userLocation.lon,
                    30,
                    'ralway_All'
                );
                
                if (nearbyTrains.length > 0) {
                    answer = '🚂 **NEARBY RAILWAY STATIONS (within 30 km):**\n\n';
                    nearbyTrains.slice(0, 5).forEach(train => {
                        const name = train.properties?.name || 'Railway';
                        const distance = train.distance.toFixed(1);
                        answer += `🚉 ${name} (${distance} km away)\n`;
                    });
                } else {
                    answer = '❌ No railway stations found nearby (within 30 km).';
                }
            } else {
                answer = '📍 Please enable location access to find nearby stations.';
            }
        }
        // General railway info
        else {
            answer = `🚂 **RAILWAY NETWORK INFO:**\n\n`;
            answer += `📊 Total railway features: ${trains.features.length}\n`;
            answer += `✅ Railway network covers Sri Lanka\n`;
            answer += `💡 Use "nearby stations" to find closest train station`;
        }

        return answer;
    } catch (error) {
        console.error('[Chatbot] Error in getRailwayAnswer:', error);
        return null;
    }
}

/**
 * Get answers about restaurants
 */
async function getRestaurantAnswer(message) {
    try {
        const restaurants = await geoLoader.load('restaurants_all.geojson');
        
        if (!restaurants || !restaurants.features.length) {
            return '❌ No restaurant data available currently.';
        }

        let answer = '';

        // Check for nearby restaurants
        if (message.includes('nearby') || message.includes('near me') || message.includes('close')) {
            if (userLocation) {
                const nearbyRestaurants = await geoLoader.findNearby(
                    userLocation.lat,
                    userLocation.lon,
                    5,
                    'restaurants_all'
                );
                
                if (nearbyRestaurants.length > 0) {
                    answer = '🍽️ **NEARBY RESTAURANTS (within 5 km):**\n\n';
                    nearbyRestaurants.slice(0, 5).forEach(rest => {
                        const name = rest.properties?.name || 'Restaurant';
                        const type = rest.properties?.cuisine || rest.properties?.amenity || 'Dining';
                        const distance = rest.distance.toFixed(1);
                        answer += `🍴 ${name} (${type}) - ${distance} km away\n`;
                    });
                } else {
                    answer = '❌ No restaurants found nearby. Try searching in a wider area.';
                }
            } else {
                answer = '📍 Please enable location access to find nearby restaurants.';
            }
        }
        // General restaurant info
        else {
            answer = `🍽️ **RESTAURANT GUIDE:**\n\n`;
            answer += `📊 Total restaurants: ${restaurants.features.length}\n`;
            answer += `✅ Restaurants available across Sri Lanka\n`;
            answer += `💡 Use "nearby restaurants" to find places to eat`;
        }

        return answer;
    } catch (error) {
        console.error('[Chatbot] Error in getRestaurantAnswer:', error);
        return null;
    }
}

/**
 * Get answers about highways and roads
 */
async function getHighwayAnswer(message) {
    try {
        const highways = await geoLoader.load('HW_all.geojson');
        
        if (!highways || !highways.features.length) {
            return '❌ No highway data available currently.';
        }

        let answer = '';

        // Check for nearby roads
        if (message.includes('nearby') || message.includes('near me') || message.includes('route')) {
            if (userLocation) {
                const nearbyRoads = await geoLoader.findNearby(
                    userLocation.lat,
                    userLocation.lon,
                    10,
                    'HW_all'
                );
                
                if (nearbyRoads.length > 0) {
                    answer = '🛣️ **NEARBY ROADS & HIGHWAYS (within 10 km):**\n\n';
                    nearbyRoads.slice(0, 5).forEach(road => {
                        const type = road.properties?.highway || 'Road';
                        const lanes = road.properties?.lanes || '?';
                        answer += `🚗 ${type.toUpperCase()} (${lanes} lane(s))\n`;
                    });
                } else {
                    answer = '❌ No highways found nearby.';
                }
            } else {
                answer = '📍 Please enable location access to find nearby roads.';
            }
        }
        // General highway info
        else {
            answer = `🛣️ **HIGHWAY & ROAD NETWORK:**\n\n`;
            answer += `📊 Total road segments: ${highways.features.length}\n`;
            answer += `✅ Comprehensive road network across Sri Lanka\n`;
            answer += `💡 Use "nearby roads" to check local routes`;
        }

        return answer;
    } catch (error) {
        console.error('[Chatbot] Error in getHighwayAnswer:', error);
        return null;
    }
}

/**
 * Get answers about rivers and waterways
 */
async function getRiverAnswer(message) {
    try {
        const rivers = await geoLoader.load('Oya_all.geojson');
        
        if (!rivers || !rivers.features.length) {
            return '❌ No river data available currently.';
        }

        let answer = '';

        // Check for nearby rivers
        if (message.includes('nearby') || message.includes('near me') || message.includes('close')) {
            if (userLocation) {
                const nearbyRivers = await geoLoader.findNearby(
                    userLocation.lat,
                    userLocation.lon,
                    20,
                    'Oya_all'
                );
                
                if (nearbyRivers.length > 0) {
                    answer = '💧 **NEARBY RIVERS & WATERWAYS (within 20 km):**\n\n';
                    nearbyRivers.slice(0, 5).forEach(river => {
                        const name = river.properties?.name || 'Waterway';
                        const distance = river.distance.toFixed(1);
                        answer += `🌊 ${name} (${distance} km away)\n`;
                    });
                } else {
                    answer = '❌ No major rivers found nearby.';
                }
            } else {
                answer = '📍 Please enable location access to find nearby rivers.';
            }
        }
        // General river info
        else {
            answer = `💧 **RIVER & WATERWAY SYSTEM:**\n\n`;
            answer += `📊 Total waterways mapped: ${rivers.features.length}\n`;
            answer += `✅ Major rivers: Mahaweli, Kelani, Ruwanwella, and more\n`;
            answer += `💡 Use "nearby rivers" to find local waterways`;
        }

        return answer;
    } catch (error) {
        console.error('[Chatbot] Error in getRiverAnswer:', error);
        return null;
    }
}

async function getAIResponse(userMessage) {
    // Try local answer first (faster, no API cost)
    console.log('[Chatbot] Trying local answer function...');
    const localAnswer = await getLocalAnswer(userMessage);
    
    if (localAnswer) {
        console.log('[Chatbot] Local answer found - using it instead of Gemini API');
        return localAnswer;
    }
    
    console.log('[Chatbot] No local answer found - falling back to Gemini API');
    
    const context = await buildContextForAI();
    
    const prompt = `You are a helpful map assistant for Sri Lanka. You have access to data about disasters, restaurants, train routes, highways, and rivers.


User question: "${userMessage}"

Map data summary:
${context}

Please answer the user's question in a natural, conversational way. Be specific about locations when possible. Keep your response short and easy to understand (2-3 sentences max).`;

    try {
        console.log('[Chatbot] Building API request...');
        console.log('[Chatbot] API URL:', GEMINI_API_URL.substring(0, 50) + '...');
        console.log('[Chatbot] Context length:', context.length);

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        console.log('[Chatbot] Sending fetch request...');
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[Chatbot] Response received:', response.status, response.statusText);

        if (!response.ok) {
            const responseText = await response.text();
            console.error('[Chatbot] API Error Response:', responseText);
            throw new Error(`API Error: ${response.status} - ${response.statusText} - ${responseText.substring(0, 200)}`);
        }

        const responseText = await response.text();
        console.log('[Chatbot] Response text length:', responseText.length);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Chatbot] JSON Parse Error:', parseError);
            console.error('[Chatbot] Response text:', responseText.substring(0, 500));
            throw new Error('Failed to parse API response as JSON');
        }

        console.log('[Chatbot] Parsed response has candidates:', !!data.candidates);
        
        if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            console.error('[Chatbot] Invalid candidates:', data.candidates);
            throw new Error('Invalid API response format: missing or empty candidates');
        }

        if (!data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            console.error('[Chatbot] Invalid content:', data.candidates[0].content);
            throw new Error('Invalid API response format: missing content or parts');
        }

        const reply = data.candidates[0].content.parts[0].text;
        console.log('[Chatbot] Got reply:', reply.substring(0, 100) + '...');
        return reply;
    } catch (error) {
        console.error('[Chatbot] Full error:', error);
        console.error('[Chatbot] Error message:', error.message);
        throw error;
    }
}

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
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Check if message contains markdown or HTML-like content
    if (message.includes('**') || message.includes('•') || message.includes('🔴') || message.includes('🍽️')) {
        // Parse simple markdown
        let html = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        contentDiv.innerHTML = html;
    } else {
        const p = document.createElement('p');
        p.textContent = message;
        contentDiv.appendChild(p);
    }
    
    messageEl.appendChild(contentDiv);
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
