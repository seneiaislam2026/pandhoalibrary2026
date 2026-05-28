import http from 'http';

const checkPath = (path, method) => {
  return new Promise((resolve) => {
    const req = http.request({
        hostname: '103.170.231.10',
        port: 80,
        path: path,
        method: method
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, body: rawData.substring(0, 100) });
      });
    });
    req.on('error', () => resolve({ path, status: 'ERROR', body: '' }));
    req.end();
  });
};

async function run() {
  const paths = [
    '/api/v1/call',
    '/api/v1/voice',
    '/api/call',
    '/api/voice',
    '/api/voice/send',
    '/api/voice_call',
    '/api/v1/make-call',
    '/api/make-call',
    '/api/voice-call'
  ];
  for (const p of paths) {
    const res = await checkPath(p, 'POST');
    console.log(`POST Path: ${p} - Status: ${res.status} - Body: ${res.body}`);
  }
}
run();
