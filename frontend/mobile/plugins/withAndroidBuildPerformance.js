const { withGradleProperties } = require('@expo/config-plugins');

function setGradleProperty(properties, key, value) {
  const existing = properties.find(property => property.type === 'property' && property.key === key);
  if (existing) {
    existing.value = value;
    return;
  }

  properties.push({ type: 'property', key, value });
}

module.exports = function withAndroidBuildPerformance(config) {
  return withGradleProperties(config, gradleConfig => {
    // Keep the default local build to one ABI; override it for an x86_64 emulator when needed.
    setGradleProperty(gradleConfig.modResults, 'reactNativeArchitectures', 'arm64-v8a');
    setGradleProperty(gradleConfig.modResults, 'org.gradle.parallel', 'false');
    setGradleProperty(gradleConfig.modResults, 'org.gradle.tooling.parallel', 'false');
    return gradleConfig;
  });
};
