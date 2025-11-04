# Inovio Tokenization API - Integration Guide

A comprehensive guide for integrating with the Inovio tokenization API using HMAC-SHA256 request signatures.

## Overview

The Inovio tokenization API allows you to securely convert credit card numbers (PANs) into single-use tokens that can be used for payment processing. This approach:

- **Reduces PCI compliance scope** - Card numbers never touch your servers
- **Enhances security** - Tokens are single-use and cannot be reversed to obtain the original PAN
- **Enables secure storage** - Store tokens instead of card numbers for recurring payments
- **Maintains card metadata** - Receive brand, type, bank, and country information with each token

## Prerequisites

To integrate with the Inovio tokenization API, you need:

| Requirement | Description | How to Obtain |
|-------------|-------------|---------------|
| **Secret Key** | HMAC signing key for request authentication | Provided by Inovio during onboarding |
| **Site ID** | Your merchant identifier | Provided by Inovio during onboarding |
| **HTTPS Client** | HTTP library capable of GET/POST requests | Any standard HTTP client library |
| **Crypto Library** | HMAC-SHA256 implementation | Built into most languages (Node.js crypto, Python hashlib, Java javax.crypto) |

**For testing:** A complete Node.js reference implementation is included. See [RUNNING_EXAMPLE.md](RUNNING_EXAMPLE.md) for setup instructions.

## Understanding Tokenization

### What is Tokenization?

Tokenization replaces a sensitive card number (PAN) with a non-sensitive token (TOKEN_GUID) that can be safely transmitted and stored. The token maintains a reference to the original card data in Inovio's secure vault.

### When to Tokenize

Tokenize cards in these scenarios:

1. **Real-time payment forms** - Tokenize when the user completes card entry (on blur/submit)
2. **Stored payment methods** - Tokenize and store the TOKEN_GUID for future use
3. **Recurring payments** - Tokenize once, reuse the token for subsequent charges
4. **Marketplace platforms** - Tokenize cards before routing to sub-merchants

### Tokenization Flow

```
1. User enters card number (PAN) in your application
2. Your server generates HMAC-SHA256 signature
3. Your server requests token from Inovio API
4. Inovio validates signature and returns token + metadata
5. Your server verifies response signature
6. Your application uses token for payment processing
```

**Important:** All signature operations MUST occur server-side. Never expose your SECRET_KEY to client-side code.

## Signature Generation

The Inovio API uses HMAC-SHA256 signatures to authenticate requests and responses. Understanding this process is critical for successful integration.

### Request Signature Algorithm

**Pseudo-code:**
```
timestamp = current_utc_time_formatted_as_YYYYMMDDHHmmss()
unique_id = random_hex_string(64_characters)
site_id = your_site_id_from_inovio

message = timestamp + unique_id + site_id
signature = hmac_sha256(secret_key, message).to_hex().to_lowercase()
```

**Detailed Steps:**

1. **Generate UTC Timestamp**
   - Format: `YYYYMMDDHHmmss` (14 digits, no separators)
   - Example: `20251103170000` represents November 3, 2025 at 17:00:00 UTC
   - Must be within 300 seconds of Inovio server time (default tolerance)

2. **Generate Unique ID**
   - 64-character hexadecimal string
   - Must be unique for each request
   - Use cryptographically secure random number generator

3. **Concatenate Message**
   - Order matters: `timestamp + unique_id + site_id`
   - No separators between components
   - Example: `20251103170000abc123...def456789201`

4. **Generate HMAC-SHA256**
   - Key: Your SECRET_KEY (provided by Inovio)
   - Message: Concatenated string from step 3
   - Output: Hex-encoded signature (lowercase)

### Multi-Language Examples

#### JavaScript (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(secretKey, siteId) {
  // 1. Generate UTC timestamp
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '');

  // 2. Generate unique ID
  const uniqueId = crypto.randomBytes(32).toString('hex');

  // 3. Concatenate message
  const message = timestamp + uniqueId + siteId;

  // 4. Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return { timestamp, uniqueId, signature };
}

// Usage
const { timestamp, uniqueId, signature } = generateSignature('Password123', '9201');
```

#### Python

```python
import hashlib
import hmac
from datetime import datetime
import secrets

