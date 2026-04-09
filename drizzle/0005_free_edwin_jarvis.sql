CREATE TABLE "image_tags" (
	"image_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "image_tags_image_id_tag_id_pk" PRIMARY KEY("image_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_folder_id" integer NOT NULL,
	"relative_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"thumbnail_path" text,
	"taken_at" timestamp,
	"camera_model" text,
	"lens_model" text,
	"iso" integer,
	"aperture" real,
	"shutter_speed" text,
	"focal_length" real,
	"latitude" real,
	"longitude" real,
	"altitude" real,
	"iptc_title" text,
	"iptc_description" text,
	"iptc_keywords" jsonb,
	"iptc_copyright" text,
	"metadata" jsonb,
	"file_modified_at" timestamp,
	"missing" boolean DEFAULT false NOT NULL,
	"indexed" boolean DEFAULT false NOT NULL,
	"indexed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_folders_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "source_sync_status" (
	"source_folder_id" integer PRIMARY KEY NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_run_id" integer,
	"available" boolean DEFAULT true NOT NULL,
	"unavailable_reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_folder_id" integer,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"scanned" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"missing" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tag_management_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_source_folder_id_source_folders_id_fk" FOREIGN KEY ("source_folder_id") REFERENCES "public"."source_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sync_status" ADD CONSTRAINT "source_sync_status_source_folder_id_source_folders_id_fk" FOREIGN KEY ("source_folder_id") REFERENCES "public"."source_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sync_status" ADD CONSTRAINT "source_sync_status_last_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("last_sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_source_folder_id_source_folders_id_fk" FOREIGN KEY ("source_folder_id") REFERENCES "public"."source_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_tags_image_idx" ON "image_tags" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "image_tags_tag_idx" ON "image_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "images_source_folder_idx" ON "images" USING btree ("source_folder_id");--> statement-breakpoint
CREATE INDEX "images_taken_at_idx" ON "images" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "images_relative_path_idx" ON "images" USING btree ("relative_path");--> statement-breakpoint
CREATE INDEX "images_camera_model_idx" ON "images" USING btree ("camera_model");--> statement-breakpoint
CREATE INDEX "images_lens_model_idx" ON "images" USING btree ("lens_model");--> statement-breakpoint
CREATE INDEX "images_mime_type_idx" ON "images" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_runs_source_folder_idx" ON "sync_runs" USING btree ("source_folder_id");--> statement-breakpoint
CREATE INDEX "tag_mgmt_log_created_at_idx" ON "tag_management_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tag_mgmt_log_operation_idx" ON "tag_management_log" USING btree ("operation");