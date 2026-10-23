// Writes stand-in Firebase config files so a local development build works
// before the real Firebase project exists. Firebase starts with them but sends
// nothing. Never commit these; replace them with the project's real files.
import { existsSync, writeFileSync } from "node:fs";

const bundleId = "com.infynixlabs.satviksalaad";
const files = {
  "GoogleService-Info.plist": `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>API_KEY</key><string>AIzaSyLOCALPLACEHOLDER00000000000000000</string>
	<key>GCM_SENDER_ID</key><string>000000000000</string>
	<key>PLIST_VERSION</key><string>1</string>
	<key>BUNDLE_ID</key><string>${bundleId}</string>
	<key>PROJECT_ID</key><string>satviksalaad-local-placeholder</string>
	<key>STORAGE_BUCKET</key><string>satviksalaad-local-placeholder.appspot.com</string>
	<key>IS_ANALYTICS_ENABLED</key><false/>
	<key>GOOGLE_APP_ID</key><string>1:000000000000:ios:0000000000000000000000</string>
</dict>
</plist>
`,
  "google-services.json": JSON.stringify({
    project_info: { project_number: "000000000000", project_id: "satviksalaad-local-placeholder", storage_bucket: "satviksalaad-local-placeholder.appspot.com" },
    client: [{
      client_info: { mobilesdk_app_id: "1:000000000000:android:0000000000000000000000", android_client_info: { package_name: bundleId } },
      api_key: [{ current_key: "AIzaSyLOCALPLACEHOLDER00000000000000000" }],
    }],
    configuration_version: "1",
  }) + "\n",
};

for (const [name, contents] of Object.entries(files)) {
  if (existsSync(name)) {
    console.log(`${name} exists, left as it is`);
    continue;
  }
  writeFileSync(name, contents);
  console.log(`wrote placeholder ${name}`);
}
