module.exports = {
  '*.{ts,tsx,js,jsx,cjs,mjs,json,md,yml,yaml}': ['pnpm prettier --write'],
  '*.{ts,tsx,js,jsx,cjs,mjs}': (files) => {
    const affectedFiles = files.join(',');
    return [
      `pnpm nx affected:lint --files=${affectedFiles} -- --fix`,
      `pnpm nx affected:test --files=${affectedFiles}`,
    ];
  },
};
