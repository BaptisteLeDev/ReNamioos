CREATE TABLE "style_event" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"style_name" text NOT NULL,
	"started_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
