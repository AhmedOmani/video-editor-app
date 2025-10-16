const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: config.server.nodeEnv === "production" ? {rejectUnauthorized: false} : false
});

async function createUserTable() {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
    await pool.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        username CITEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );`)
}

async function createSessionTable() {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
    await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );`
        );
}

async function generate() {
    await createUserTable();
    await createSessionTable();
}

process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
});

module.exports = { pool , generate };