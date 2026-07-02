import http from 'http';
import { env } from 'process';

const token = ''; // No token, but device/users/pull needs authentication! Wait!

http.get('http://localhost:3333/api/employees?limit=100', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
        } catch (e) {
            console.log("Error parsing:", e);
        }
    });
}).on('error', (e) => {
    console.error("HTTP error:", e);
});
