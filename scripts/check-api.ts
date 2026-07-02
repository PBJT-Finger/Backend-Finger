import http from 'http';

http.get('http://127.0.0.1:5000/api/device/users/pull', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.data && parsed.data.users) {
                const users = parsed.data.users;
                const melinda = users.find((u: any) => u.name && u.name.toLowerCase().includes('melinda'));
                if (melinda) {
                    console.log("Melinda found in live API response!");
                    console.log(JSON.stringify(melinda, null, 2));
                } else {
                    console.log("Melinda not found in API. Total users:", users.length);
                    console.log(JSON.stringify(users.slice(0, 3), null, 2));
                }
            } else {
                console.log("Unexpected response format:");
                console.log(JSON.stringify(parsed, null, 2));
            }
        } catch (e) {
            console.log("Error parsing backend at 5000:", e, data.substring(0, 100));
        }
    });
}).on('error', (e) => {
    console.error("HTTP error:", e);
});
