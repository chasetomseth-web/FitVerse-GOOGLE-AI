import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { TrainingProgram } from '../types';

export const useActiveProgram = () => {
  const { user } = useFirebase();
  const [activeProgram, setActiveProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setActiveProgram(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'training_programs'),
      where('status', '==', 'active'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveProgram({ id: snap.docs[0].id, ...snap.docs[0].data() } as TrainingProgram);
      } else {
        setActiveProgram(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/training_programs`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateProgram = async (updates: Partial<TrainingProgram>) => {
    if (!user || !activeProgram?.id) return;
    try {
      const programRef = doc(db, 'users', user.uid, 'training_programs', activeProgram.id);
      await setDoc(programRef, updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/training_programs/${activeProgram.id}`);
    }
  };

  return { activeProgram, loading, updateProgram };
};
