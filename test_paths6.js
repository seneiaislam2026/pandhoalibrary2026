import http from 'http';
http.get(`http://103.170.231.10/v1/call`, res => {
  let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(res.statusCode, d));
});
