// Test Gemini API independently
const GEMINI_API_KEY = 'AIzaSyDLZhafGRJdlzxIVCxcB_l_SHp43krwO5A';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function testGeminiAPI() {
    console.log('Testing Gemini API...');
    console.log('API Key:', GEMINI_API_KEY.substring(0, 10) + '...');
    console.log('API URL:', GEMINI_API_URL);

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Hello, what is 2+2?'
                    }]
                }]
            })
        });

        console.log('Response Status:', response.status, response.statusText);
        console.log('Response OK:', response.ok);

        const responseHeaders = {};
        response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
        });
        console.log('Response Headers:', responseHeaders);

        const data = await response.json();
        console.log('Response Data:', data);

        if (!response.ok) {
            console.error('API Error:', data);
            return false;
        }

        if (data.error) {
            console.error('API Error Message:', data.error);
            return false;
        }

        if (!data.candidates || !data.candidates[0]) {
            console.error('Invalid response format - no candidates');
            return false;
        }

        if (!data.candidates[0].content || !data.candidates[0].content.parts) {
            console.error('Invalid response format - no content');
            return false;
        }

        const reply = data.candidates[0].content.parts[0].text;
        console.log('API Response:', reply);
        return true;
    } catch (error) {
        console.error('API Test Error:', error);
        console.error('Error Message:', error.message);
        console.error('Error Type:', error.constructor.name);
        return false;
    }
}

// Run test
testGeminiAPI().then(success => {
    console.log('\n=== Test Result ===');
    console.log(success ? 'API is working!' : 'API test failed');
});
