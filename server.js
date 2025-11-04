/**
 * Inovio Tokenization API - Reference Implementation
 *
 * This server demonstrates how to integrate with the Inovio ArgusPay tokenization API,
 * including proper HMAC-SHA256 signature generation and verification.
 *
 * @author Inovio Payment Solutions
 * @version 1.0.0
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SECRET_KEY: process.env.SECRET_KEY || 'Password123',
  SITE_ID: process.env.SITE_ID || '9201',
  TOKEN_SERVICE_URL: process.env.TOKEN_SERVICE_URL || 'https://t1api.inoviopay.com/payment/token_service.cfm',
  API_VERSION: process.env.API_VERSION || '2.22',
  TIMESTAMP_TOLERANCE: parseInt(process.env.TIMESTAMP_TOLERANCE || '300') // seconds
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates UTC timestamp in YYYYMMDDHHmmss format
 * @returns {string} UTC timestamp
 * @example "20251103170000"
 */
function generateTimestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Generates HMAC-SHA256 signature in hexadecimal format
 * @param {string} secretKey - The HMAC secret key
 * @param {string} message - The message to sign
 * @returns {string} Hexadecimal signature
 */
function generateSignature(secretKey, message) {
  return crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
}

/**
 * Generates a cryptographically secure unique ID
 * @returns {string} 32-character hexadecimal unique ID
 */
function generateUniqueId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verifies the response signature from Inovio token service
 *
 * The signature format is: HMAC-SHA256(SECRET_KEY, TIMESTAMP + REQID + JSON_BODY)
 * Note: Response body must be trimmed of trailing whitespace before verification
 *
 * @param {string} secretKey - HMAC secret key
 * @param {string} receivedSignature - Signature from X-SIGNATURE header
 * @param {string} serverTimestamp - Timestamp from X-TIMESTAMP header
 * @param {number} tokenRequestId - TOKEN_REQID from response JSON
 * @param {string} rawResponseBody - Raw JSON response body (will be trimmed)
 * @returns {boolean} True if signature is valid
 */
