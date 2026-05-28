import http from 'http';

const options = {
    hostname: '103.170.231.10',
    port: 80,
    path: '/',
    method: 'GET',
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            console.log("Status:", res.statusCode);
            console.log("Headers:", res.headers);
            console.log("Body:", rawData.substring(0, 500));
        } catch (e) {
            console.error(e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
req.end();
