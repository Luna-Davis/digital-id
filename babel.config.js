// babel.config.js
//
// babel-preset-expo automatically registers the react-native-worklets/plugin
// when react-native-worklets is installed (see babel-preset-expo/build/
// configs/expo.js). Adding it manually here would DOUBLE-register it and
// corrupt worklet functions at runtime — so this file stays minimal.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
