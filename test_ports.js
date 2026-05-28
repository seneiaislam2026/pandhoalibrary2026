import http from 'http';
const ports = [80, 443, 8080, 8000, 8888, 3000, 5000];
ports.forEach(port => {
  const req = http.get(`http://103.170.231.10:${port}/`, (res) => {
    console.log(`Port ${port} OPEN, Status: ${res.statusCode}`);
  });
  req.on('error', () => { /* ignore */ });
  req.setTimeout(2000, () => req.abort());
});
