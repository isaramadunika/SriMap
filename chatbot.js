// Chatbot module for map-based AI conversations
const GEMINI_API_KEY = 'AIzaSyDLZhafGRJdlzxIVCxcB_l_SHp43krwO5A';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
        const response = await getAIResponse(message);
        removeTypingIndicator(typingId);
        addMessageToChat(response, 'bot');
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
            errorMessage += 'Too many requests - please wait a moment.';
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
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
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

function buildContextForAI() {
    let context = '';

    // Disasters summary
    if (geoJsonData.disasters.length > 0) {
        const disastersByType = {};
        geoJsonData.disasters.forEach(feature => {
            const type = feature.properties?.natural || feature.properties?.water || 'Unknown';
            const location = feature.properties?.is_in || 'Unknown location';
            if (!disastersByType[type]) disastersByType[type] = [];
            disastersByType[type].push(location);
        });

        context += '\nDISASTERS BY TYPE:\n';
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
