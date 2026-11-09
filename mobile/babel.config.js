module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4 ships `export * as ns from` which Metro's preset does not transform by default
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
