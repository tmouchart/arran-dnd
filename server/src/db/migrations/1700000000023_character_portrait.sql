ALTER TABLE "character" ADD COLUMN IF NOT EXISTS portrait_image_id INTEGER REFERENCES generated_images(id);
