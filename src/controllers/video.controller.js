const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");

const uploadVideo = async (req , res) => {
    const requestHeaders = req.headers();

    //extracting file metadata
    const filename = requestHeaders.filename;
    const fileBasename = path.parse(filename).name;
    const extension = path.extname(filename).substring(1).toLowerCase();
    const videoId = crypto.randomBytes(4).toString("hex");
    
    let fileHandler;

    try {
        await storage.createVideoFolder(videoId);
        const fileFullPath = storage.getFilePath(videoId, `original.${extension}`);

        //open file and start streaming the content of the uploaded file.
        fileHandler = await fs.open(fileFullPath, "w");
        const fileWriteStream = fileHandler.createWriteStream(fileHandler);
        await req.pipe(fileWriteStream);

        // TODO: Make the thumbnail of the video.
        // TODO: Get the dimenstions of the video.

        const fileStats = await fs.stat(fileFullPath);

        const videoMetadata = {
            videoId: videoId,       
            name: fileBasename,
            extension: extension, 
            width: 0,
            height: 0,
            userId: req.userId, 
            originalFilename: filename,
            fileSize: fileStats.size,
            duration: null
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

module.exports = {
    uploadVideo
}