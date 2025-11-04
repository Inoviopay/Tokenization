# Running the Example Implementation

This guide explains how to run the included Node.js reference implementation of the Inovio tokenization API.

## Prerequisites

- Docker and Docker Compose (recommended), OR
- Node.js 18+ and npm
- Inovio API credentials (SECRET_KEY and SITE_ID)

## Quick Start

### Option 1: Docker (Recommended)

The easiest way to test the implementation:

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

### Option 2: Local Node.js Development

For development with auto-reload:

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start

# Or with auto-reload for development
npm run dev
```

## Configuration

Create a `.env` file in the project root with your Inovio credentials:

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

### Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Local server port | `3000` | No |
| `SECRET_KEY` | HMAC secret key from Inovio | `Password123` | Yes |
| `SITE_ID` | Your merchant site ID | `9201` | Yes |
| `API_VERSION` | API version (use 2.22) | `2.22` | Yes |
| `TOKEN_SERVICE_URL` | Tokenization endpoint | See above | Yes |
| `TIMESTAMP_TOLERANCE` | Timestamp validation window (seconds) | `300` | No |

## Project Structure

```
tokenization/
├── server.js              # Express API server with signature logic
├── package.json           # Node.js dependencies
├── .env                   # Environment configuration (create from .env.example)
├── .env.example           # Example environment variables
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Docker composition
└── public/
    └── index.html        # Web test interface
```

## Using the Web Interface

The included web interface provides a complete payment form for testing:

1. **Start the server** (using Docker or Node.js)
2. **Navigate to** `http://localhost:3000`
3. **Enter card number** - The form auto-tokenizes on blur
4. **Complete other fields** - Expiry date and CVV
5. **Submit payment** - See the complete flow in action

### What the Interface Demonstrates

- Real-time tokenization when card number loses focus
- Token display in UI (TOKEN_GUID)
- Card metadata display (brand, type, bank, country)
- Error handling and validation
- Complete payment flow simulation

### Test Cards

Use these test cards with the web interface:

| Card Number | Expiry | CVV | Notes |
|-------------|--------|-----|-------|
| 409159111111111 | 1229 | 123 | Valid BIN - signature verification succeeds |

**Note:** This test card uses a valid 6-digit BIN (409159) which allows signature verification to work properly.

## API Endpoints

The example server exposes these endpoints:

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

## Testing the Implementation

### Using cURL

```bash
curl -X POST http://localhost:3000/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"cardPan": "409159111111111"}'
```

### Using JavaScript/Fetch

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

### Using Node.js/Axios

```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:3000/api/generate-token', {
  cardPan: '409159111111111'
});

console.log('Token:', response.data.token.TOKEN_GUID);
```

## Troubleshooting

### Docker Issues

```bash
# View detailed logs
docker-compose logs -f

# Rebuild containers from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check container status
docker-compose ps

# Access container shell for debugging
docker-compose exec app sh
```

### Common Issues

#### Port Already in Use
```bash
# Change PORT in .env file or stop the conflicting service
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000 (macOS/Linux)
```

#### Environment Variables Not Loading
```bash
# Verify .env file exists and has correct format
cat .env

# Restart server after changing .env
npm start
# or
docker-compose restart
```

#### Cannot Connect to Inovio API
- Verify `TOKEN_SERVICE_URL` is correct
- Check network connectivity: `curl https://t1api.inoviopay.com`
- Review firewall rules for outbound HTTPS (port 443)
- Check proxy settings if behind corporate firewall

### Debugging Signature Issues

The example implementation includes detailed logging. Check the console/logs for:

```
Request signature details:
  Timestamp: 20251103170000
  Unique ID: abc123...
  Site ID: 9201
  Message: 20251103170000abc1239201
  Signature: a1b2c3d4...

Response signature details:
  Server timestamp: 20251103170005
  Token request ID: 29973496
  Response body: {"TOKEN_GUID":"..."}
  Expected signature: x1y2z3...
  Received signature: x1y2z3...
  Verification: PASS
```

## Code Reference

### Signature Generation (server.js:45-65)

The reference implementation shows how to generate request signatures:

```javascript
// UTC timestamp in format: YYYYMMDDHHmmss
const timestamp = new Date().toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, '')
  .replace('T', '');

// Random unique identifier
const uniqueId = crypto.randomBytes(32).toString('hex');

// Concatenate message components
const message = timestamp + uniqueId + siteId;

// Generate HMAC-SHA256 signature
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(message)
  .digest('hex');
```

### Response Verification (server.js:200-225)

The implementation demonstrates proper response signature verification:

```javascript
// Extract headers
const serverTimestamp = response.headers['x-timestamp'];
const serverSignature = response.headers['x-signature'];

// CRITICAL: Trim trailing whitespace from response body
const responseBody = rawResponseText.trim();

// Parse to get TOKEN_REQID
const responseData = JSON.parse(responseBody);
const tokenReqId = responseData.TOKEN_REQID;

// Reconstruct message for verification
const verificationMessage = serverTimestamp + tokenReqId + responseBody;

// Calculate expected signature
const expectedSignature = crypto
  .createHmac('sha256', secretKey)
  .update(verificationMessage)
  .digest('hex')
  .toUpperCase();

// Compare signatures (case-insensitive)
const isValid = expectedSignature === serverSignature.toUpperCase();
```

## Development Tips

1. **Use nodemon for auto-reload** - Run `npm run dev` to automatically restart on code changes
2. **Enable debug logging** - Set `DEBUG=*` environment variable for verbose output
3. **Test signature logic separately** - The signature functions are isolated and can be unit tested
4. **Check response encoding** - The example handles ISO-8859-1 encoding from Inovio

## Next Steps

Once you have the example running:

1. Study the signature generation logic in `server.js:45-65`
2. Review the response verification code in `server.js:200-225`
3. Experiment with the test card in the web interface
4. Adapt the code patterns to your target language/framework
5. Refer to the main README.md for detailed API integration guide

## Support

For issues with the example implementation:
- Check the troubleshooting section above
- Review server logs for detailed error messages
- Ensure environment variables are configured correctly

For API integration questions, refer to the main [README.md](README.md).
