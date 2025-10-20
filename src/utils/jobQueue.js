const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");
const jobRepo = require("../repositories/job.repository.js");
const videoProcessor = require("../utils/videoProcessor.js");
const errorHandler = require("../utils/errorHandler.js");

// Centralized job processing - database-based queue system
class JobQueue {
    constructor() {
        // remove noisy debug logs in production
        this.workerId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.isProcessing = false;
        this.pollInterval = 2000;
        this.isJobProcessor = false;
        this.isDbReady = process.env.DB_READY === '1';

        //get message from primary process
        process.on("message" , (msg) => {
            if (msg && msg.type === 'designate_job_processor') {
                this.isJobProcessor = true;
                console.log(`Worker ${this.workerId} designated as job processor`);
                this.maybeStart();
            }
        });

        // Fallback: allow leader election via env to avoid message race conditions
        if (process.env.JOB_LEADER === '1') {
            this.isJobProcessor = true;
            this.maybeStart();
        }
    }

    setDbReady() {
        this.isDbReady = true;
        this.maybeStart();
    }

    maybeStart() {
        if (this.isJobProcessor && this.isDbReady) {
            this.startProcessing();
        }
    }

    async startProcessing() {
        if (!this.isJobProcessor || !this.isDbReady) return;
        console.log(`Worker ${this.workerId} started`);
        await this.recoverJobs();

        setInterval(() => {
            if (!this.isProcessing) { 
                this.excuteNext();
            }
        }, this.pollInterval);
    }

    async recoverJobs() {
        try {
            const result = await jobRepo.getNotCompletedJobs(this.workerId);
            if (result.rows.length > 0) {
                console.log(`Recovered ${result.rows.length} jobs for worker ${this.workerId}`);
            }
        } catch (error) {
            console.error("Failed to recover jobs:", error);
        }
    }

    async enqueue(jobId, job) {
        const {type, videoId} = job;
        try {
            await jobRepo.addJob(jobId, type, videoId, job);
            console.log("Pushing new job of type:", type);
        } catch (error) {
            console.error("Failed to add job:", error);
            throw error;
        }
    }

    async excuteNext() {
        try {
            const rows = await jobRepo.getNextPendingJob(this.workerId);
            if (rows.length === 0) {
                // No jobs pending
                return;
            }

            const job = rows[0];
            this.isProcessing = true;
            
            console.log(`Worker ${this.workerId} processing job: ${job.job_id}`);

            const jobData = typeof job.job_data === 'string' ? JSON.parse(job.job_data) : job.job_data;

            try {
                await this.excute(jobData);
                await jobRepo.updateCompletedJob(job.id);
                await errorHandler.handleJobSuccess(job.job_id, jobData);
            } catch(error) {
                console.error(`Job ${job.job_id} failed:`, error);
                await jobRepo.updateFailedJob(job.id, error.message);
                await errorHandler.handleJobError(job.job_id, error, jobData);
            }
        
        } catch(error) {
            console.error("Failed to process job:", error);
        } finally {
            this.isProcessing = false;
        }
    }

    async excute(job) {
        try {
            if (job.type === "resize") {
                await this.resize(job);
            } else if (job.type === "change-format") {
                await this.changeFormat(job);
            } else {
                throw new Error(`Unknown job type: ${job.type}`);
            }

            console.log(`Job ${job.type} completed successfully`);
        } catch(error) {
            console.error(`Job ${job.type} failed:`, error);
            throw error; 
        }
    }

    async resize(job) {
        const {videoId, width, height} = job;
        try {
            
            
            const video = await videoRepo.getVideoById(videoId);
            if (!video) {
                throw new Error(`Video ${videoId} not found`);
            }

            const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
            const resizedVideoPath = storage.getFilePath(videoId, `${width}x${height}.${video.extension}`);

            await videoProcessor.videoResize(videoPath, resizedVideoPath, width, height);
            await videoRepo.updateResizeProcessingStatus(videoId, { width, height }, false);
            
            console.log("Resize job completed successfully for:", videoId);
            
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

        const {videoId, format} = job; 
        try {
            console.log("Processing format change job for VideoId:", videoId);
            const video = await videoRepo.getVideoById(videoId);
            if (!video) {
                throw new Error(`Video ${videoId} not found`);
            }

            const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
            const formatVideoPath = storage.getFilePath(videoId, `format_${format}.${format}`);

            await videoProcessor.changeFormat(videoPath, formatVideoPath, format);
            await videoRepo.updateFormatProcessingStatus(videoId, format, false);
            
            console.log("Format conversion job completed successfully for:", videoId);

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

}

module.exports = new JobQueue();