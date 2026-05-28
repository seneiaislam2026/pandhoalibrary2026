const http = require('http');

http.get('http://103.170.231.10', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk.toString().substring(0, 500)}`);
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
