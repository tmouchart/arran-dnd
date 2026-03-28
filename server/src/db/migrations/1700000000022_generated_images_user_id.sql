-- Add user_id column (nullable first for existing rows, then set NOT NULL)
ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE;

-- Default any existing rows to user 1 (if any exist)
UPDATE generated_images SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE generated_images ALTER COLUMN user_id SET NOT NULL;
