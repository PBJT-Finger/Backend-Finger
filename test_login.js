const http = require('http');

const data = JSON.stringify({ email: 'bajategal@gmail.com', password: 'Password123' });

const options = {
  hostname: 'localhost',
  port: 3333,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', (error) => console.error('Error:', error));
req.write(data);
req.end();
