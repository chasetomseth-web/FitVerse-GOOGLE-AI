import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { DailyLog } from '../types';
import { format } from 'date-fns';

export const useDailyLog = () => {
  const { user } = useFirebase();
  const [log, setLogState] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) {
      setLogState(null);
      setLoading(false);
      return;
    }

    const logRef = doc(db, 'users', user.uid, 'daily_logs', todayStr);
    const unsubscribe = onSnapshot(logRef, (snap) => {
      if (snap.exists()) {
        setLogState(snap.data() as DailyLog);
      } else {
        setLogState(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/daily_logs/${todayStr}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, todayStr]);

  const setLog = async (updates: Partial<DailyLog>) => {
    if (!user) return;
    try {
      // Filter out undefined values
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      const logRef = doc(db, 'users', user.uid, 'daily_logs', todayStr);
      await setDoc(logRef, {
        ...cleanUpdates,
        uid: user.uid,
        date: todayStr
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/daily_logs/${todayStr}`);
    }
  };

  return { log, loading, setLog };
};
