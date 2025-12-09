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
    const closeBtn = document.getElementById('toggle-chatbot');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');

    if (!chatbotPanel || !openBtn || !closeBtn || !sendBtn || !input) {
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

    // Toggle chatbot visibility
    openBtn.addEventListener('click', () => {
        chatbotPanel.classList.remove('hidden');
        openBtn.classList.add('hidden');
        input.focus();
    });

    closeBtn.addEventListener('click', () => {
        chatbotPanel.classList.add('hidden');
        openBtn.classList.remove('hidden');
    });

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
    const context = buildContextForAI();
    
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

function buildContextForAI() {
    let context = '';

    // Add user location info
    if (userLocation) {
        context += `USER LOCATION: Latitude ${userLocation.lat.toFixed(4)}, Longitude ${userLocation.lon.toFixed(4)}\n`;
        context += `Location accuracy: ±${Math.round(userLocation.accuracy)} meters\n\n`;
    } else {
        context += 'USER LOCATION: Not available\n\n';
    }

    // Nearby disasters (within 50 km)
    const nearbyDisasters = getNearbyDisasters(50);
    if (nearbyDisasters.length > 0) {
        context += 'NEARBY DISASTERS (within 50 km):\n';
        nearbyDisasters.slice(0, 5).forEach(disaster => {
            const location = disaster.properties?.is_in || 'Unknown location';
            context += `- ${disaster.type} at ${location} (${disaster.distance.toFixed(1)} km away)\n`;
        });
        context += '\n';
    }

    // Disasters summary
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

    // Restaurants summary
    if (geoJsonData.restaurants.length > 0) {
        context += `\nRESTAURANTS: Total ${geoJsonData.restaurants.length} restaurants available\n`;
        geoJsonData.restaurants.slice(0, 5).forEach(feature => {
            if (feature.properties?.name) {
                context += `- ${feature.properties.name}\n`;
            }
        });
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
