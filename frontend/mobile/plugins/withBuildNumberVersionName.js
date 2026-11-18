const { withAppBuildGradle } = require('@expo/config-plugins');

// Obtainium compares the release tag (mobile-v1.2.0-314) with the installed versionName,
// so a fixed "1.2.0" looks up to date forever. Only the Android versionName changes here:
// expo `version` must stay put because runtimeVersion follows it.
module.exports = function withBuildNumberVersionName(config) {
  const buildNumber = process.env.ANDROID_VERSION_CODE;
  if (!buildNumber) return config;

  return withAppBuildGradle(config, gradleConfig => {
    const versionName = `${config.version}-${buildNumber}`;
    gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
      /versionName\s+"[^"]*"/,
      `versionName "${versionName}"`,
    );
    return gradleConfig;
  });
};
