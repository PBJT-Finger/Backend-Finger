// Test for log redaction functionality
const { redactSensitiveData, redactUrl } = require('../../src/utils/logRedactor');

console.log('=== Testing Log Redaction ===\n');

// Test 1: Basic sensitive data redaction
const testData1 = {
    username: 'admin',
    password: 'secret123',
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiJ9.xyz',
    api_key: 'sk_live_abc123def456',
    email: 'user@example.com'
};

console.log('Test 1: Basic Redaction');
console.log('Before:', testData1);
console.log('After:', redactSensitiveData(testData1));
console.log();

// Test 2: Nested objects
const testData2 = {
    user: {
        id: 1,
        username: 'admin',
        credentials: {
            password: 'verysecret',
            refresh_token: 'abc123xyz'
        }
    },
    request: {
        headers: {
            authorization: 'Bearer token123'
        }
    }
};

console.log('Test 2: Nested Objects');
console.log('Before:', JSON.stringify(testData2, null, 2));
console.log('After:', JSON.stringify(redactSensitiveData(testData2), null, 2));
console.log();

// Test 3: Arrays
const testData3 = [
    { username: 'user1', password: 'pass1' },
    { username: 'user2', api_key: 'key123' }
];

console.log('Test 3: Arrays');
console.log('Before:', testData3);
console.log('After:', redactSensitiveData(testData3));
console.log();

// Test 4: URL redaction
const testUrl = 'https://api.example.com/auth?token=abc123&user=admin&password=secret';
console.log('Test 4: URL Redaction');
console.log('Before:', testUrl);
console.log('After:', redactUrl(testUrl));
console.log();

console.log('✅ All redaction tests completed');
