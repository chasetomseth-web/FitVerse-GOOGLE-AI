import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { DailyLog } from '../types';
import { format } from 'date-fns';
import { toCamelCase } from '../lib/db';

export const useDailyLog = () => {
  const { user } = useSupabase();
  const [log, setLogState] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) {
      setLogState(null);
      setLoading(false);
      return;
    }

    const fetchLog = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .maybeSingle();

        if (error) throw error;
        setLogState(data ? toCamelCase(data) as DailyLog : null);
      } catch (error) {
        handleSupabaseError(error, OperationType.GET, 'daily_logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLog();

    // For now, skip realtime subscriptions to avoid errors
    return () => {};
  }, [user, todayStr]);

  const setLog = async (updates: Partial<DailyLog>) => {
    if (!user) return;
    try {
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          acc[snakeKey] = value;
        }
        return acc;
      }, {} as any);

      if (Object.keys(cleanUpdates).length === 0) return;

      const { error } = await supabase
        .from('daily_logs')
        .upsert({
          ...cleanUpdates,
          user_id: user.id,
          date: todayStr
        });

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, 'daily_logs');
    }
  };

  return { log, loading, setLog };
};
