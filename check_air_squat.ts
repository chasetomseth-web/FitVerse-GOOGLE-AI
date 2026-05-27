import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkAirSquat() {
  const docRef = doc(db, 'exercise_library', 'air_squat');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log('Air Squat Data:', JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('Air Squat not found in library');
  }
}

checkAirSquat();
