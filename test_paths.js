import http from 'http';

const checkPath = (path) => {
  return new Promise((resolve) => {
    http.get(`http://103.170.231.10${path}`, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, body: rawData.substring(0, 300) });
      });
    }).on('error', () => resolve({ path, status: 'ERROR' }));
  });
};

async function run() {
  const paths = [
    '/api',
    '/api/v1',
    '/api/v1/call',
    '/api/voice',
    '/api/voice/call',
    '/call',
    '/voice',
    '/smsapi',
    '/api.php',
    '/voiceapi',
    '/api/v1/voice',
    '/voice/api',
    '/api/call',
    '/voicecall',
    '/api/voice_call',
    '/api/voicecall',
    '/apiv1',
    '/sys/voice',
    '/api/v1/voice_call',
    '/mbilling/api'
  ];
  for (const p of paths) {
    const res = await checkPath(p);
    if(res.status !== 404 && res.status !== 'ERROR') {
      console.log(`FOUND: ${p} - Status: ${res.status} - Body: ${res.body}`);
    } else {
        // console.log(`Not found: ${p} : ${res.status} - ${res.body}`);
        if(res.body && !res.body.includes("Endpoint not found")) {
            console.log(`Different body for ${p}: ${res.body}`);
        }
    }
  }
}
run();
