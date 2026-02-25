-- ============================================
-- BballCoach AI — Supabase Database Schema
-- Exécuter dans le SQL Editor de Supabase
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profils utilisateurs
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions live enregistrées
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    ai_feedback_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Médias uploadés pour analyse
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT CHECK (media_type IN ('video', 'image')),
    ai_analysis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own sessions" ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sessions" ON sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own uploads" ON uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own uploads" ON uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own uploads" ON uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own uploads" ON uploads FOR DELETE USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('sessions_videos', 'sessions_videos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('user_uploads', 'user_uploads', true);

CREATE POLICY "Public read sessions" ON storage.objects FOR SELECT USING (bucket_id = 'sessions_videos');
CREATE POLICY "Auth insert sessions" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sessions_videos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Public read uploads" ON storage.objects FOR SELECT USING (bucket_id = 'user_uploads');
CREATE POLICY "Auth insert uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user_uploads' AND auth.uid() IS NOT NULL);
