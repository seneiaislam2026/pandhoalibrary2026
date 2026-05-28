import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, 'donor-members'), where('phone', '==', '01713414938'));
  const qs = await getDocs(q);
  for (const docSnap of qs.docs) {
    await updateDoc(docSnap.ref, { monthlyDonation: 200 });
  }
  console.log('Fixed Tito monthly donation to 200');
  process.exit(0);
}
run();
