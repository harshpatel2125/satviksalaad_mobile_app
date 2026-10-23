const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const MIN_IOS = "15.1";
const MARKER = "# satviksalaad: minimum pod deployment target";

// Some pods (Firebase's GoogleUtilities, SDWebImage, …) still declare iOS 9–12,
// which current Xcode refuses to build. Raise every pod target to the app's minimum.
module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
