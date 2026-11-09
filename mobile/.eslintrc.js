module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise()` is used deliberately to mark fire-and-forget promises in handlers.
    'no-void': 'off',
  },
};
