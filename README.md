# like-sqlite

SQLite wrapper for Node.js

```
npm i like-sqlite
```

## Usage

```js
const SQLite = require('like-sqlite')

const db = new SQLite('./database.db')

// INSERT INTO `ips` (`addr`, `hits`) VALUES (?, ?)
const id = await db.insert('ips', { addr: req.ip, hits: 0 })

// SELECT `addr`, `hits` FROM `ips` WHERE addr = ?
const rows = await db.select('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT `addr`, `hits` FROM `ips` WHERE addr = ? LIMIT 1
const row = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT EXISTS(SELECT 1 FROM `ips` WHERE addr = ? LIMIT 1)
const exists = await db.exists('ips', 'addr = ?', req.ip)

// SELECT COUNT(1) FROM `ips` WHERE addr = ?
const count = await db.count('ips', 'addr = ?', req.ip)

// UPDATE `ips` SET `hits` = ? WHERE addr = ?
await db.update('ips', { hits: 1 }, 'addr = ?', req.ip)

// UPDATE `ips` SET `hits` = hits + ? WHERE addr = ?
await db.update('ips', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip)

// DELETE FROM `ips` WHERE addr = ?
await db.delete('ips', 'addr = ?', req.ip)

// Execute (INSERT, UPDATE, etc)
const [res, fields] = await db.execute('INSERT INTO `ips` (`addr`) VALUES (?)', [req.ip])

// Query (SELECT, etc)
const [rows, fields] = await db.query('SELECT * FROM `ips` WHERE `addr` = ?', [req.ip])
```

## API

#### `db = new SQLite(filename[, options])`

Create a SQLite instance.

Options:

```js
{
  readonly: false,
  fileMustExist: false,
  timeout: 5000,
  verbose: null,
  nativeBinding: null,
  journal: null, // 'WAL' is a good journal_mode!
  sync: null,
  busy: 60000
}
```

For example:

```js
const db = new SQLite('./database.db', { journal: 'WAL' })
```

## License

MIT
