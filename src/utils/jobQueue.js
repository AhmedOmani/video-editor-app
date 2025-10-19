const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");
const videoProcessor = require("../utils/videoProcessor.js");

// Queued based processing - design pattern (Youtube use it!)
class JobeQueue {
    constructor () {
        this.jobs = [];
        this.currentJob = null;
        this.isProcessing = false;
    }

    enqueue(job) {
        console.log(`Pushing new job of type: ${job.type}...`);
        this.jobs.push(job);
        this.excuteNext();
    }

    // we can playaround it and pick more that just one process...
    dequeue() {
        return this.jobs.shift();
    }
    async excuteNext() {
        if (this.isProcessing) return ;
        
        const job = this.dequeue();
        if (!job) return ;

        this.isProcessing = true;
        this.currentJob = job;

        try {
            await this.excute(job);
        } catch(error) {
            console.error("Job excution failed: " , error);
            await this.handleJobFailur(job, error);
        } finally {
            this.currentJob = null ;
            this.isProcessing = false;
            setImmediate(() => this.excuteNext());
        }
        
    }

    async excute(job) {
        try {
            if (job.type === "resize") await this.resize(job);
            else if (job.type === "change-format") await this.changeFormat(job);
            //After finish each job we will iterate again ...
            console.log(`Job ${job.type} completed sucessfully`);
        } catch(error) {
            console.error(`Job ${job.type} failed: ` , error);
            throw error;
        }
    }

    async resize(job) {
        const {videoId , width , height , res} = job;
        try {
            console.log("Processing resize job for VideoId:", videoId);
            
            const video = await videoRepo.getVideoById(videoId);
            if (!video) {
                throw new Error(`Video ${videoId} not found`);
            }

            const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
            const resizedVideoPath = storage.getFilePath(videoId, `${width}x${height}.${video.extension}`);

            await videoProcessor.videoResize(videoPath, resizedVideoPath, width, height);
            await videoRepo.updateResizeProcessingStatus(videoId, { width, height }, false);
            
            console.log("Resize completed successfully for:", videoId);
            console.log(`Number of jobs remaining: ${this.jobs.length}`);
            
        } catch(error) {
            console.error("Resize process error:", error);
            
            // Clean up failed file
            try {
                const failedFilePath = storage.getFilePath(videoId, `${width}x${height}.${video.extension}`);
                await storage.deleteFile(failedFilePath);
            } catch (cleanupError) {
                console.error("Failed to clean up file:", cleanupError);
            }
            
            // Update database to set processing to false
            try {
                await videoRepo.updateResizeProcessingStatus(videoId, { width, height }, false);
            } catch (dbError) {
                console.error("Failed to update database status:", dbError);
            }
            
            throw error; 
        }
    }

    async changeFormat(job) {
        const {videoId , format , res } = job;
        try {
            console.log("Processing format change job for VideoId:", videoId);
            const video = await videoRepo.getVideoById(videoId);
            if (!video) {
                console.error(`Video ${videoId} not found`);
                return res.status(404).json({
                    message: "Video not found!"
                });
            }

            const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
            const formatVideoPath = storage.getFilePath(videoId, `format_${format}.${format}`);

            await videoProcessor.changeFormat(videoPath, formatVideoPath, format);
            await videoRepo.updateFormatProcessingStatus(videoId, format, false);
            
            console.log("Format conversion completed successfully for:", videoId);
            console.log(`Number of jobs remaining: ${this.jobs.length}`);

        } catch(error) {
            console.error("Format conversion error:", error);
        
            try {
                const failedFilePath = storage.getFilePath(videoId, `format_${format}.${format}`);
                await storage.deleteFile(failedFilePath);
            } catch (cleanupError) {
                console.error("Failed to clean up file:", cleanupError);
            }    
            
            try {
                await videoRepo.updateFormatProcessingStatus(videoId, format, false);
            } catch (dbError) {
                console.error("Failed to update database status:", dbError);
            }
            
            throw error;
        }
    }

    async handleJobFailure(job, error) {
        console.error(`Job ${job.type} failed permanently:`, error);
        
        if (job.type === "resize") {
            try {
                await videoRepo.updateResizeProcessingStatus(job.videoId, { 
                    width: job.width, 
                    height: job.height 
                }, false);
            } catch (dbError) {
                console.error("Failed to update database after job failure:", dbError);
            }
        }
    }

    getStatus() {
        return {
            isProcessing: this.isProcessing,
            currentJob: this.currentJob,
            queueLength: this.jobs.length,
            jobs: this.jobs.map(job => ({
                type: job.type,
                videoId: job.videoId,
            }))
        };
    }
}

module.exports = new JobeQueue();