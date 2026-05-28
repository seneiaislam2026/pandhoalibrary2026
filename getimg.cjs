const https = require('https');

https.get('https://ibb.co.com/Jj7yRpJ3', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const match = data.match(/<meta property="og:image" content="(.*?)"/i);
    if (match) {
      console.log(match[1]);
    } else {
      console.log('Not found');
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
