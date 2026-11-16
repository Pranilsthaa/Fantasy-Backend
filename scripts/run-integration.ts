export {};

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_NEON_BRANCH?.startsWith('schema-check-')) {
  console.error('Set TEST_DATABASE_URL (direct connection) and TEST_NEON_BRANCH=schema-check-<name> for an isolated verification branch. Production is never used as a fallback.');
  process.exit(1);
}
const result = Bun.spawnSync(['bun', 'test', 'test/database.integration.test.ts'], {
  stdin: 'inherit', stdout: 'inherit', stderr: 'inherit', env: process.env,
});
process.exit(result.exitCode);
