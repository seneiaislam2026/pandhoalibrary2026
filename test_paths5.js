import http from 'http';
const paths = [
    '/api/v1/send-sms',
    '/api/v1/send_sms',
    '/api/send',
    '/send',
    '/api/v1/voice',
    '/api/voice',
    '/api/v1/call/send',
    '/api/call/send',
    '/api/campaign/send',
    '/api/v1/campaign/send'
];
for (const p of paths) {
  http.get(`http://103.170.231.10${p}`, res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(p, res.statusCode, d.substring(0, 50)));
  });
}
