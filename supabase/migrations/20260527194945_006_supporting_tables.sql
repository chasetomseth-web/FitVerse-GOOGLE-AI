/*
  # Supporting Tables
  
  This migration creates tables for body metrics, achievements, coach conversations, and exercise library.
  
  1. New Tables:
    - `body_metrics`: Weight and body composition tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `weight_kg` (integer)
      - `body_fat_percent` (integer)
      - `lean_mass_kg` (integer)
      - `notes` (text)
      - `source` (text, default 'manual')
      - `created_at` (timestamptz, default now())
      
    - `achievements`: User earned achievements
      - `id` (uuid, primary key)
      - `achievement_id` (text, not null)
      - `user_id` (uuid, references user_profiles)
      - `name` (text, not null)
      - `description` (text)
      - `earned_at` (timestamptz, not null)
      - `value` (integer)
      - `verified` (boolean, default true)
      - `created_at` (timestamptz, default now())
      
    - `coach_conversations`: Daily chat history with Personal Coach
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `messages` (jsonb)
      - `created_at` (timestamptz, default now())
      - UNIQUE(user_id, date)
      
    - `weekly_adaptations`: Weekly adaptation records
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `week` (integer)
      - `program_id` (text)
      - `status` (text)
      - `adjustments_summary` (jsonb)
      - `created_at` (timestamptz, default now())
      
    - `exercise_library`: Public exercise database
      - `id` (text, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `video_url` (text)
      - `thumbnail_url` (text)
      - `movement_pattern` (text)
      - `primary_muscle_group` (text)
      - `secondary_muscle_groups` (text[])
      - `equipment` (text)
      - `difficulty` (text)
      - `category` (text)
      - `substitution_tiers` (jsonb)
      - `instructions` (text[])
      - `common_form_errors` (text[])
      - `created_at` (timestamptz, default now())
  
  2. Security:
    - Enable RLS on all tables
*/

-- Create body_metrics table
CREATE TABLE IF NOT EXISTS body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg integer,
  body_fat_percent integer,
  lean_mass_kg integer,
  notes text,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  earned_at timestamptz NOT NULL,
  value integer,
  verified boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create coach_conversations table
CREATE TABLE IF NOT EXISTS coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  messages jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create weekly_adaptations table
CREATE TABLE IF NOT EXISTS weekly_adaptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  week integer,
  program_id text,
  status text,
  adjustments_summary jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create exercise_library table (publicly readable)
CREATE TABLE IF NOT EXISTS exercise_library (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  movement_pattern text,
  primary_muscle_group text,
  secondary_muscle_groups text[] DEFAULT '{}',
  equipment text,
  difficulty text,
  category text,
  substitution_tiers jsonb,
  instructions text[] DEFAULT '{}',
  common_form_errors text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies for body_metrics
CREATE POLICY "Users can read own body metrics"
  ON body_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own body metrics"
  ON body_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own body metrics"
  ON body_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for achievements
CREATE POLICY "Users can read own achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for coach_conversations
CREATE POLICY "Users can read own coach conversations"
  ON coach_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach conversations"
  ON coach_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coach conversations"
  ON coach_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for weekly_adaptations
CREATE POLICY "Users can read own weekly adaptations"
  ON weekly_adaptations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly adaptations"
  ON weekly_adaptations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for exercise_library (publicly readable)
CREATE POLICY "Anyone can read exercise library"
  ON exercise_library FOR SELECT
  TO public
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON body_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user_date ON coach_conversations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exercise_library_name ON exercise_library(name);
CREATE INDEX IF NOT EXISTS idx_exercise_library_pattern ON exercise_library(movement_pattern);
