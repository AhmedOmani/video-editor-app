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

}

module.exports = new StorageManager();