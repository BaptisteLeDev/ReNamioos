CREATE TABLE "auto_rename_style_preferences" (
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	"style_name" text NOT NULL,
	CONSTRAINT "auto_rename_style_preferences_guild_id_member_id_pk" PRIMARY KEY("guild_id","member_id")
);
