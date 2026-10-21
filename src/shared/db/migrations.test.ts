import Database from 'better-sqlite3';
import fixture from './fixtures/release-1.schema.json';
import migrations from '../../../drizzle/migrations';

// Each release's schema is saved in fixtures/. A new migration is tested by building a database from the previous
// release's fixture, filling it, applying the migrations after it, and checking the rows survive. Add a
// release-N.schema.json (copy of schemaOf() output) when a release ships, and point `fixture` at it.
// release-1 is the first migration. If you change that migration before the first release, regenerate the fixture.

const names = Object.keys(migrations.migrations).sort();
const split = (sql: string) => sql.split('--> statement-breakpoint');

function open() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

function apply(db: Database.Database, keys: string[]) {
  for (const key of keys) for (const statement of split(migrations.migrations[key]!)) db.exec(statement);
}

const schemaOf = (db: Database.Database) =>
  db.prepare("select type, name, tbl_name as tbl, sql from sqlite_master where name not like 'sqlite_%' order by type, name").all();

const columns = (db: Database.Database, table: string) =>
  (db.pragma(`table_info(${table})`) as { name: string; type: string; notnull: number; pk: number }[]).map(
    (c) => `${c.name} ${c.type.toLowerCase()}${c.notnull ? ' not null' : ''}${c.pk ? ' pk' : ''}`,
  );

describe('migrations', () => {
  it('create the tables and columns of the data model', () => {
    const db = open();
    apply(db, names);
    expect(columns(db, 'notes')).toEqual(['id text pk', 'title text not null', 'body text not null', 'created_at integer not null']);
  });

  it('default a note body to empty text', () => {
    const db = open();
    apply(db, names);
    db.exec("insert into notes (id, title, created_at) values ('n1', 'Groceries', 1)");
    expect(db.prepare('select body from notes').get()).toEqual({ body: '' });
  });
});

describe('release 1 fixture', () => {
  it('is the schema the first migration produces', () => {
    const db = open();
    apply(db, names.slice(0, 1));
    expect(names[0]).toBe(fixture.migration);
    expect(schemaOf(db)).toEqual(fixture.schema);
  });

  it('upgrades to the current schema with its rows intact', () => {
    const db = open();
    // tables before the indexes on them
    for (const type of ['table', 'index']) for (const row of fixture.schema) if (row.type === type) db.exec(row.sql);
    db.exec("insert into notes values ('n1', 'Groceries', 'Milk', 1)");
    apply(db, names.slice(1));

    const fresh = open();
    apply(fresh, names);
    expect(schemaOf(db)).toEqual(schemaOf(fresh));
    expect(db.prepare('select * from notes').all()).toEqual([{ id: 'n1', title: 'Groceries', body: 'Milk', created_at: 1 }]);
  });
});
