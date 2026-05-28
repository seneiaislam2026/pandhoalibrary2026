import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('./firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(collection(db, 'books'));
    console.log("Books found:", snap.size);
  } catch(e) {
    console.error("Firebase Error:", e);
  }
  process.exit();
}
run();
