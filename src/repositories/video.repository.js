const { pool } = require("../db/db.js");

const createVideo = async (videoMetadata) => {
    const {
        videoId,
        name,
        extension,
        width,
        height,
        userId,
        originalFilename,
        fileSize,
    } = videoMetadata;

    const result = await pool.query(`
        INSERT INTO videos (
            video_id, name, extension, width, height, user_id,original_filename, file_size
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *` , 
        [videoId, name, extension, width, height, userId, 
        originalFilename, fileSize]);

    return result.rows[0];
};

const getVideoById = async (videoId , userId) => {
    const result = await pool.query(
        `SELECT * FROM videos WHERE video_id = $1 AND user_id = $2`,
        [videoId , userId]
    );
    return result.rows;
};

const getUserVideos = async (userId) => {
    const result = await pool.query(`
        SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
};

module.exports = {
    createVideo,
    getVideoById,
    getUserVideos
};