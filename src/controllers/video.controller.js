const fs = require("node:fs/promises");
const path = require("node:path");

const crypto = require("node:crypto");
const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");
const videoProcessor = require("../utils/videoProcessor.js");
const jobQueue = require("../utils/jobQueue.js");
const errorHandler = require("../utils/errorHandler.js");

const getVideos = async (req , res) => {
    const userId = req.userId;
    const videos = await videoRepo.getUserVideos(userId);
    res.status(200).json(videos);
};

const uploadVideo = async (req , res) => {

    //TODO: handle unsupported file types.

    const requestHeaders = req.headers();

    //extracting file metadata
    const filename = requestHeaders.filename;
    const fileBasename = path.parse(filename).name;
    const extension = path.extname(filename).substring(1).toLowerCase();
    const videoId = crypto.randomBytes(4).toString("hex");
    
    let fileHandler;

    try {
        await storage.createVideoFolder(videoId);
        const videoFullPath = storage.getFilePath(videoId, `original.${extension}`);

        //open file and start streaming the content of the uploaded file.
        fileHandler = await fs.open(videoFullPath, "w");
        const fileWriteStream = fileHandler.createWriteStream();
        await req.pipe(fileWriteStream);

        // Get the Metadata of the video.
        const metadata = await videoProcessor.getVideoMetadata(videoFullPath);

        // Generate the thumbnail of the video.
        const thumbnailPath = storage.getFilePath(videoId , `thumbnail.jpg`);
        await videoProcessor.generateThumbnail(videoFullPath , thumbnailPath);

        const fileStats = await fs.stat(videoFullPath);

        const videoMetadata = {
            videoId: videoId,       
            name: fileBasename,
            extension: extension, 
            width: metadata.width,
            height: metadata.height,
            userId: req.userId, 
            originalFilename: filename,
            fileSize: fileStats.size,
            duration: metadata.duration
        };

        const savedVideo = await videoRepo.createVideo(videoMetadata);

        res.status(201).json({
            status: "success",
            message: "Video uploaded successfully",
            video: savedVideo
        });
    } catch(error) {
        console.log("[Uploading Error]: " , error);
        
        if (fileHandler) {
            try {
                await fileHandler.close();
            } catch(err) {
                console.log("Error closing file: " , err.message);
            }
        }

        await storage.deleteVideoFolder(videoId);

        if (error.code === "UPLOAD_ABORTED") return;

        res.status(500).json({
            message: "Internal Server Error",
            error: error
        });

    }
};

const getVideoAssets = async (req , res) => {
    const userId = req.userId;

    const params = req.queryParams();
    const videoId = params.get("videoId");
    const type = params.get("type");
    //somecases it will be null
    const dimentions = params.get("dimensions");

    try {
        const video = await videoRepo.getVideoById(videoId , userId);
        if (!video) {
            return res.status(404).json({
                message: "Video not found!"
            });
        }

        let filePath;
        switch (type) {
            case 'thumbnail':
                filePath = storage.getFilePath(videoId, 'thumbnail.jpg');
                break;
            case 'original':
                filePath = storage.getFilePath(videoId, `original.${video.extension}`);
                break;
            case 'audio':
                filePath = storage.getFilePath(videoId, 'audio.aac');
                break;
            case 'resize':
                filePath = storage.getFilePath(videoId, `${dimentions}.${video.extension}`);
                break;
            case 'change-format':
                const format = dimentions; // Reusing the dimensions parameter for format
                filePath = storage.getFilePath(videoId, `format_${format}.${format}`);
                break;
            default:
                return res.status(400).json({ error: 'Invalid asset type' });
        }


        //Helper functions to check if file exists in storage or not.
        const getFileNameForType = (type, video, dimentions) => {
            switch (type) {
                case 'thumbnail':
                    return 'thumbnail.jpg';
                case 'audio':
                    return 'audio.aac';
                case 'resize':
                    return `${dimentions}.${video.extension}`;
                case 'change-format':
                    return `format_${dimentions}.${dimentions}`;
                case 'original':
                    return `original.${video.extension}`;
            }
        };
        const fileName = getFileNameForType(type , video , dimentions);
        if (!fileName || !await storage.fileExists(videoId , fileName)) {
            return res.status(404).json({
                error: `Asset ${type} not found`
            });
        }
        
        let fileHandler ;
        let mimeType;

        switch(type) {
            case "thumbnail":
                fileHandler = await fs.open(filePath , "r");
                mimeType = "image/jpeg";
                break;
            case "original": //download the video for the client
                fileHandler = await fs.open(filePath , "r");
                mimeType = "video/mp4";
                break;
            case "audio":
                fileHandler = await fs.open(filePath , "r");
                mimeType = "audio/aac";
                break;
            case "resize":
                fileHandler = await fs.open(filePath , "r");
                mimeType = "video/mp4";
                break;
            case "change-format":
                fileHandler = await fs.open(filePath , "r");
                mimeType = `video/mp4`;
                break;
        }

        const readFileStream = fileHandler.createReadStream();

        if (type !== "thumbnail") {
            const extension = path.extname(filePath);
            const downloadedFilename = `${video.name}${extension}`;
            res.setHeader("Content-Disposition" , `attachment; filename=${downloadedFilename}`);
        }

        readFileStream.on("error" , (error) => {
            console.error("Read stream error: " , error);
            if (!res.headersSent()) {
                res.status(500).json({ error: 'Failed to read file' });
            }
        });

        req.rawReq.on('close', () => {
            console.log('Client disconnected, destroying read stream');
            readFileStream.destroy();
        });

        res.setHeader("Content-Type" , mimeType);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await res.pipe(readFileStream);
    
        fileHandler.close();

    } catch (error) {
        console.error('Asset serving error:', error);
        
        if (!res.headersSent()) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'Asset not found' });
            } else if (error.code === 'EACCES') {
                res.status(403).json({ error: 'Access denied' });
            } else if (error.code === 'ENOMEM') {
                res.status(413).json({ error: 'File too large' });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }
    
};

