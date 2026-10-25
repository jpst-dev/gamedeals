CREATE TABLE "email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_price" numeric(10, 2),
	"baseline_pending" boolean DEFAULT true NOT NULL,
	CONSTRAINT "favorites_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"game_id" text NOT NULL,
	"day" date NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"regular" numeric(10, 2) NOT NULL,
	"cut" integer NOT NULL,
	"shop" text NOT NULL,
	"history_low" numeric(10, 2),
	CONSTRAINT "price_snapshots_game_id_day_pk" PRIMARY KEY("game_id","day")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;