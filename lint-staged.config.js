module.exports = {
  '*.{ts,tsx,js,jsx,cjs,mjs}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '**/*': () => 'npx nx affected -t build',
};
