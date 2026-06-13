CREATE TABLE "auto_rename_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auto_rename_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	"style" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_rename_mappings" (
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"style_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auto_rename_mappings_guild_id_role_id_pk" PRIMARY KEY("guild_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "auto_rename_optouts" (
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	CONSTRAINT "auto_rename_optouts_guild_id_member_id_pk" PRIMARY KEY("guild_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "auto_rename_original_nicks" (
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	"original_nick" text NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "auto_rename_original_nicks_guild_id_member_id_pk" PRIMARY KEY("guild_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "command_daily" (
	"day" date PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_command_sync" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"command_names" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auto_rename_log_guild_at" ON "auto_rename_log" USING btree ("guild_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auto_rename_original_nicks_expires_at" ON "auto_rename_original_nicks" USING btree ("expires_at");