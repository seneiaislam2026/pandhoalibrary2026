import http from 'http';

const checkPath = (path) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      api_key: 'b163c415ae08e35e24d846a549107f87ccb076e3df87894632198bbce3e055ec',
      sender_id: '+8809649529683',
      number: '8801700000000',
      to: '8801700000000',
      contact: '8801700000000'
    });
    const req = http.request({
        hostname: '103.170.231.10',
        port: 80,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, body: rawData.substring(0, 100) });
      });
    });
    req.on('error', () => resolve({ path, status: 'ERROR', body: '' }));
    req.write(data);
    req.end();
  });
};

async function run() {
  const paths = [
    '/api/call',
    '/api/v1/call',
    '/api/voice',
    '/api/voice-call',
    '/api/send',
    '/api/voice/send'
  ];
  for (const p of paths) {
    const res = await checkPath(p);
    console.log(`POST Path: ${p} - Status: ${res.status} - Body: ${res.body}`);
  }
}
run();
