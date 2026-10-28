import { readFileSync } from "node:fs";

import { d1Database, r2Storage } from "@hot-updater/cloudflare";
import { expo } from "@hot-updater/expo";
import { config } from "dotenv";
import { defineConfig } from "hot-updater";
import { apiKeys, insights, remoteConfig } from "hot-updater/plugins";

config({ path: ".env.hotupdater" });

// OTA bundles must carry the store build's public settings (live API, update
// server, client key), not a developer's .env.local. Expo leaves variables that
// are already set alone, so setting them here wins over the env files.
const storeBuildEnv: Record<string, string> = JSON.parse(readFileSync("eas.json", "utf8")).build.production.env;
Object.assign(process.env, storeBuildEnv);

export default defineConfig({
  build: expo(),
  storage: r2Storage({
    bucketName: process.env.HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME!,
    accountId: process.env.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID!,
    credentials: {
      accessKeyId: process.env.HOT_UPDATER_CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.HOT_UPDATER_CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  }),
  database: d1Database({
    databaseId: process.env.HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID!,
    accountId: process.env.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID!,
    cloudflareApiToken: process.env.HOT_UPDATER_CLOUDFLARE_API_TOKEN!,
  }),
  plugins: [apiKeys(), insights(), remoteConfig()],
  updateStrategy: "appVersion",
});
