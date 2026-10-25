// Rewrites src/shared/db/fixtures/release-1.schema.json from the first migration in drizzle/.
// Run from the app root after regenerating that migration: `node .agents/skills/get-started/fixture.mjs`.
// Same query as schemaOf() in src/shared/db/migrations.test.ts, so the "release 1 fixture" test passes.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const drizzle = path.join(root, 'drizzle');
const [migration] = fs
  .readdirSync(drizzle, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
if (!migration) throw new Error('No migration folder in drizzle/. Run pnpm db:generate first.');

const db = new Database(':memory:');
const sql = fs.readFileSync(path.join(drizzle, migration, 'migration.sql'), 'utf8');
for (const statement of sql.split('--> statement-breakpoint')) db.exec(statement);
const schema = db
  .prepare("select type, name, tbl_name as tbl, sql from sqlite_master where name not like 'sqlite_%' order by type, name")
  .all();

const out = path.join(root, 'src/shared/db/fixtures/release-1.schema.json');
fs.writeFileSync(out, `${JSON.stringify({ migration, schema }, null, 2)}\n`);
console.log(`fixture: ${path.relative(root, out)} now matches ${migration}`);
