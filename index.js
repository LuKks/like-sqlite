const SQL = require('like-sql')
const SQLite = require('better-sqlite3')

module.exports = class LikeSQLite extends SQL {
  constructor (file, opts = {}) {
    super()

    this.type = 'sqlite'

    // Tmp patch for like-sql due old mysql2 assumption
    this.charset = null
    this.collate = null
    this.engine = null
    this.connection = { connection: { config: { database: 'main' } } }

    this.db = new SQLite(file, opts)
  }

  async _createDatabase (sql) {
    throw new Error('Operation is not supported by SQLite')
  }

  async _dropDatabase (sql) {
    throw new Error('Operation is not supported by SQLite')
  }

  async _createTable (sql) {
    throw new Error('Not implemented')
  }

  async _dropTable (sql) {
    await this.execute(sql)
  }

  async _insert (sql, values) {
    const info = await this.execute(sql, values)
    return info.lastInsertRowid
  }

  async _select (sql, values) {
    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...values)
    return rows
  }

  async _selectOne (sql, values) {
    const stmt = this.db.prepare(sql)
    const row = stmt.get(...values)
    return row
  }

  async _exists (sql, values) {
    const stmt = this.db.prepare(sql)
    const row = stmt.get(...values)
    // TODO: Unsafe? Could use .columns() `name`
    return !!Object.values(row)[0]
  }

  async _count (sql, values) {
    const stmt = this.db.prepare(sql)
    const row = stmt.get(...values)
    // TODO: Unsafe? Could use .columns() `name`
    return Object.values(row)[0]
  }

  async _update (sql, values) {
    const info = await this.execute(sql, values)
    // TODO: Not really `changedRows`
    return info.changes
  }

  async _delete (sql, values) {
    const info = await this.execute(sql, values)
    // TODO: Not really `affectedRows`
    return info.changes
  }

  // TODO: `execute` and `query` are not compatible with other libs atm

  async execute (sql, values) {
    try {
      const stmt = this.db.prepare(sql)
      const info = values ? stmt.run(...values) : stmt.run()
      // TODO: Don't return info for v1
      return info
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new SQLError(err.message, 'ER_DUP_ENTRY')
      }

      throw err
    }
  }

  async query (sql, values) {
    const stmt = this.db.prepare(sql)

    const rows = values ? stmt.all(...values) : stmt.all()
    const fields = stmt.columns().map(col => ({ name: col.name }))

    return [rows, fields]
  }

  // TODO: We should name it `close` everywhere
  async end () {
    this.db.close()
  }
}

class SQLError extends Error {
  constructor (msg, code) {
    super(msg)
    this.code = code
  }

  get name () {
    return 'SQLError'
  }
}
