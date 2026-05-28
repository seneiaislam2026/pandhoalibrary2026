import http from 'http';

const checkPath = (path) => {
  return new Promise((resolve) => {
    http.get(`http://103.170.231.10${path}`, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, body: rawData.substring(0, 100) });
      });
    }).on('error', () => resolve({ path, status: 'ERROR', body: '' }));
  });
};

async function run() {
  const paths = [
    '/api/v3/voice',
    '/api/v3/call',
    '/api/v3/sms/send',
    '/api/v3/voice/send'
  ];
  for (const p of paths) {
    const res = await checkPath(p);
    console.log(`Path: ${p} - Status: ${res.status} - Body: ${res.body}`);
  }
}
run();
