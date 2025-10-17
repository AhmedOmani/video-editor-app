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

async function createVideoTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS videos (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(8) UNIQUE NOT NULL,
            name TEXT NOT NULL,
            extension VARCHAR(10) NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            original_filename TEXT,
            extracted_audio BOOLEAN DEFAULT FALSE,
            resizes JSONB DEFAULT '{}',
            file_size BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id)`);
}

async function generate() {
    await createUserTable();
    await createVideoTable();
}

process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
});

module.exports = { pool , generate };