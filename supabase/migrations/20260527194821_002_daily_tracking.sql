/*
  # Daily Tracking Tables
  
  This migration creates tables for daily logs and workout tracking.
  
  1. New Tables:
    - `daily_logs`: Daily readiness and nutrition tracking
      - `id` (uuid, primary key, composite key with date)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `readiness_score` (integer)
      - `readiness_status` (text)
      - `sleep_hours` (integer)
      - `sleep_quality` (integer)
      - `soreness_level` (integer)
      - `soreness_locations` (text[])
      - `stress_level` (integer)
      - `energy_level` (integer)
      - `weight_kg` (integer)
      - `hrv` (integer)
      - `calorie_budget` (integer)
      - `protein_target_g` (integer)
      - `carb_target_g` (integer)
      - `fat_target_g` (integer)
      - `calories_consumed` (integer)
      - `protein_consumed_g` (integer)
      - `carbs_consumed_g` (integer)
      - `fat_consumed_g` (integer)
      - `water_glasses` (integer, default 0)
      - `step_count` (integer, default 0)
      - `active_calories_burned` (integer, default 0)
      - `workout_completed` (boolean, default false)
      - `is_smart_rest` (boolean, default false)
      - `workout_id` (uuid)
      - `created_at` (timestamptz, default now())
      
    - `meal_entries`: Individual meal entries
      - `id` (uuid, primary key)
      - `daily_log_id` (uuid, references daily_logs)
      - `user_id` (uuid, references user_profiles)
      - `meal_type` (text, not null)
      - `foods` (text[], not null)
      - `calories` (integer)
      - `protein_g` (integer)
      - `carbs_g` (integer)
      - `fat_g` (integer)
      - `photo_url` (text)
      - `timestamp` (timestamptz, default now())
  
  2. Security:
    - Enable RLS on all tables
    - Users can only access their own data
*/

-- Create daily_logs table
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  readiness_score integer,
  readiness_status text,
  sleep_hours integer,
  sleep_quality integer,
  soreness_level integer,
  soreness_locations text[] DEFAULT '{}',
  stress_level integer,
  energy_level integer,
  weight_kg integer,
  hrv integer,
  calorie_budget integer,
  protein_target_g integer,
  carb_target_g integer,
  fat_target_g integer,
  calories_consumed integer DEFAULT 0,
  protein_consumed_g integer DEFAULT 0,
  carbs_consumed_g integer DEFAULT 0,
  fat_consumed_g integer DEFAULT 0,
  water_glasses integer DEFAULT 0,
  step_count integer DEFAULT 0,
  active_calories_burned integer DEFAULT 0,
  workout_completed boolean DEFAULT false,
  is_smart_rest boolean DEFAULT false,
  workout_id uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create meal_entries table
CREATE TABLE IF NOT EXISTS meal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  meal_type text NOT NULL,
  foods text[] NOT NULL,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  photo_url text,
  timestamp timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_logs
CREATE POLICY "Users can read own daily logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily logs"
  ON daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily logs"
  ON daily_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for meal_entries
CREATE POLICY "Users can read own meals"
  ON meal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals"
  ON meal_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
  ON meal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
  ON meal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_entries_daily_log ON meal_entries(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_meal_entries_user ON meal_entries(user_id);
