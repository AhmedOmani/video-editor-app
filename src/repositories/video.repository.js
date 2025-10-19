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
            video_id as "videoId",
            name,
            extension,
            dimensions,
            user_id as "userId",
            original_filename as "originalFilename",
            extracted_audio as "extractedAudio",
            resizes,
            formats,  -- Add this line!
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

    // Use direct JSONB merge
    const result = await pool.query(`
        UPDATE videos 
        SET resizes = COALESCE(resizes, '{}'::jsonb) || $1::jsonb
        WHERE video_id = $2
        RETURNING resizes
    `, [JSON.stringify({[resizeKey]: {processing}}), videoId]);
    
    return result.rows[0];
};

const updateFormatProcessingStatus = async (videoId, format, processing) => {

    const result = await pool.query(`
        UPDATE videos 
        SET formats = COALESCE(formats, '{}'::jsonb) || $1::jsonb
        WHERE video_id = $2
        RETURNING formats
    `, [JSON.stringify({[format]: {processing}}), videoId]);
    
    return result.rows[0];
};

// Get all videos with processing jobs that need to be re-scheduled
const getProcessingJobs = async () => {
    const result = await pool.query(`
        -- Get resize jobs that are processing
        SELECT 
            video_id as "videoId" ,
            name,
            extension,
            dimensions,
            'resize' as "jobType",
            resize_item.key as "jobKey"
        FROM videos,
             jsonb_each(resizes) AS resize_item
        WHERE resizes IS NOT NULL 
          AND resizes != '{}'::jsonb
          AND (resize_item.value->>'processing')::boolean = true

        UNION ALL

        -- Get format jobs that are processing  
        SELECT 
            video_id as "videoId" ,
            name,
            extension,
            dimensions,
            'format' as "jobType",
            format_item.key as "jobKey"
        FROM videos,
             jsonb_each(formats) AS format_item
        WHERE formats IS NOT NULL 
          AND formats != '{}'::jsonb
          AND (format_item.value->>'processing')::boolean = true
    `);
    
    return result.rows;
};

module.exports = {
    createVideo,
    getVideoById,
    getUserVideos,
    updateAudioState,
    updateResizeProcessingStatus,
    updateFormatProcessingStatus,
    getProcessingJobs
};