import http from 'http';
const hosts = [
  'sip.amarip.net', 'api.amarip.net', 'voice.amarip.net', 'portal.amarip.net',
  'ipt.sarkercommunication.com', 'bulksmsbd.net', 'api.bulksmsbd.net'
];
const paths = ['/api/v1/call', '/api/sms/send', '/api.php', '/api'];

hosts.forEach(host => {
  paths.forEach(path => {
    http.get({
      hostname: '103.170.231.10',
      port: 80,
      path: path,
      headers: { 'Host': host }
    }, res => {
      let d=''; res.on('data', c=>d+=c); res.on('end', () => {
         if(!d.includes("Endpoint not found")) {
             console.log(`Host: ${host}, Path: ${path} -> ${res.statusCode} : ${d.substring(0,60)}`);
         }
      });
    });
  });
});
