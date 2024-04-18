const fs = require('fs')
const path = require('path')
const test = require('brittle')
const tmp = require('test-tmp')
const SQLite = require('./index.js')

test('insert with explicit ROWID', async function (t) {
  t.plan(2)

  const db = await create(t)

  await db.dropTable('users2')

  // Important notes:
  // 'INTEGER PRIMARY KEY' is a special case in SQLite that means ROWID
  // 'AUTOINCREMENT' is not needed but it disables reusing old ids from deleted rows
  // SQLite violates the SQL standard by allowing null values in primary keys so add 'NOT NULL'
  await db.execute(`
    CREATE TABLE IF NOT EXISTS main.users2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NULL
    )
  `)

  t.is(await db.insert('users2', { name: 'a' }), 1)
  t.is(await db.insert('users2', { name: 'b' }), 2)

  await db.dropTable('users2')
})

// https://www.sqlite.org/rowidtable.html
test('insert without explicit ROWID (but still has it)', async function (t) {
  t.plan(3)

  const db = await create(t)

  await db.dropTable('users3')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS main.users3 (
      name TEXT NULL
    )
  `)

  t.is(await db.insert('users3', { name: 'a' }), 1)
  t.is(await db.insert('users3', { name: 'b' }), 2)

  // Supported key names by SQLite: 'rowid', 'oid', '_rowid_'
  const rows = await db.select('users3', ['rowid', 'name'])

  t.alike(rows, [
    { rowid: 1, name: 'a' },
    { rowid: 2, name: 'b' }
  ])

  await db.dropTable('users3')
})

test('insert but table is WITHOUT ROWID', async function (t) {
  t.plan(1)

  const db = await create(t)

  await db.dropTable('users4')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS main.users4 (
      uuid TEXT PRIMARY KEY,
      name TEXT NULL
    ) WITHOUT ROWID
  `)

  const uuid1 = 'f-f-a'
  const uuid2 = 'f-f-b'

  // TODO: RQlite wrongly returns `lastInsertId` as `2` for `WITHOUT ROWID` tables
  await db.insert('users4', { uuid: uuid1, name: 'a' })
  await db.insert('users4', { uuid: uuid2, name: 'b' })

  const rows = await db.select('users4')

  t.alike(rows, [
    { uuid: uuid1, name: 'a' },
    { uuid: uuid2, name: 'b' }
  ])

  await db.dropTable('users4')
})

test('insert unique', async function (t) {
  t.plan(1)

  const db = await create(t)

  await db.dropTable('users5')

  await db.execute(`
    CREATE TABLE main.users5 (
      username TEXT,
      UNIQUE (username)
    )
  `)

  await db.insert('users5', { username: 'joe' })

  try {
    await db.insert('users5', { username: 'joe' })
    t.fail()
  } catch (err) {
    t.is(err.code, 'ER_DUP_ENTRY')
  }

  await db.dropTable('users5')
})

test('select', async function (t) {
  t.plan(19)

  const db = await create(t)

  await db.dropTable('users6')

  await db.execute(`
    CREATE TABLE main.users6 (
      username TEXT,
      password TEXT
    )
  `)

  await db.insert('users6', { username: 'joe', password: '123' })
  await db.insert('users6', { username: 'bob', password: '456' })

  const rows = await db.select('users6')
  t.is(rows.length, 2)
  t.alike(rows[0], { username: 'joe', password: '123' })
  t.alike(rows[1], { username: 'bob', password: '456' })

  const rows2 = await db.select('users6', ['username'])
  t.is(rows2.length, 2)
  t.alike(rows2[0], { username: 'joe' })
  t.alike(rows2[1], { username: 'bob' })

  const rows3 = await db.select('users6', ['username'], 'LIMIT 1')
  t.is(rows3.length, 1)
  t.alike(rows3[0], { username: 'joe' })

  const rows4 = await db.select('users6', ['password'], 'username = ?', 'joe')
  t.is(rows4.length, 1)
  t.alike(rows4[0], { password: '123' })

  const rows5 = await db.select('users6', ['*'], 'ORDER BY username ASC')
  t.is(rows5.length, 2)
  t.is(rows5[0].username, 'bob')
  t.is(rows5[1].username, 'joe')

  const rows6 = await db.select('users6', ['*'], 'ORDER BY username ASC LIMIT 1')
  t.is(rows6.length, 1)
  t.is(rows6[0].username, 'bob')

  const rows7 = await db.select('users6', ['*'], 'username = ? ORDER BY username ASC LIMIT 2', 'joe')
  t.is(rows7.length, 1)
  t.is(rows7[0].username, 'joe')

  const rows8 = await db.select('users6', ['*'], 'username = ?', 'random-username')
  t.is(rows8.length, 0)

  const rows9 = await db.select('users6', ['*'], 'username LIKE ?', 'b%')
  t.is(rows9.length, 1)

  await db.dropTable('users6')
})

