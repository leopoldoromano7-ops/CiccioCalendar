-- Create shifts table
CREATE TABLE shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- morning, afternoon, night
  staff_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own shifts
CREATE POLICY "Users can see their own shifts" ON shifts
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own shifts
CREATE POLICY "Users can insert their own shifts" ON shifts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own shifts
CREATE POLICY "Users can update their own shifts" ON shifts
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own shifts
CREATE POLICY "Users can delete their own shifts" ON shifts
  FOR DELETE USING (auth.uid() = user_id);
