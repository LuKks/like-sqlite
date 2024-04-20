const SQL = require('like-sql')
const SQLite = require('better-sqlite3')

const builder = new SQL()

module.exports = class LikeSQLite extends SQL {
  constructor (file, opts = {}) {
    super()

    this.type = 'sqlite'

    // Tmp patch for like-sql due old mysql2 assumption
    this.charset = null
    this.collate = null
    this.engine = null
    this.connection = { connection: { config: { database: 'main' } } }

    this.db = new SQLite(file, {
      readonly: opts.readonly || false,
      fileMustExist: opts.fileMustExist || false,
      timeout: typeof opts.timeout === 'number' ? opts.timeout : 5000,
      verbose: opts.verbose || null,
      nativeBinding: opts.nativeBinding || null
    })

    if (opts.journal) this.db.pragma('journal_mode = ' + opts.journal)
    if (opts.sync) this.db.pragma('synchronous = ' + opts.sync)

    this.db.pragma('busy_timeout = ' + (typeof opts.busy === 'number' ? opts.busy : 60000))
  }

  pragma (cmd) {
    return this.db.pragma(cmd)
  }

  async exec (sql) {
    return waitForTick(() => this.db.exec(sql))
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
    const [rows] = await this.query(sql, values)
    return rows
  }

  async _selectOne (sql, values) {
    const [rows] = await this.query(sql, values, { fields: false })
    return rows[0]
  }

  async _exists (sql, values) {
    const [rows] = await this.query(sql, values, { fields: false })
    // TODO: Unsafe? Could use .columns() `name`
    return !!Object.values(rows[0])[0]
  }

  async _count (sql, values) {
    const [rows] = await this.query(sql, values, { fields: false })
    // TODO: Unsafe? Could use .columns() `name`
    return Object.values(rows[0])[0]
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

  async * iterate (...args) {
    const [sql, values] = builder.select(...args)
    const stmt = this.db.prepare(sql)

    for (const row of stmt.iterate(values)) {
      yield row
      await waitForTick(noop)
    }
  }

  // TODO: `execute` and `query` are not compatible with other libs atm

  async execute (sql, values) {
    return waitForTick(() => {
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
    })
  }

  async query (sql, values, opts) {
    return waitForTick(() => {
      const stmt = this.db.prepare(sql)

      const rows = values ? stmt.all(...values) : stmt.all()
      const fields = !opts || opts.fields !== false ? stmt.columns().map(mapColumns) : null

      return [rows, fields]
    })
  }

  // TODO: We should name it `close` everywhere
  async end () {
    this.db.close()
  }
}

// better-sqlite3 is sync so we need to unlock the event loop to allow timers, fs, etc
function waitForTick (cb) {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(cb())
      } catch (err) {
        reject(err)
      }
    })
  })
}

function mapColumns (column) {
  return { name: column.name }
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

function noop () {}