test('select one', async function (t) {
  t.plan(4)

  const db = await create(t)

  await db.dropTable('users7')

  await db.execute(`
    CREATE TABLE main.users7 (
      username TEXT,
      password TEXT
    )
  `)

  await db.insert('users7', { username: 'joe', password: '123' })
  await db.insert('users7', { username: 'bob', password: '456' })

  const row = await db.selectOne('users7', ['*'], 'username = ?', 'joe')
  t.alike(row, { username: 'joe', password: '123' })

  const row2 = await db.selectOne('users7', ['*'], 'ORDER BY username ASC')
  t.alike(row2, { username: 'bob', password: '456' })

  const row3 = await db.selectOne('users7', ['*'], 'username = ? ORDER BY username ASC', 'joe')
  t.alike(row3, { username: 'joe', password: '123' })

  const row4 = await db.selectOne('users7', ['*'], 'username = ?', 'random-username')
  t.is(row4, undefined)

  await db.dropTable('users7')
})

test('exists', async function (t) {
  t.plan(2)

  const db = await create(t)

  await db.dropTable('users8')

  await db.execute(`
    CREATE TABLE main.users8 (
      username TEXT,
      password TEXT
    )
  `)

  await db.insert('users8', { username: 'joe', password: '123' })
  await db.insert('users8', { username: 'bob', password: '456' })

  const exists = await db.exists('users8', 'username = ?', 'joe')
  t.ok(exists)

  const exists2 = await db.exists('users8', 'username = ?', 'random-username')
  t.absent(exists2)

  await db.dropTable('users8')
})

test('count', async function (t) {
  t.plan(3)

  const db = await create(t)

  await db.dropTable('users9')

  await db.execute(`
    CREATE TABLE main.users9 (
      username TEXT,
      password TEXT
    )
  `)

  await db.insert('users9', { username: 'joe', password: '123' })
  await db.insert('users9', { username: 'bob', password: '456' })

  const count = await db.count('users9')
  t.is(count, 2)

  const count2 = await db.count('users9', 'username = ?', 'joe')
  t.is(count2, 1)

  const count3 = await db.count('users9', 'username = ?', 'random-username')
  t.is(count3, 0)

  await db.dropTable('users9')
})

test('update', async function (t) {
  t.plan(4)

  const db = await create(t)

  await db.dropTable('users10')

  await db.execute(`
    CREATE TABLE main.users10 (
      username TEXT,
      password TEXT
    )
  `)

  await db.insert('users10', { username: 'joe', password: '123' })
  await db.insert('users10', { username: 'bob', password: '456' })

  t.is(await db.update('users10', { username: 'alice' }, 'username = ?', 'bob'), 1) // 1 changed, 1 affected

  t.is(await db.update('users10', { username: 'alice' }), 2) // 1 changed, 2 affected

  t.is(await db.update('users10', { username: 'alice' }, 'username = ?', 'random-username'), 0) // 0 changed, 0 affected

  t.is(await db.update('users10', { username: 'unique-username' }), 2)

  // TODO: Investage about SQLITE_ENABLE_UPDATE_DELETE_LIMIT
  // Although, makes sense that is disabled by default. This query seems like an edge case
  // t.is(await db.update('users10', { username: 'unique-username2' }, 'LIMIT 1'), 1)

  await db.dropTable('users10')
})

