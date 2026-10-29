const { withAndroidManifest, withMainActivity } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

// Android 16 ignores orientation locks on tablets and foldables, and Play flags a
// manifest lock, so the lock comes off the manifest and only phones (smallest
// width under 600dp, Android's large-screen boundary) are kept in portrait at launch.
module.exports = function withPhonePortrait(config) {
  config = withAndroidManifest(config, (cfg) => {
    for (const activity of cfg.modResults.manifest.application?.[0]?.activity ?? []) {
      if (activity.$["android:name"] === ".MainActivity") delete activity.$["android:screenOrientation"];
    }
    return cfg;
  });

  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    src = mergeContents({
      src,
      newSrc: "import android.content.pm.ActivityInfo",
      tag: "satviksalaad-phone-portrait-import",
      anchor: /^import android\.os\.Bundle$/m,
      offset: 1,
      comment: "//",
    }).contents;
    src = mergeContents({
      src,
      newSrc: [
        "    if (resources.configuration.smallestScreenWidthDp < 600) {",
        "      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT",
        "    }",
      ].join("\n"),
      tag: "satviksalaad-phone-portrait",
      anchor: /super\.onCreate\(null\)/,
      offset: 1,
      comment: "//",
    }).contents;
    cfg.modResults.contents = src;
    return cfg;
  });
};
