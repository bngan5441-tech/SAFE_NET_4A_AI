CREATE TABLE "docs" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" serial PRIMARY KEY,
	"name" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"title" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
