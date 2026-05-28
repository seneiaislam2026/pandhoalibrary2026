const apiKey = "T445ZnbHEELavHNv3Tdw";
const senderIdUrlEncoded = encodeURIComponent("+8809617634384");
const senderIdPlain = "8809617634384";

async function test(senderId, domain) {
  const url = `https://${domain}/api/smsapi?api_key=${apiKey}&type=unicode&number=8801700000000&senderid=${senderId}&message=test`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[${domain} | ${senderId}] Status:`, res.status, text);
  } catch (e) {
    console.error(`[${domain} | ${senderId}] Error:`, e.message);
  }
}

async function run() {
  await test(senderIdPlain, 'bulksmsbd.net');
  await test(senderIdPlain, 'bulksmsbd.com');
  await test(senderIdUrlEncoded, 'bulksmsbd.net');
  await test(senderIdUrlEncoded, 'bulksmsbd.com');
}

run();
