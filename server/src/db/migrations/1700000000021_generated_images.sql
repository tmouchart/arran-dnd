CREATE TABLE IF NOT EXISTS generated_images (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
