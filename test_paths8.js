import http from 'http';
const paths = ['/api/v1/send-voice', '/api/send-voice', '/send-voice', '/api/voice-msg'];
paths.forEach(p => {
  http.get(`http://103.170.231.10${p}`, res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(p, res.statusCode, d.substring(0, 50)));
  });
})
