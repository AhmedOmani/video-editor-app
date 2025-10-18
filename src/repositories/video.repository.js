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
        duration
    } = videoMetadata;

    const result = await pool.query(`
        INSERT INTO videos (
            video_id, name, extension, dimensions, user_id, 
            original_filename, file_size, duration
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`, 
        [
            videoId, 
            name, 
            extension, 
            JSON.stringify({ width, height }), // Store as JSON
            userId, 
            originalFilename, 
            fileSize,
            duration,
        ]
    );

    return result.rows[0];
};

const getVideoById = async (videoId) => {
    const result = await pool.query(
        `SELECT * FROM videos WHERE video_id = $1`,
        [videoId]
    );
    return result.rows[0];
};

const getUserVideos = async (userId) => {
    const result = await pool.query(`
        SELECT 
            id,
            video_id as "videoId",  -- Alias video_id to videoId
            name,
            extension,
            dimensions,
            user_id as "userId",    -- Also alias user_id to userId
            original_filename as "originalFilename",
            extracted_audio as "extractedAudio",
            resizes,
            file_size as "fileSize",
            created_at as "createdAt",
            updated_at as "updatedAt"
        FROM videos 
        WHERE user_id = $1 
        ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
};

const updateAudioState = async (videoId) => {
    const result = await pool.query(`UPDATE videos SET extracted_audio = true WHERE video_id = $1` , [videoId]);
    return result.rows[0];
};

const updateResizeProcessingStatus = async (videoId , dimensions , processing) => {
    const resizeKey = `${dimensions.width}x${dimensions.height}`;
    
    console.log("DEBUG - resizeKey:", resizeKey);
    console.log("DEBUG - processing:", processing);
    console.log("DEBUG - videoId:", videoId);

    // Use direct JSONB merge
    const result = await pool.query(`
        UPDATE videos 
        SET resizes = COALESCE(resizes, '{}'::jsonb) || $1::jsonb
        WHERE video_id = $2
        RETURNING resizes
    `, [JSON.stringify({[resizeKey]: {processing}}), videoId]);

    console.log("DEBUG - Updated resizes:", result.rows[0]?.resizes);
    
    return result.rows[0];
};

const updateFormatProcessingStatus = async (videoId, format, processing) => {
    console.log("DEBUG - format:", format);
    console.log("DEBUG - processing:", processing);
    console.log("DEBUG - videoId:", videoId);

    const result = await pool.query(`
        UPDATE videos 
        SET formats = COALESCE(formats, '{}'::jsonb) || $1::jsonb
        WHERE video_id = $2
        RETURNING formats
    `, [JSON.stringify({[format]: {processing}}), videoId]);

    console.log("DEBUG - Updated formats:", result.rows[0]?.formats);
    
    return result.rows[0];
};

module.exports = {
    createVideo,
    getVideoById,
    getUserVideos,
    updateAudioState,
    updateResizeProcessingStatus
};