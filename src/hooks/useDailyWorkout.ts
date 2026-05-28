import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { DailyWorkoutState } from '../types';
import { format } from 'date-fns';
import { toCamelCase } from '../lib/db';

export const useDailyWorkout = (dateStr?: string) => {
  const { user } = useSupabase();
  const [workoutState, setWorkoutState] = useState<DailyWorkoutState | null>(null);
  const [loading, setLoading] = useState(true);

  const targetDate = dateStr || format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) {
      setWorkoutState(null);
      setLoading(false);
      return;
    }

    const fetchWorkout = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_workout_states')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', targetDate)
          .maybeSingle();

        if (error) throw error;
        setWorkoutState(data ? toCamelCase(data) as DailyWorkoutState : null);
      } catch (error) {
        handleSupabaseError(error, OperationType.GET, 'daily_workout_states');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkout();

    // For now, skip realtime subscriptions to avoid errors
    return () => {};
  }, [user, targetDate]);

  return { workoutState, loading };
};
