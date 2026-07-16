CREATE TABLE "guild_settings" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"preferred_locale" varchar(5),
	"embed_color" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
