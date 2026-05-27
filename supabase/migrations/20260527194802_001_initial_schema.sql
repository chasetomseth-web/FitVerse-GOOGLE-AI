/*
  # Initial Schema - FitVerse Database
  
  This migration creates the core tables for the FitVerse fitness tracking application.
  
  1. New Tables:
    - `user_profiles`: Core user data and preferences
      - `id` (uuid, primary key, references auth.users)
      - `name` (text)
      - `email` (text, unique)
      - `photo_url` (text)
      - `onboarding_complete` (boolean, default false)
      - `unit_system` (text, default 'imperial')
      - `gender` (text)
      - `birth_date` (date)
      - `age` (integer)
      - `height_cm` (integer)
      - `weight_kg` (integer)
      - `bodyweight_goal_kg` (integer)
      - `body_fat_percent` (integer)
      - `primary_goal` (text)
      - `fitness_level` (text, default 'beginner')
      - `available_equipment` (text[], default '{}')
      - `preferred_workout_duration` (integer, default 45)
      - `preferred_workout_days` (integer[], default '{}')
      - `training_environment` (text)
      - `coach_notes` (text, default '')
      - `medical_notes` (text)
      - `limitations` (text)
      - `selected_goals` (text[], default '{}')
      - `known_intolerances` (text[], default '{}')
      - `meal_preferences` (text[], default '{}')
      - `current_streak` (integer, default 0)
      - `last_workout_date` (date)
      - `created_at` (timestamptz, default now())
      - `last_active_at` (timestamptz, default now())
      - `timezone` (text)
      
    - `strength_baselines`: User's strength data
      - `user_id` (uuid, primary key, references user_profiles)
      - `bench_press` (integer)
      - `squat` (integer)
      - `deadlift` (integer)
      - `overhead_press` (integer)
      - `barbell_row` (integer)
      - `dumbbell_row` (integer)
    
    - `injury_log`: User injuries
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `body_part` (text)
      - `severity` (integer)
      - `date_reported` (timestamptz)
      - `status` (text)
      - `description` (text)
      - `created_at` (timestamptz, default now())
  
  2. Security:
    - Enable RLS on all tables
    - Users can only read/write their own data
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Athlete',
  email text UNIQUE NOT NULL,
  photo_url text,
  onboarding_complete boolean DEFAULT false,
  unit_system text DEFAULT 'imperial',
  gender text,
  birth_date date,
  age integer,
  height_cm integer,
  weight_kg integer,
  bodyweight_goal_kg integer,
  body_fat_percent integer,
  primary_goal text DEFAULT 'muscle_gain',
  fitness_level text DEFAULT 'beginner',
  available_equipment text[] DEFAULT '{}',
  preferred_workout_duration integer DEFAULT 45,
  preferred_workout_days integer[] DEFAULT '{}',
  training_environment text DEFAULT 'full_gym',
  coach_notes text DEFAULT '',
  medical_notes text,
  limitations text,
  selected_goals text[] DEFAULT '{}',
  known_intolerances text[] DEFAULT '{}',
  meal_preferences text[] DEFAULT '{}',
  current_streak integer DEFAULT 0,
  last_workout_date date,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  timezone text DEFAULT 'UTC'
);

-- Create strength_baselines table
CREATE TABLE IF NOT EXISTS strength_baselines (
  user_id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  bench_press integer,
  squat integer,
  deadlift integer,
  overhead_press integer,
  barbell_row integer,
  dumbbell_row integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create injury_log table
CREATE TABLE IF NOT EXISTS injury_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  body_part text NOT NULL,
  severity integer NOT NULL,
  date_reported timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for strength_baselines
CREATE POLICY "Users can read own strength baselines"
  ON strength_baselines FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strength baselines"
  ON strength_baselines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strength baselines"
  ON strength_baselines FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for injury_log
CREATE POLICY "Users can read own injuries"
  ON injury_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own injuries"
  ON injury_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own injuries"
  ON injury_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own injuries"
  ON injury_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_injury_log_user_id ON injury_log(user_id);
