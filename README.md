# Inovio Tokenization API - Integration Guide

A Node.js reference implementation for integrating with the Inovio tokenization API using HMAC-SHA256 signatures.

## Overview

This reference implementation demonstrates how to:
- Generate HMAC-SHA256 signatures for API requests
- Make tokenization requests to Inovio
- Verify response signatures
- Handle the complete tokenization flow

## Quick Start

### Option 1: Docker (Recommended for Testing)

```bash
# Start the test server
docker-compose up -d

# Access the web interface
open http://localhost:3000

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 2: Node.js (Local Development)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start

# Or with auto-reload
npm run dev
```

## Configuration

Create a `.env` file with your Inovio credentials:

```bash
# Server Configuration
PORT=3000

# Inovio API Credentials
SECRET_KEY=your_secret_key_here
SITE_ID=your_site_id_here
API_VERSION=2.22

# API Endpoint
TOKEN_SERVICE_URL=https://t1api.inoviopay.com/payment/token_service.cfm

# Security
TIMESTAMP_TOLERANCE=300
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | HMAC secret key provided by Inovio | `Password123` |
| `SITE_ID` | Your merchant site ID | `9201` |
| `API_VERSION` | API version (use 2.22) | `2.22` |
| `TOKEN_SERVICE_URL` | Tokenization endpoint URL | See above |
| `TIMESTAMP_TOLERANCE` | Timestamp window in seconds | `300` |

## API Usage

### Generate Token

**Endpoint:** `POST /api/generate-token`

**Request:**
```json
{
  "cardPan": "409159111111111"
}
```

**Response:**
```json
{
  "success": true,
  "token": {
    "TOKEN_GUID": "DE1178E5CECC8A49286280220D9844F386AC7FBF",
    "CARD_BRAND_NAME": "MasterCard",
    "CARD_TYPE": "MASTERCARD BLACK CARD",
    "CARD_BANK": "CREDOMATIC INTERNATIONAL, S.A.",
    "CARD_COUNTRY": "CRI",
    "CARD_ACCOUNT_FUND_SOURCE": "Credit",
    "CARD_CLASS": "Consumer",
    "TOKEN_IP": "47.180.84.82",
    "TOKEN_REQID": 29973496
  }
}
```

**Error Response:**
```json
{
  "error": "Response signature verification failed",
  "receivedSignature": "ABC123..."
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-03T17:00:00.000Z",
  "config": {
    "siteId": "9201",
    "apiVersion": "2.22",
    "tokenServiceUrl": "https://t1api.inoviopay.com/payment/token_service.cfm"
  }
}
```

## Test Cards

Use these test cards for testing the tokenization flow:

| Card Number | Expiry | CVV | Notes |
|-------------|--------|-----|-------|
| 409159111111111 | 1229 | 123 | Test card with valid BIN - signature verification will succeed |

**Note:** This test card uses a valid 6-digit BIN (409159) which allows signature verification to succeed.

## Integration Examples

### cURL

```bash
curl -X POST http://localhost:3000/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"cardPan": "409159111111111"}'
```

### JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:3000/api/generate-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cardPan: '409159111111111'
  })
});

const data = await response.json();
console.log('Token:', data.token.TOKEN_GUID);
```

### Node.js/Axios

```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:3000/api/generate-token', {
  cardPan: '409159111111111'
});

console.log('Token:', response.data.token.TOKEN_GUID);
```

## Signature Implementation

### Request Signature

The request signature is generated using HMAC-SHA256:

```
Message: TIMESTAMP + UNIQUE_ID + SITE_ID
Signature: HMAC-SHA256(SECRET_KEY, Message)
```

**Example:**
```javascript
const timestamp = '20251103170000';
const uniqueId = 'abc123...';
const siteId = '9201';
const secretKey = 'your_secret_key';

const message = timestamp + uniqueId + siteId;
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(message)
  .digest('hex');
```

### Response Signature Verification

The response signature is verified using:

```
Message: SERVER_TIMESTAMP + TOKEN_REQID + JSON_BODY
Expected: HMAC-SHA256(SECRET_KEY, Message)
```

**Important:** Trim any trailing whitespace from the response body before verification.

**Example:**
```javascript
const serverTimestamp = responseHeaders['x-timestamp'];
const serverSignature = responseHeaders['x-signature'];
const tokenReqId = responseData.TOKEN_REQID;
const responseBody = rawResponseBody.trim();

const message = serverTimestamp + tokenReqId + responseBody;
const expectedSignature = crypto
  .createHmac('sha256', secretKey)
  .update(message)
  .digest('hex')
  .toUpperCase();

const isValid = expectedSignature === serverSignature.toUpperCase();
```

## Web Interface

The included web interface provides a complete payment form for testing:

1. Navigate to `http://localhost:3000`
2. Enter card number (auto-tokenizes on blur)
3. Complete expiry and CVV fields
4. Submit payment

The interface demonstrates:
- Real-time tokenization
- Token display in UI
- Error handling
- Complete payment flow

## Project Structure

```
tokenization/
├── server.js              # Express API server with signature logic
├── package.json           # Node.js dependencies
├── .env                   # Environment configuration (create from .env.example)
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Docker composition
└── public/
    └── index.html        # Web test interface
```

## Security Best Practices

1. **Never expose SECRET_KEY client-side** - All signature generation must happen server-side
2. **Use HTTPS in production** - Never send sensitive data over HTTP
3. **Validate timestamps** - Reject requests outside the tolerance window
4. **Store credentials securely** - Use environment variables, never hardcode
5. **Single-use tokens** - Each token should be used only once
6. **PCI compliance** - Never log or store full card numbers

## Using the Token for Payments

After obtaining a token, use it to process a payment:

```bash
curl "https://api.inoviopay.com/payment/pmt_service.cfm" \
  -d "request_action=CCAUTHCAP" \
  -d "request_api_version=3.9" \
  -d "req_username=your_username" \
  -d "req_password=your_password" \
  -d "site_id=9201" \
  -d "TOKEN_GUID=DE1178E5CECC8A49286280220D9844F386AC7FBF" \
  -d "PMT_KEY=123" \
  -d "PMT_EXPIRY=1229" \
  -d "MERCH_ACCT_ID=your_merchant_account" \
  -d "li_value_1=10.00" \
  -d "li_prod_id_1=PRODUCT001" \
  -d "request_response_format=JSON"
```

## Troubleshooting

### Signature Verification Fails
- Verify `SECRET_KEY` is correct
- Ensure `SITE_ID` matches your Inovio account
- Check that timestamps are within 300 second window
- Confirm response body is trimmed before verification

### Connection Issues
- Verify the token service URL is correct
- Check network connectivity to Inovio endpoints
- Review firewall rules for outbound HTTPS

### Docker Issues
```bash
# View logs
docker-compose logs -f

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check container status
docker-compose ps
```

## Support

For integration assistance:
- Review the code in `server.js` for implementation details
- Check logs for detailed signature debugging
- Contact Inovio support with your site ID

## License

Internal Inovio reference implementation