const extractAudio = async (req, res) => {
    const params = req.queryParams();
    const videoId = params.get("videoId");

    try {
        // Validate video and ensure it actually has an audio stream before queuing
        const video = await videoRepo.getVideoById(videoId);
        if (!video) {
            return res.status(404).json({
                message: "Video not found!"
            });
        }
        
        const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
        const audioPath = storage.getFilePath(videoId , "audio.aac");
        const hasAudio = await videoProcessor.hasAudioStream(videoPath);
        
        if (!hasAudio) {
            return res.status(400).json({
                message: "Video does not contain an audio track to extract"
            });
        }

        await videoProcessor.extractAudio(videoPath, audioPath);
        await videoRepo.updateAudioState(videoId);

        console.log("Audio extraction job completed successfully");

        res.status(200).json({
            status: "success",
            message: "Audio extraction job finished successfully",
        });

    } catch (error) {
        console.error("Error while scheduling extract audio process:", error);
        if (res && !res.headersSent()) {
            res.status(500).json({
                error: "Failed to start audio extraction process",
                message: error.message
            });
        }
    }
};

const resizeVideo = async (req, res) => {
    const data = await req.body();
    const videoId = data.videoId;
    const width = Number(data.width);
    const height = Number(data.height);

    try {
        const video = await videoRepo.getVideoById(videoId);
        if (!video) {
            return res.status(404).json({
                message: "Video not found!"
            });
        }
        
        if (width <= 0 || height <= 0) {
            return res.status(400).json({
                message: "Width and height should be greater than 0"
            });
        }
        
        if (width >= video.dimensions.width || height >= video.dimensions.height) {
            return res.status(400).json({
                message: "Resize dimensions should be smaller than original dimensions"
            });
        }

        await videoRepo.updateResizeProcessingStatus(videoId, { width, height }, true);
        
        // Create job ID
        const jobId = `resize_${videoId}_${Date.now()}`;

        // Register error callback before adding job
        errorHandler.registerErrorCallback(jobId, async (error, jobData) => {
            if (res && !res.headersSent()) {
                res.status(500).json({
                    error: "Resize job failed",
                    message: error.message,
                    jobId: jobId
                });
            }
        });

        // Add job to queue with job ID
        await jobQueue.enqueue(jobId, {
            type: "resize",
            videoId: videoId,
            width: width,
            height: height
        });

        // Send immediate response
        res.status(200).json({
            status: "success",
            message: "Resize job queued successfully! This process could take up to a few hours. Please check back later",
            jobId: jobId
        });

    } catch (error) {
        console.error("Error while scheduling resize process:", error);
        if (res && !res.headersSent()) {
            res.status(500).json({
                error: "Failed to start resize process",
                message: error.message
            });
        }
    }
};

const changeFormat = async (req, res) => {
    const data = await req.body();
    const videoId = data.videoId;
    const format = data.format.toLowerCase();

    try {
        const video = await videoRepo.getVideoById(videoId);
        if (!video) {
            return res.status(404).json({
                message: "Video not found!"
            });
        }

        if (format === video.extension.toLowerCase()) {
            return res.status(400).json({
                message: "The selected format is the same as the original video format"
            });
        }

        await videoRepo.updateFormatProcessingStatus(videoId, format, true);

        // Create job ID
        const jobId = `change-format_${videoId}_${Date.now()}`;

        // Register error callback before adding job
        errorHandler.registerErrorCallback(jobId, async (error, jobData) => {
            if (res && !res.headersSent()) {
                res.status(500).json({
                    error: "Format conversion job failed",
                    message: error.message,
                    jobId: jobId
                });
            }
        });

        // Add job to queue with job ID
        await jobQueue.enqueue(jobId, {
            type: "change-format",
            videoId: videoId,
            format: format
        });

        // Send immediate response
        res.status(200).json({
            status: "success",
            message: "Format conversion job queued successfully! This process could take up to a few hours. Please check back later",
            jobId: jobId
        });

    } catch (error) {
        console.error("Error while scheduling format conversion process:", error);
        if (res && !res.headersSent()) {
            res.status(500).json({
                error: "Failed to start format conversion process",
                message: error.message
            });
        }
    }
};

module.exports = {
    uploadVideo,
    getVideos,
    getVideoAssets,
    extractAudio,
    resizeVideo,
    changeFormat
};