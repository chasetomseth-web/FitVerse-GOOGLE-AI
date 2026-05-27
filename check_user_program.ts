import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkUserProgram() {
  const usersRef = collection(db, 'users');
  const qUser = query(usersRef, where('email', '==', 'chasetomseth@gmail.com'), limit(1));
  const userSnap = await getDocs(qUser);
  
  if (userSnap.empty) {
    console.log('User not found');
    return;
  }
  
  const uid = userSnap.docs[0].id;
  console.log('User UID:', uid);
  
  const programsRef = collection(db, 'users', uid, 'training_programs');
  const qProg = query(programsRef, where('status', '==', 'active'), limit(1));
  const progSnap = await getDocs(qProg);
  
  if (progSnap.empty) {
    console.log('No active program found');
    return;
  }
  
  const program = progSnap.docs[0].data();
  console.log('Active Program:', program.programName);
  
  // Check first week, first session
  if (program.weeks && program.weeks.length > 0) {
    const session = program.weeks[0].sessions[0];
    console.log('First Session Focus:', session.sessionFocus);
    session.blocks.forEach((block: any, i: number) => {
      console.log(`Block ${i} (${block.type}):`);
      block.exercises.forEach((ex: any) => {
        console.log(`- ${ex.name}`);
      });
    });
  }
}

checkUserProgram();
