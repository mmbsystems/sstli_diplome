module.exports = function serverOnlyJson(source) {
  return `import 'server-only';\nexport default ${JSON.stringify(JSON.parse(source))};`;
};