function verifyResponseSignature(secretKey, receivedSignature, serverTimestamp, tokenRequestId, rawResponseBody) {
  // Build the message: TIMESTAMP + REQID + JSON_BODY
  const message = `${serverTimestamp}${tokenRequestId}${rawResponseBody}`;

  // Calculate expected signature
  const expectedSignature = generateSignature(secretKey, message).toUpperCase();
  const isValid = expectedSignature === receivedSignature.toUpperCase();

  // Log verification results
  console.log('\n--- Response Signature Verification ---');
  console.log('Server Timestamp:', serverTimestamp);
  console.log('Token Request ID:', tokenRequestId);
  console.log('Expected Signature:', expectedSignature);
  console.log('Received Signature:', receivedSignature.toUpperCase());
  console.log('Result:', isValid ? '✅ VALID' : '❌ INVALID');

  return isValid;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /api/generate-token
 *
 * Tokenizes a credit card number using the Inovio tokenization API.
 * Generates HMAC-SHA256 signatures for request authentication and verifies
 * response signatures.
 *
 * @route POST /api/generate-token
 * @param {string} req.body.cardPan - Credit card number (PAN)
 * @returns {Object} Token data including TOKEN_GUID and card metadata
 *
 * @example
 * POST /api/generate-token
 * {
 *   "cardPan": "5120342233150747"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "token": {
 *     "TOKEN_GUID": "...",
 *     "CARD_BRAND_NAME": "MasterCard",
 *     ...
 *   }
 * }
 */
app.post('/api/generate-token', async (req, res) => {
  try {
    const { cardPan } = req.body;

    if (!cardPan) {
      return res.status(400).json({
        error: 'Missing required field: cardPan'
      });
    }

    // Generate request parameters
    const timestamp = generateTimestamp();
    const uniqueId = generateUniqueId();
    const siteId = CONFIG.SITE_ID;

    // Generate request signature: HMAC_SHA256(timestamp + uniqueId + siteId)
    const messageToSign = `${timestamp}${uniqueId}${siteId}`;
    const signature = generateSignature(CONFIG.SECRET_KEY, messageToSign);

    console.log('\n--- Token Request Generation ---');
    console.log('Card PAN:', cardPan.substring(0, 6) + '******' + cardPan.substring(cardPan.length - 4));
    console.log('Timestamp:', timestamp);
    console.log('Unique ID:', uniqueId);
    console.log('Site ID:', siteId);
    console.log('Message to Sign:', messageToSign);
    console.log('Generated Signature:', signature);

    // Build request URL
    const url = new URL(CONFIG.TOKEN_SERVICE_URL);
    url.searchParams.append('CARD_PAN', cardPan);
    url.searchParams.append('REQUEST_API_VERSION', CONFIG.API_VERSION);
    url.searchParams.append('UNIQUE_ID', uniqueId);
    url.searchParams.append('SITE_ID', siteId);
    url.searchParams.append('REQUEST_RESPONSE_FORMAT', 'JSON');

    console.log('Request URL:', url.toString());
    console.log('Request Headers:', {
      'X-SIGNATURE': signature,
      'X-TIMESTAMP': timestamp
    });

    // Make request to Inovio token service
    // IMPORTANT: Response is ISO-8859-1 encoded, get as buffer to preserve bytes
    const response = await axios.get(url.toString(), {
      headers: {
        'X-SIGNATURE': signature,
        'X-TIMESTAMP': timestamp
      },
      responseType: 'arraybuffer', // Get response as binary buffer
      transformResponse: [(data) => data] // Don't transform
    });

    // Convert buffer to string using ISO-8859-1 encoding (latin1)
    const rawResponseBody = Buffer.from(response.data).toString('latin1');
    const parsedData = JSON.parse(rawResponseBody);

    console.log('\n--- Token Service Response ---');
    console.log('Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Raw Response Body:', rawResponseBody);
    console.log('Parsed Response Data:', parsedData);

    // Verify response signature
    const serverTimestamp = response.headers['x-timestamp'];
    const serverSignature = response.headers['x-signature'];
    const tokenRequestId = parsedData.TOKEN_REQID;

    if (serverSignature && serverTimestamp && tokenRequestId) {
      // IMPORTANT: ColdFusion adds a trailing newline to the response body, but Oracle's signature
      // was calculated on the JSON WITHOUT the trailing newline. We must trim it before verification.
      const isValid = verifyResponseSignature(
        CONFIG.SECRET_KEY,
        serverSignature,
        serverTimestamp,
        tokenRequestId,
        rawResponseBody.trim() // Trim trailing newline added by ColdFusion
      );

      if (!isValid) {
        console.error('❌ Response signature verification FAILED!');
        return res.status(200).json({
          success: false,
          error: 'Response signature verification failed',
          signatureVerified: false,
          receivedSignature: serverSignature,
          expectedSignature: generateSignature(
            CONFIG.SECRET_KEY,
            `${serverTimestamp}${tokenRequestId}${rawResponseBody.trim()}`
          ).toUpperCase(),
          serverTimestamp: serverTimestamp,
          tokenRequestId: tokenRequestId,
          responseData: parsedData
        });
      }
      console.log('✅ Response signature verified successfully!');
    } else {
      console.warn('⚠️ Response missing signature headers - skipping verification');
    }

    // Return token data to frontend
    res.json({
      success: true,
      signatureVerified: true,
      token: parsedData
    });

  } catch (error) {
    console.error('\n--- Error ---');
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);

      res.status(error.response.status).json({
        error: 'Token service error',
        details: error.response.data
      });
    } else {
      console.error('Error Details:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

/**
 * GET /health
 *
 * Health check endpoint for monitoring and container orchestration.
 * Returns service status and configuration info.
 *
 * @route GET /health
 * @returns {Object} Service health status and configuration
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      siteId: CONFIG.SITE_ID,
      apiVersion: CONFIG.API_VERSION,
      tokenServiceUrl: CONFIG.TOKEN_SERVICE_URL
    }
  });
});

/**
 * GET /
 *
 * Serves the web-based test interface.
 *
 * @route GET /
 * @returns {HTML} Test payment form interface
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('Inovio Tokenization API - Reference Server');
  console.log('='.repeat(50));
  console.log(`\nServer running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`Health check:  http://localhost:${PORT}/health`);
  console.log('\nConfiguration:');
  console.log(`  Site ID:       ${CONFIG.SITE_ID}`);
  console.log(`  API Version:   ${CONFIG.API_VERSION}`);
  console.log(`  Service URL:   ${CONFIG.TOKEN_SERVICE_URL}`);
  console.log(`  Secret Key:    ${CONFIG.SECRET_KEY.substring(0, 3)}${'*'.repeat(Math.max(0, CONFIG.SECRET_KEY.length - 3))}`);
  console.log('\n' + '='.repeat(50) + '\n');
});
