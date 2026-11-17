CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"set_code" text NOT NULL,
	"set_name" text NOT NULL,
	"number" text NOT NULL,
	"rarity" text NOT NULL,
	"image_url" text,
	"release_date" date,
	"search_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"rate_jpy" real NOT NULL,
	CONSTRAINT "fx_rates_currency_date_pk" PRIMARY KEY("currency","date")
);
--> statement-breakpoint
CREATE TABLE "price_daily" (
	"card_id" text NOT NULL,
	"price_type" text NOT NULL,
	"date" date NOT NULL,
	"min" integer NOT NULL,
	"median" integer NOT NULL,
	"max" integer NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "price_daily_card_id_price_type_date_pk" PRIMARY KEY("card_id","price_type","date")
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_observations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"card_id" text NOT NULL,
	"source_id" text NOT NULL,
	"price_type" text NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"price_jpy" integer NOT NULL,
	"condition" text NOT NULL,
	"grading_company" text,
	"grading_grade" real,
	"url" text,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_summaries" (
	"card_id" text NOT NULL,
	"price_type" text NOT NULL,
	"min" integer NOT NULL,
	"median" integer NOT NULL,
	"max" integer NOT NULL,
	"count" integer NOT NULL,
	"change_7d" real,
	"latest_at" timestamp with time zone NOT NULL,
	CONSTRAINT "price_summaries_card_id_price_type_pk" PRIMARY KEY("card_id","price_type")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"region" text NOT NULL,
	"currency" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_daily" ADD CONSTRAINT "price_daily_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_summaries" ADD CONSTRAINT "price_summaries_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_search_trgm_idx" ON "cards" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cards_set_code_idx" ON "cards" USING btree ("set_code");--> statement-breakpoint
CREATE INDEX "cards_rarity_idx" ON "cards" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "price_obs_card_type_time_idx" ON "price_observations" USING btree ("card_id","price_type","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "price_obs_source_time_idx" ON "price_observations" USING btree ("source_id","observed_at" DESC NULLS LAST);