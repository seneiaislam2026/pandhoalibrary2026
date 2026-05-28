import http from 'http';
const path = `/smsapi?api_key=b163c415ae08e35e24d846a549107f87ccb076e3df87894632198bbce3e055ec&type=voice&contacts=8801700000000&senderid=8809649529683&msg=test`;
http.get(`http://103.170.231.10${path}`, (res) => {
  let d = ''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(res.statusCode, d));
});
