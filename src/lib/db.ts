import { supabase } from './supabase';

// Helper to convert JavaScript object with camelCase keys to snake_case for Supabase
export function toSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const snakeCaseObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (value !== undefined) {
      snakeCaseObj[snakeKey] = value;
    }
  }

  return snakeCaseObj;
}

// Helper to convert snake_case from Supabase to camelCase for JS
export function toCamelCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const camelCaseObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.includes('_')) {
      const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = value;
    } else {
      camelCaseObj[key] = value;
    }
  }

  return camelCaseObj;
}

// Generic database operations
export const db = {
  // Users and profiles
  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async updateUser(userId: string, updates: Record<string, any>) {
    const { error } = await supabase
      .from('user_profiles')
      .update(toSnakeCase(updates))
      .eq('id', userId);

    if (error) throw error;
  },

  async createUser(userId: string, profile: Record<string, any>) {
    const { error } = await supabase
      .from('user_profiles')
      .insert({ id: userId, ...toSnakeCase(profile) });

    if (error) throw error;
  },

  // Daily logs
  async getDailyLog(userId: string, date: string) {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async upsertDailyLog(userId: string, date: string, updates: Record<string, any>) {
    const { error } = await supabase
      .from('daily_logs')
      .upsert({
        user_id: userId,
        date,
        ...toSnakeCase(updates)
      });

    if (error) throw error;
  },

  // Training programs
  async getActiveProgram(userId: string) {
    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async getProgramWithId(userId: string, programId: string) {
    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .eq('user_id', userId)
      .eq('id', programId)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async createProgram(userId: string, program: Record<string, any>) {
    const { data, error } = await supabase
      .from('training_programs')
      .insert({
        user_id: userId,
        ...toSnakeCase(program)
      })
      .select()
      .single();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async updateProgram(programId: string, updates: Record<string, any>) {
    const { error } = await supabase
      .from('training_programs')
      .update(toSnakeCase(updates))
      .eq('id', programId);

    if (error) throw error;
  },

  // Workout sessions
  async getWorkoutSession(sessionId: string) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async createWorkoutSession(userId: string, session: Record<string, any>) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        ...toSnakeCase(session)
      })
      .select()
      .single();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async updateWorkoutSession(sessionId: string, updates: Record<string, any>) {
    const { error } = await supabase
      .from('workout_sessions')
      .update(toSnakeCase(updates))
      .eq('id', sessionId);

    if (error) throw error;
  },

  // Daily workout states
  async getDailyWorkoutState(userId: string, date: string) {
    const { data, error } = await supabase
      .from('daily_workout_states')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async upsertDailyWorkoutState(userId: string, date: string, state: Record<string, any>) {
    const { error } = await supabase
      .from('daily_workout_states')
      .upsert({
        user_id: userId,
        date,
        ...toSnakeCase(state)
      });

    if (error) throw error;
  },

  // Body metrics
  async getBodyMetrics(userId: string, limit = 90) {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ? data.map(toCamelCase) : [];
  },

  async createBodyMetric(userId: string, metric: Record<string, any>) {
    const { error } = await supabase
      .from('body_metrics')
      .insert({
        user_id: userId,
        ...toSnakeCase(metric)
      });

    if (error) throw error;
  },

  // Achievements
  async getUserAchievements(userId: string) {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data ? data.map(toCamelCase) : [];
  },

  async createAchievement(userId: string, achievement: Record<string, any>) {
    const { error } = await supabase
      .from('achievements')
      .insert({
        user_id: userId,
        ...toSnakeCase(achievement)
      });

    if (error) throw error;
  },

  // Coach conversations
  async getCoachConversation(userId: string, date: string) {
    const { data, error } = await supabase
      .from('coach_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async upsertCoachConversation(userId: string, date: string, messages: any[]) {
    const { error } = await supabase
      .from('coach_conversations')
      .upsert({
        user_id: userId,
        date,
        messages
      });

    if (error) throw error;
  },

  // Exercise library
  async getExercise(exerciseId: string) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('id', exerciseId)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async searchExercises(query: string, limit = 20) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .or(`name.ilike.%${query}%,primary_muscle_group.ilike.%${query}%,movement_pattern.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data ? data.map(toCamelCase) : [];
  },

  async createExercise(exercise: Record<string, any>) {
    const { error } = await supabase
      .from('exercise_library')
      .insert(toSnakeCase(exercise));

    if (error) throw error;
  },

  // Weekly adaptations
  async getWeeklyAdaptations(userId: string, programId: string) {
    const { data, error } = await supabase
      .from('weekly_adaptations')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data ? data.map(toCamelCase) : [];
  },

  async createWeeklyAdaptation(userId: string, adaptation: Record<string, any>) {
    const { error } = await supabase
      .from('weekly_adaptations')
      .insert({
        user_id: userId,
        ...toSnakeCase(adaptation)
      });

    if (error) throw error;
  }
};
