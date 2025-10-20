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
    try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch (error) {
        if (error.code !== '23505') { // Ignore "already exists" errors
            console.error('Error creating pgcrypto extension:', error);
        }
    }
    
    try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    } catch (error) {
        if (error.code !== '23505') { // Ignore "already exists" errors
            console.error('Error creating citext extension:', error);
        }
    }
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
            dimensions JSONB DEFAULT '{"width": 0, "height": 0}',
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            extracted_audio BOOLEAN DEFAULT FALSE,
            resizes JSONB DEFAULT '{}',
            formats JSONB DEFAULT '{}',  -- Add this new field
            original_filename TEXT,
            file_size BIGINT,
            duration INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id)`);
}

async function createJobsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs(
            id SERIAL PRIMARY KEY,
            job_id VARCHAR(50) UNIQUE NOT NULL,
            type VARCHAR(20) NOT NULL, -- 'resize' or 'format'
            video_id VARCHAR(8) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
            job_data JSONB NOT NULL,
            worker_id VARCHAR(50), -- Which worker is processing this job
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ
        )`
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id)`);
}

async function seedDefaultUser() {
    try {
        // Check if admin user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        if (existingUser.rows.length === 0) {
            // Hash the password (you'll need to hash '123' first)
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('123', 10);
            
            await pool.query(`
                INSERT INTO users (name, username, password)
                VALUES ($1, $2, $3)
            `, ['Admin User', 'admin', hashedPassword]);
            
            console.log('Default admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error creating default user:', error);
    }
}

async function generate() {
    await createUserTable();
    await createVideoTable();
    await createJobsTable();
    await seedDefaultUser();
}

process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
});

module.exports = { pool , generate };