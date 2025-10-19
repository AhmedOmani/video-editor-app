const { pool } = require("../db/db.js");

const getNotCompletedJobs = async (workerId) => {
    const result = await pool.query(`
                UPDATE jobs 
                SET status = 'pending', worker_id = NULL, started_at = NULL
                WHERE worker_id = $1 AND status = 'processing'
                RETURNING *
            `, [workerId]);
    return result;
};

const addJob = async (jobId , type, videoId, job) => {
    const result = await pool.query(`
        INSERT INTO jobs (job_id, type, video_id, status, job_data)
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *
    `, [jobId, type, videoId, JSON.stringify(job)]);
    return result.rows[0];
};

const getNextPendingJob = async (workerId) => {
    const result = await pool.query(`
        UPDATE jobs 
        SET status = 'processing', worker_id = $1, started_at = NOW()
        WHERE id = (
            SELECT id FROM jobs 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING *
    `, [workerId]);
    
    return result.rows ;
};

const updateCompletedJob = async (jobId) => {
    await pool.query(`
        UPDATE jobs 
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
    `, [jobId]);
};

const updateFailedJob = async (jobId) => {
    await pool.query(`
        UPDATE jobs 
        SET status = 'failed', completed_at = NOW()
        WHERE id = $1
    `, [jobId]);
};

module.exports = {
    getNotCompletedJobs,
    addJob,
    getNextPendingJob,
    updateCompletedJob,
    updateFailedJob
}