test('update with arithmetic', async function (t) {
  t.plan(3)

  const db = await create(t)

  await db.dropTable('users11')

  await db.execute(`
    CREATE TABLE main.users11 (
      username TEXT,
      count INT
    )
  `)

  await db.insert('users11', { username: 'joe', count: 0 })
  await db.insert('users11', { username: 'bob', count: 0 })

  t.alike(await db.selectOne('users11', ['count'], 'username = ?', 'bob'), { count: 0 })
  t.is(await db.update('users11', [{ count: 'count + ?' }, 1], 'username = ?', 'bob'), 1)
  t.alike(await db.selectOne('users11', ['count'], 'username = ?', 'bob'), { count: 1 })

  await db.dropTable('users11')
})

test('delete', async function (t) {
  t.plan(6)

  const db = await create(t)

  await db.dropTable('users12')

  await db.execute(`
    CREATE TABLE main.users12 (
      username TEXT,
      count INT
    )
  `)

  await db.insert('users12', { username: 'joe', count: 0 })
  await db.insert('users12', { username: 'bob', count: 0 })
  t.is(await db.delete('users12'), 2)
  t.is(await db.delete('users12'), 0)

  await db.insert('users12', { username: 'joe', count: 0 })
  await db.insert('users12', { username: 'bob', count: 0 })
  // TODO: Same as above about SQLITE_ENABLE_UPDATE_DELETE_LIMIT
  // t.is(await db.delete('users12', 'LIMIT 1'), 1)
  t.is(await db.delete('users12'), 2)

  await db.insert('users12', { username: 'joe', count: 0 })
  await db.insert('users12', { username: 'bob', count: 0 })
  t.is(await db.delete('users12', 'username = ?', 'bob'), 1)
  t.is(await db.delete('users12', 'username = ?', 'bob'), 0)
  t.is(await db.delete('users12', 'username = ?', 'joe'), 1)

  await db.dropTable('users12')
})

// TODO
test.skip('transaction', async function (t) {})
test.skip('transaction() with error', async function (t) {})

test('execute', async function (t) {
  t.plan(3)

  const db = await create(t)

  await db.dropTable('users13')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS main.users13 (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NULL
    )
  `)

  await db.insert('users13', { username: 'joe' })
  await db.insert('users13', { username: 'bob' })

  // TODO: Combine this query with the 'query' test, and here it should be an execute!
  const [rows, fields] = await db.query('SELECT * FROM `users13` WHERE `username` = ?', ['joe'])
  t.alike(rows, [{ id: 1, username: 'joe' }])
  t.is(fields[0].name, 'id')
  t.is(fields[1].name, 'username')
})

test.skip('query', async function (t) {
  t.plan(3)

  const db = await create(t)

  await db.dropTable('users14')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS main.users14 (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NULL
    )
  `)

  await db.insert('users14', { username: 'joe' })
  await db.insert('users14', { username: 'bob' })

  // TODO: Errors with `no such column: joe`
  const [rows, fields] = await db.query('SELECT * FROM `users14` WHERE `username` = "joe"')
  t.alike(rows, [{ id: 1, username: 'joe' }])
  t.is(fields[0].name, 'id')
  t.is(fields[1].name, 'username')
})

// TODO: Missing array of queries/executes for automatic "transactions"

async function create (t, opts = {}) {
  const dir = await tmp()
  const db = new SQLite(path.join(dir, 'database.db'))

  t.teardown(async () => {
    await db.end()
    await fs.promises.rm(dir, { recursive: true })
  })

  return db
}
