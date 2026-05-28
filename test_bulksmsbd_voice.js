import https from 'https';
https.get(`https://bulksmsbd.net/api/voiceapi`, res => {
  let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(res.statusCode, d));
});