def generate_signature(secret_key, site_id):
    # 1. Generate UTC timestamp
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')

    # 2. Generate unique ID (64 hex characters)
    unique_id = secrets.token_hex(32)

    # 3. Concatenate message
    message = timestamp + unique_id + site_id

    # 4. Generate HMAC-SHA256 signature
    signature = hmac.new(
        secret_key.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return {
        'timestamp': timestamp,
        'unique_id': unique_id,
        'signature': signature
    }

# Usage
result = generate_signature('Password123', '9201')
```

#### Java

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

public class InovioSignature {

    public static Map<String, String> generateSignature(String secretKey, String siteId)
            throws Exception {
        // 1. Generate UTC timestamp
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
            .withZone(ZoneOffset.UTC);
        String timestamp = formatter.format(Instant.now());

        // 2. Generate unique ID (64 hex characters)
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        StringBuilder uniqueId = new StringBuilder();
        for (byte b : bytes) {
            uniqueId.append(String.format("%02x", b));
        }

        // 3. Concatenate message
        String message = timestamp + uniqueId.toString() + siteId;

        // 4. Generate HMAC-SHA256 signature
        Mac hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(), "HmacSHA256");
        hmac.init(keySpec);
        byte[] signatureBytes = hmac.doFinal(message.getBytes());

        StringBuilder signature = new StringBuilder();
        for (byte b : signatureBytes) {
            signature.append(String.format("%02x", b));
        }

        Map<String, String> result = new HashMap<>();
        result.put("timestamp", timestamp);
        result.put("uniqueId", uniqueId.toString());
        result.put("signature", signature.toString());

        return result;
    }

    // Usage
    public static void main(String[] args) throws Exception {
        Map<String, String> result = generateSignature("Password123", "9201");
        System.out.println("Signature: " + result.get("signature"));
    }
}
```

### Common Pitfalls

⚠️ **Timestamp Format** - Must be UTC, not local time. Many signature failures are caused by timezone issues.

⚠️ **Message Order** - Components must be concatenated as: `timestamp + uniqueId + siteId`. Different order = different signature.

⚠️ **Signature Case** - Request signature should be lowercase hex. Response verification is case-insensitive.

⚠️ **Unique ID Length** - Must be exactly 64 hexadecimal characters (32 random bytes).

## Making Token Requests

### API Endpoint

```
GET https://t1api.inoviopay.com/payment/token_service.cfm
```

### Required Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `timestamp` | UTC timestamp from signature generation | `20251103170000` |
| `uniqueId` | Random identifier from signature generation | `abc123...` (64 chars) |
| `signature` | HMAC-SHA256 signature | `a1b2c3d4e5f6...` |
| `siteId` | Your merchant site ID | `9201` |
| `apiVersion` | API version (use 2.22) | `2.22` |
| `cardPan` | Credit card number (no spaces/dashes) | `409159111111111` |

### Request Examples

#### cURL

```bash
# First, generate signature components (use code from previous section)
TIMESTAMP="20251103170000"
UNIQUE_ID="abc123def456..." # 64 hex characters
SIGNATURE="a1b2c3d4e5f6..." # Generated HMAC-SHA256

curl -X GET "https://t1api.inoviopay.com/payment/token_service.cfm?\
timestamp=${TIMESTAMP}&\
uniqueId=${UNIQUE_ID}&\
signature=${SIGNATURE}&\
siteId=9201&\
apiVersion=2.22&\
cardPan=409159111111111"
```

#### JavaScript (Node.js with axios)

```javascript
const axios = require('axios');

async function tokenizeCard(secretKey, siteId, cardPan) {
  // Generate signature
  const { timestamp, uniqueId, signature } = generateSignature(secretKey, siteId);

  // Make request
  const response = await axios.get('https://t1api.inoviopay.com/payment/token_service.cfm', {
    params: {
      timestamp,
      uniqueId,
      signature,
      siteId,
      apiVersion: '2.22',
      cardPan
    },
    transformResponse: [(data) => data] // Get raw response for signature verification
  });

  return {
    data: JSON.parse(response.data.trim()),
    headers: response.headers
  };
}

// Usage
const result = await tokenizeCard('Password123', '9201', '409159111111111');
console.log('Token:', result.data.TOKEN_GUID);
```

#### Python (with requests)

```python
import requests

def tokenize_card(secret_key, site_id, card_pan):
    # Generate signature
    sig_data = generate_signature(secret_key, site_id)

    # Make request
    response = requests.get(
        'https://t1api.inoviopay.com/payment/token_service.cfm',
        params={
            'timestamp': sig_data['timestamp'],
            'uniqueId': sig_data['unique_id'],
            'signature': sig_data['signature'],
            'siteId': site_id,
            'apiVersion': '2.22',
            'cardPan': card_pan
        }
    )

    return {
        'data': response.json(),
        'headers': response.headers
    }

# Usage
result = tokenize_card('Password123', '9201', '409159111111111')
print('Token:', result['data']['TOKEN_GUID'])
```

#### Java (with HttpClient)

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.google.gson.Gson;

public class TokenRequest {

    public static TokenResponse tokenizeCard(String secretKey, String siteId, String cardPan)
            throws Exception {
        // Generate signature
        Map<String, String> sigData = InovioSignature.generateSignature(secretKey, siteId);

        // Build URL with parameters
        String url = String.format(
            "https://t1api.inoviopay.com/payment/token_service.cfm?" +
            "timestamp=%s&uniqueId=%s&signature=%s&siteId=%s&apiVersion=2.22&cardPan=%s",
            sigData.get("timestamp"),
            sigData.get("uniqueId"),
            sigData.get("signature"),
            siteId,
            cardPan
        );

        // Make request
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .build();

        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());

        // Parse response
        Gson gson = new Gson();
        TokenData data = gson.fromJson(response.body().trim(), TokenData.class);

        return new TokenResponse(data, response.headers());
    }
}
```

## Response Handling

### Response Structure

**Success Response:**
```json
{
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
```

### Response Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Timestamp` | Server timestamp when response generated | `20251103170005` |
| `X-Signature` | HMAC-SHA256 signature of response | `A1B2C3D4E5F6...` |

### Response Signature Verification

**Why Verify:** Response signature verification ensures the response came from Inovio and hasn't been tampered with.

**Pseudo-code:**
```
server_timestamp = response_headers['X-Timestamp']
server_signature = response_headers['X-Signature']
response_body = trim_whitespace(raw_response_body)
token_req_id = parse_json(response_body)['TOKEN_REQID']

message = server_timestamp + token_req_id + response_body
expected_signature = hmac_sha256(secret_key, message).to_hex().to_uppercase()

is_valid = (expected_signature == server_signature.to_uppercase())
```

**Critical Steps:**

1. **Extract Headers** - Get `X-Timestamp` and `X-Signature` from response headers
2. **Trim Response Body** - Remove trailing whitespace/newlines from raw response text
3. **Parse TOKEN_REQID** - Extract from the JSON response body
4. **Concatenate Message** - `server_timestamp + token_req_id + response_body`
5. **Calculate Expected Signature** - HMAC-SHA256 of the message
6. **Compare** - Case-insensitive comparison of expected vs received signature

### Verification Examples

#### JavaScript (Node.js)

```javascript
const crypto = require('crypto');

function verifyResponseSignature(secretKey, responseHeaders, rawResponseBody) {
  // 1. Extract headers
  const serverTimestamp = responseHeaders['x-timestamp'];
  const serverSignature = responseHeaders['x-signature'];

  // 2. CRITICAL: Trim trailing whitespace
  const responseBody = rawResponseBody.trim();

  // 3. Parse TOKEN_REQID
  const responseData = JSON.parse(responseBody);
  const tokenReqId = responseData.TOKEN_REQID.toString();

  // 4. Concatenate message
  const message = serverTimestamp + tokenReqId + responseBody;

  // 5. Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex')
    .toUpperCase();

  // 6. Compare (case-insensitive)
  const isValid = expectedSignature === serverSignature.toUpperCase();

  return {
    isValid,
    expectedSignature,
    receivedSignature: serverSignature
  };
}

// Usage
const verification = verifyResponseSignature(
  'Password123',
  response.headers,
  rawResponseText
);

if (!verification.isValid) {
  throw new Error('Signature verification failed');
}
```

#### Python

```python
import hashlib
import hmac
import json

def verify_response_signature(secret_key, response_headers, raw_response_body):
    # 1. Extract headers
    server_timestamp = response_headers['X-Timestamp']
    server_signature = response_headers['X-Signature']

    # 2. CRITICAL: Trim trailing whitespace
    response_body = raw_response_body.strip()

    # 3. Parse TOKEN_REQID
    response_data = json.loads(response_body)
    token_req_id = str(response_data['TOKEN_REQID'])

    # 4. Concatenate message
    message = server_timestamp + token_req_id + response_body

    # 5. Calculate expected signature
    expected_signature = hmac.new(
        secret_key.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest().upper()

    # 6. Compare (case-insensitive)
    is_valid = expected_signature.upper() == server_signature.upper()

    return {
        'is_valid': is_valid,
        'expected_signature': expected_signature,
        'received_signature': server_signature
    }

# Usage
verification = verify_response_signature(
    'Password123',
    response.headers,
    response.text
)

if not verification['is_valid']:
    raise Exception('Signature verification failed')
```

#### Java

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class SignatureVerifier {

    public static VerificationResult verifyResponseSignature(
            String secretKey,
            Map<String, List<String>> headers,
            String rawResponseBody) throws Exception {

        // 1. Extract headers
        String serverTimestamp = headers.get("X-Timestamp").get(0);
        String serverSignature = headers.get("X-Signature").get(0);

        // 2. CRITICAL: Trim trailing whitespace
        String responseBody = rawResponseBody.trim();

        // 3. Parse TOKEN_REQID
        Gson gson = new Gson();
        TokenData data = gson.fromJson(responseBody, TokenData.class);
        String tokenReqId = String.valueOf(data.TOKEN_REQID);

        // 4. Concatenate message
        String message = serverTimestamp + tokenReqId + responseBody;

        // 5. Calculate expected signature
        Mac hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(), "HmacSHA256");
        hmac.init(keySpec);
        byte[] signatureBytes = hmac.doFinal(message.getBytes());

        StringBuilder expectedSignature = new StringBuilder();
        for (byte b : signatureBytes) {
            expectedSignature.append(String.format("%02x", b));
        }
        String expected = expectedSignature.toString().toUpperCase();

        // 6. Compare (case-insensitive)
        boolean isValid = expected.equalsIgnoreCase(serverSignature);

        return new VerificationResult(isValid, expected, serverSignature);
    }
}
```

### Critical Verification Gotchas

⚠️ **Trailing Whitespace** - The Inovio API may append trailing newlines to the response body. You MUST trim the response before verification, or signatures will not match.

⚠️ **Response Body Encoding** - The raw response body (not the parsed JSON) must be used in signature calculation.

⚠️ **TOKEN_REQID as String** - Convert TOKEN_REQID to string before concatenation, even though it's a number in the JSON.

⚠️ **Message Order** - Must be: `serverTimestamp + tokenReqId + responseBody` (not request timestamp).

## Error Handling

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| `200` | Success | Verify response signature, extract token |
| `400` | Bad Request | Check parameter formatting |
| `401` | Unauthorized | Verify signature generation logic |
| `500` | Server Error | Retry with exponential backoff |

### Inovio Error Codes

When the API returns an error, the response will contain error details:

```json
{
  "ERROR_CODE": "121",
  "ERROR_MESSAGE": "Invalid signature"
}
```

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `121` | Invalid signature | Verify SECRET_KEY, check timestamp format, ensure message concatenation order |
| `406` | Timestamp out of tolerance | Synchronize server time with NTP, check timestamp generation logic |
| `502` | Invalid card number | Verify cardPan format (digits only, no spaces/dashes), check Luhn algorithm |
| `503` | Missing required parameter | Ensure all required parameters are included in request |

### Debugging Signature Failures

If signature verification consistently fails:

1. **Log all components:**
   ```
   Timestamp: 20251103170000
   Unique ID: abc123...
   Site ID: 9201
   Message: 20251103170000abc123...9201
   Signature: a1b2c3d4...
   ```

2. **Verify timestamp is UTC** - Not local time
3. **Check message concatenation** - No spaces, correct order
4. **Confirm SECRET_KEY** - No extra spaces or hidden characters
5. **Test with known values** - Use the reference implementation to generate a known-good signature

### Retry Strategy

For transient errors (500, network timeouts):

```javascript
async function tokenizeWithRetry(secretKey, siteId, cardPan, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await tokenizeCard(secretKey, siteId, cardPan);
    } catch (error) {
      if (attempt === maxRetries || error.response?.status < 500) {
        throw error; // Don't retry client errors or if max retries reached
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Security Best Practices

### Critical Requirements

1. **Never expose SECRET_KEY client-side**
   - ❌ Don't include in JavaScript bundles
   - ❌ Don't send to browser in any form
   - ✅ Keep on server, use server-side API endpoint

2. **Use HTTPS in production**
   - All requests to Inovio must use HTTPS
   - Your tokenization endpoint must use HTTPS
   - Never send card data over HTTP

3. **Validate timestamps**
   - Reject requests with timestamps outside tolerance window
   - Default tolerance: 300 seconds (5 minutes)
   - Prevents replay attacks

4. **Single-use tokens**
   - Each token should be used for one transaction only
   - For recurring payments, tokenize on file and reuse the same token
   - Do not tokenize the same card multiple times unnecessarily

5. **Never log full card numbers**
   - Log only last 4 digits for debugging
   - PCI DSS prohibits storing full PAN
   - Tokens can be safely logged

### Secure Integration Pattern

```javascript
// ❌ INSECURE: Client-side signature generation
// Browser JavaScript
const signature = generateSignature(secretKey, siteId); // SECRET_KEY exposed!

// ✅ SECURE: Server-side tokenization endpoint
// Client (Browser JavaScript)
async function tokenizeCard(cardNumber) {
  const response = await fetch('/api/tokenize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardPan: cardNumber })
  });
  return response.json();
}

// Server (Node.js/Express)
app.post('/api/tokenize', async (req, res) => {
  const { cardPan } = req.body;

  // SECRET_KEY stays on server
  const token = await tokenizeCard(process.env.SECRET_KEY, process.env.SITE_ID, cardPan);

  res.json({ token: token.TOKEN_GUID });
});
```

### PCI Compliance Considerations

Tokenization significantly reduces PCI scope, but you must still:

- Use HTTPS for all card data transmission
- Never store full card numbers (even temporarily)
- Log tokens, not PANs
- Implement proper access controls
- Regularly rotate credentials

## Using Tokens for Payments

Once you have a token, use it in place of the card number for payment processing:

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

**Note:** TOKEN_GUID replaces the card number. You still need the CVV (PMT_KEY) and expiry date for payment processing.

For complete payment API documentation, refer to the Inovio Payment API guide.

## Testing Your Integration

### Test Credentials

For testing, use these credentials (provided by Inovio):

- **Site ID:** `9201`
- **Secret Key:** `Password123`
- **API Version:** `2.22`

### Test Cards

| Card Number | Brand | Expiry | CVV | Notes |
|-------------|-------|--------|-----|-------|
| 409159111111111 | MasterCard | 1229 | 123 | Valid BIN - signature verification succeeds |

**Note:** This test card uses a valid 6-digit BIN (409159) which allows proper tokenization and signature verification.

### Manual Testing with cURL

1. **Generate signature components** using one of the code examples above
2. **Make the request:**

```bash
curl -v "https://t1api.inoviopay.com/payment/token_service.cfm?\
timestamp=YOUR_TIMESTAMP&\
uniqueId=YOUR_UNIQUE_ID&\
signature=YOUR_SIGNATURE&\
siteId=9201&\
apiVersion=2.22&\
cardPan=409159111111111"
```

3. **Verify response** - Check for TOKEN_GUID in response
4. **Verify signature** - Use verification code to validate response signature

### Integration Checklist

- [ ] Signature generation produces consistent, valid signatures
- [ ] Timestamp is in UTC and properly formatted (YYYYMMDDHHmmss)
- [ ] Unique ID is 64 hexadecimal characters
- [ ] Request succeeds with test card
- [ ] Response signature verification passes
- [ ] Error handling works for invalid cards
- [ ] Timestamp tolerance is handled correctly
- [ ] SECRET_KEY is never exposed client-side
- [ ] All requests use HTTPS
- [ ] Tokens are used correctly in payment requests

## Reference Implementation

A complete, working Node.js implementation is included with this guide. It demonstrates:

- Server-side signature generation
- Tokenization request with proper error handling
- Response signature verification
- Web interface for testing

**To run the example:** See [RUNNING_EXAMPLE.md](RUNNING_EXAMPLE.md) for complete setup instructions.

**Code reference:** The implementation in `server.js` shows production-ready patterns for:
- Signature generation (`server.js:45-65`)
- API requests with proper headers (`server.js:150-180`)
- Response verification (`server.js:200-225`)
- Error handling (`server.js:100-130`)

## Support

### Integration Assistance

- **Technical documentation:** This guide and [RUNNING_EXAMPLE.md](RUNNING_EXAMPLE.md)
- **Code reference:** Review `server.js` for implementation patterns
- **Inovio support:** Contact with your Site ID for credential or API issues

### Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| "Invalid signature" error | Timestamp not UTC, wrong message order | Review signature generation section |
| Response verification fails | Trailing whitespace not trimmed | Use `.trim()` on raw response body |
| "Timestamp out of tolerance" | Server time skew | Sync server with NTP |
| No response / timeout | Network/firewall issue | Check HTTPS connectivity to Inovio |

---

**Ready to integrate?** Start with the [Signature Generation](#signature-generation) section above, then test using the [Reference Implementation](RUNNING_EXAMPLE.md).
