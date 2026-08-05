// plugins/withOffline.js
//
// Privacy hardening for the Android build:
//
//  1. Requests the ML Kit OCR model at install time via Google Play
//     (meta-data com.google.mlkit.vision.DEPENDENCIES = "ocr"), so a
//     Play-installed build never needs a runtime download.
//
//  2. Production builds (EAS profile "production"): removes the
//     android.permission.INTERNET permission from the FINAL written manifest —
//     the app is hard offline. This runs as an `android.finalized` mod, which
//     the Expo mod compiler executes after every other Android mod, because
//     expo-file-system's own plugin re-adds INTERNET after the normal
//     app.json plugins have run.
//
//  development / preview builds keep INTERNET so the dev client can reach
//  Metro and so a sideloaded beta APK can fetch Google Play services' on-device
//  OCR model once (after which OCR runs fully offline).

const { withAndroidManifest, withMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MLKIT_DEPENDENCIES = 'com.google.mlkit.vision.DEPENDENCIES';

module.exports = function withOffline(config) {
  // Install-time delivery of the OCR model (Play-installed builds).
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest['application'] && manifest['application'][0];
    if (app) {
      const meta = app['meta-data'] || [];
      const alreadyDeclared = meta.some((m) => m.$ && m.$['android:name'] === MLKIT_DEPENDENCIES);
      if (!alreadyDeclared) {
        meta.push({ $: { 'android:name': MLKIT_DEPENDENCIES, 'android:value': 'ocr' } });
        app['meta-data'] = meta;
      }
    }
    return cfg;
  });

  // Strip INTERNET from the final manifest (production only).
  config = withMod(config, {
    platform: 'android',
    mod: 'finalized',
    action: (cfg) => {
      if (process.env.EAS_BUILD_PROFILE !== 'production') return cfg;
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/AndroidManifest.xml'
      );
      const xml = fs.readFileSync(manifestPath, 'utf8');
      const filtered = xml.replace(
        /<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>/g,
        ''
      );
      if (filtered !== xml) {
        fs.writeFileSync(manifestPath, filtered);
        console.log('[withOffline] INTERNET permission removed (production build)');
      }
      return cfg;
    },
  });

  return config;
};
