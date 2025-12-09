# Chatbot Debugging & Testing Guide

## What Was Fixed

The chatbot error handling has been significantly enhanced with:

1. **Detailed Console Logging** - Every step of the API request is logged with `[Chatbot]` prefix:
   - Request building
   - Fetch initiation
   - Response receipt
   - JSON parsing
   - Data validation

2. **Response Validation** - Multiple checks for:
   - HTTP status codes
   - JSON parse errors
   - API response structure (candidates, content, parts)
   - Text content existence

3. **Better Error Messages** - Instead of generic "I encountered an error", the chatbot now provides specific messages:
   - "API access is blocked - this might be a browser security issue." (CORS)
   - "Authentication failed - the API key may be invalid." (401)
   - "Access denied - check API permissions." (403)
   - "Too many requests - please wait a moment." (429)
   - "API server error - please try again later." (500/502)
   - "Network error - check your connection."
   - "Invalid API response - data format error." (JSON parse)
   - "API response structure is unexpected." (Missing fields)

## How to Test

### Prerequisites
- Node.js 20.19+ or 22.12+ (upgrade if running 20.17.0)
- Project has been built (`npm run build` completed successfully)

### Local Testing

1. **Upgrade Node.js** (if needed):
   ```powershell
   # Check current version
   node --version
   
   # If 20.17.0, upgrade to 20.19+ or newer
   # Visit: https://nodejs.org/
   ```

2. **Run Development Server**:
   ```powershell
   cd "c:\Users\shard\OneDrive - NSBM\Desktop\Dilexus\SriMap"
   npm run dev
   ```

3. **Open in Browser**:
   - Navigate to `http://localhost:5173/` (or the URL shown in terminal)

4. **Test the Chatbot**:
   - Click the chat button (bottom-right corner)
   - Type a question like:
     - "Where are the disasters in Sri Lanka?"
     - "What restaurants are available?"
     - "Show me train routes"
     - "What areas are most dangerous?"

5. **Check Browser Console for Debugging**:
   - Press `F12` to open Developer Tools
   - Click "Console" tab
   - Look for messages starting with `[Chatbot]`
   - These will show:
     - API URL being called
     - Request/response status
     - Any parsing errors
     - Full error details

### Expected Console Output (Success Case)

```
[Chatbot] Building API request...
[Chatbot] API URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent...
[Chatbot] Context length: 1250
[Chatbot] Sending fetch request...
[Chatbot] Response received: 200 OK
[Chatbot] Response text length: 450
[Chatbot] Parsed response has candidates: true
[Chatbot] Got reply: "Sri Lanka experiences various natural disasters...
```

### Expected Console Output (Error Cases)

#### CORS Error:
```
[Chatbot] Error in handleSendMessage: TypeError: Failed to fetch
[Chatbot] Error type: TypeError
[Chatbot] Error message: Failed to fetch
User sees: "API access is blocked - this might be a browser security issue."
```

#### Invalid API Key (401):
```
[Chatbot] API Error Response: {"error":{"code":401,"message":"API key not valid"}}
[Chatbot] Error in handleSendMessage: Error: API Error: 401 - Unauthorized
User sees: "Authentication failed - the API key may be invalid."
```

#### Invalid Response Format:
```
[Chatbot] Parsed response has candidates: false
[Chatbot] Invalid candidates: undefined
[Chatbot] Error in handleSendMessage: Error: Invalid API response format: missing or empty candidates
User sees: "API response structure is unexpected."
```

## Troubleshooting Steps

### If you see "API access is blocked" error:
1. This is likely a CORS issue from the browser
2. Solutions:
   - Test API in a different browser (Firefox, Chrome, Edge)
   - Use a CORS proxy or backend proxy solution
   - Check if API key has origin restrictions
   - Try from a deployed URL instead of localhost (CORS may be less strict)

### If you see "Authentication failed" error:
1. API key may be invalid or expired
2. Check the key: `AIzaSyDLZhafGRJdlzxIVCxcB_l_SHp43krwO5A`
3. Verify in Google Cloud Console:
   - API is enabled: "Generative Language API" or "Google AI Studio"
   - Key has correct permissions
   - Key is not restricted to certain origins

### If you see "Invalid API response" error:
1. The Gemini API response format may have changed
2. Check the console for the actual response
3. Verify the model name: `gemini-2.0-flash`
4. Check API documentation: https://ai.google.dev/

### If chatbot doesn't respond at all:
1. Check HTML elements exist:
   ```javascript
   // In console:
   console.log(document.getElementById('chatbot-panel'));
   console.log(document.getElementById('chatbot-input'));
   console.log(document.getElementById('chatbot-send'));
   ```

2. Check if data is loading:
   ```javascript
   // In main.js, check console for:
   // - "Loading train routes..."
   // - "Train routes loaded: X features"
   // Similar for other layers
   ```

## Files Modified

1. **chatbot.js** (Main chatbot module):
   - Enhanced `getAIResponse()` with detailed logging and error handling
   - Improved error messages in `handleSendMessage()`
   - Added response structure validation
   - Better error classification

2. **Rebuild Output** (`dist/`):
   - New version built successfully
   - Ready for deployment

## Next Steps

1. **Local Testing** (Priority 1):
   - Upgrade Node.js if needed
   - Run `npm run dev`
   - Test chatbot with sample questions
   - Check console for actual error details

2. **Diagnose the Issue** (Priority 2):
   - Based on console output, identify the root cause
   - Apply appropriate fix (API key, CORS proxy, etc.)

3. **Deploy Fix** (Priority 3):
   - Once working locally, commit to GitHub
   - Vercel auto-deploys from main branch
   - Test on production URL

4. **Full Testing** (Priority 4):
   - Test with various questions
   - Verify GeoJSON data is being used in responses
   - Check response quality and relevance

## Key Code Locations

- **API Constants**: `chatbot.js` lines 2-3
- **API Call**: `chatbot.js` lines 110-140
- **Error Handling**: `chatbot.js` lines 75-95 and 155-180
- **Context Building**: `chatbot.js` lines 185-220
- **HTML Elements**: `index.html` lines 44-62
- **CSS Styling**: `style.css` lines 500-750

## Security Note

The API key is currently embedded in client-side JavaScript. This means:
- ❌ NOT secure for production
- ⚠️ Anyone can see the key in the browser
- ⚠️ Anyone can make requests with your quota
- ✅ Fine for development/testing
- ✅ Should use backend proxy for production

To fix this properly:
1. Create a backend API endpoint (Node.js, Python, etc.)
2. That endpoint calls Gemini API with the key (kept secret)
3. Frontend calls your backend instead of Gemini directly
