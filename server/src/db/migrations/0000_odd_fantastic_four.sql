CREATE TABLE "character" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"name" text DEFAULT 'Nouveau héros' NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"people" text DEFAULT '' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"hp_max" integer DEFAULT 10 NOT NULL,
	"mp_max" integer DEFAULT 0 NOT NULL,
	"defense" integer DEFAULT 12 NOT NULL,
	"initiative_bonus" integer DEFAULT 0 NOT NULL,
	"str" integer DEFAULT 10 NOT NULL,
	"dex" integer DEFAULT 10 NOT NULL,
	"con" integer DEFAULT 10 NOT NULL,
	"int" integer DEFAULT 10 NOT NULL,
	"wis" integer DEFAULT 10 NOT NULL,
	"cha" integer DEFAULT 10 NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attacks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "character" ADD CONSTRAINT "character_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_per_user" ON "character" USING btree ("user_id") WHERE "character"."is_active" = true;