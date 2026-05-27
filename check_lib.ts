import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkLibrary() {
  const libRef = collection(db, 'exercise_library');
  const snap = await getDocs(libRef);
  console.log('Total exercises in library:', snap.size);
  if (snap.size > 0) {
    console.log('First 5 exercises:');
    snap.docs.slice(0, 5).forEach(d => {
      console.log(`- ID: ${d.id}, Name: ${d.data().name}, Video: ${d.data().videoUrl ? 'YES' : 'NO'}`);
    });
  }
}

checkLibrary();
