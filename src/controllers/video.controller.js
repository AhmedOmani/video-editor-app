const fs = require("node:fs/promises");
const path = require("node:path");

const crypto = require("node:crypto");
const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");
const videoProcessor = require("../utils/videoProcessor.js");

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
            case "thumbnail":
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
            default:
                return res.status(400).json({ error: 'Invalid asset type' });
        }

        //check if the file exists
        if (!await storage.fileExists(videoId, `${type === 'thumbnail' ? 'thumbnail.jpg' : type === 'audio' ? 'audio.aac' : dimentions !== null ? `${dimentions}.${video.extension}` : `original.${video.extension}`}`)) {
            return res.status(404).json({ error: `Asset ${type} not found` });
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
                fileHandled = await fs.open(filePath , "r");
                mimeType = "video/mp4";
                break;
            // audio , resize , original
        }

        const readFileStream = fileHandler.createReadStream();

        if (type !== "thumbnail") {
            const extension = path.extname(filePath);
            const downloadedFilename = `${video.name}.${extension}`;
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
    
}

const extractAudio = async (req , res) => {
    const params = req.queryParams();
    const videoId = params.get("videoId");
    let audioPath;
    try {
        const video = await videoRepo.getVideoById(videoId);

        if (!video) {
            return res.status(404).json({
                message: "Video not found"
            });
        } 
        if (video.extracted_audio === true) {
            return res.status(400).json({
                message: "Audio has already been extracted"
            });
        }
        
        const videoPath = storage.getFilePath(videoId , `original.${video.extension}`);
        audioPath = storage.getFilePath(videoId , "audio.aac");

        //check if video has audio stream or not.
        const hasAudio = await videoProcessor.hasAudioStream(videoPath);
        if (!hasAudio) {
            return res.status(400).json({
                message: "Video does not contain an audio track to extract"
            });
        }
        
        await videoProcessor.extractAudio(videoPath, audioPath);
        await videoRepo.updateAudioState(videoId);

        res.status(200).json({
            status: "success",
            message: "Audio extracted successfully",
            audioPath: audioPath
        });

    } catch(error) {
        console.error("Audio extraction error:", error);
        storage.deleteAudioFile(audioPath);
        res.status(500).json({
            message: "Failed to extract audio",
            error: error.message
        });
    }
}

module.exports = {
    uploadVideo,
    getVideos,
    getVideoAssets,
    extractAudio
};