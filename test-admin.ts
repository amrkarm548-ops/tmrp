import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const db = new Firestore({
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId
});

async function main() {
  try {
    const coll = db.collection('config');
    const snapshot = await coll.get();
    console.log("Found config docs:", snapshot.size);
    snapshot.forEach(doc => console.log(doc.id));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
