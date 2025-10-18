const path = require("node:path");
const fs = require("node:fs/promises");
const config = require("../config");

class StorageManager { 
    constructor() {
        this.basePath = config.storage.basePath;
    }

    //get absolute path for video FOLDER
    getVideoPath(videoId) {
        return path.join(this.basePath , videoId);
    }

    //get absolute path for video FILE itself
    getFilePath(videoId , filename) {
        return path.join(this.getVideoPath(videoId) , filename);
    } 

    async fileExists(videoId , filename) {
        
        try {
            await fs.access(this.getFilePath(videoId , filename));
            return true;
        } catch(error) {
            return false;
        }
    }

    async createVideoFolder(videoId , filename) {
        const folderPath = this.getVideoPath(videoId);
        await fs.mkdir(folderPath , { recursive: true});
        return folderPath;
    }

    async deleteVideoFolder(videoId) {
        const folderPath = this.getVideoPath(videoId);
        try {
            await fs.rm(folderPath , {recursive: true});
        } catch(error) {
            console.log("Error deleting folder:" , error.message);
        }
    }

    async deleteFile(audioPath) {
        try {
            if (this.fileExists(audioPath)) {
                await fs.unlink(audioPath);
            }
        } catch(error) {
            console.log("Error while deleting file: " , error);
        }
    }

}

module.exports = new StorageManager();