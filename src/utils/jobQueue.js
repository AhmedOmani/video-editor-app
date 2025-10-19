const storage = require("../utils/storage.js");
const videoRepo = require("../repositories/video.repository.js");
const jobRepo = require("../repositories/job.repository.js");
const videoProcessor = require("../utils/videoProcessor.js");
const errorHandler = require("../utils/errorHandler.js");

// Centralized job processing - database-based queue system
class JobQueue {
    constructor() {
        this.workerId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.isProcessing = false;
        this.pollInterval = 5000;

        //get message from primary process
        process.on("message" , (msg) => {
            if (msg.type === 'designate_job_processor') {
                this.isJobProcessor = true;
                console.log(`Worker ${this.workerId} designated as job processor`);
                this.startProcessing();
            }
        });
    }

    async startProcessing() {
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
            } else if (job.type === "extract-audio") {
                await this.extractAudio(job);
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

    async extractAudio(job) {
        const {videoId} = job;
        let audioPath;

        try {
            const video = await videoRepo.getVideoById(videoId);
            if (!video) {
                throw new Error(`Video ${videoId} not found`); 
            } 
            
            if (video.extracted_audio === true) {
                console.log("Audio already extracted for video:", videoId);
                return; // Skip processing 
            }

            const videoPath = storage.getFilePath(videoId, `original.${video.extension}`);
            audioPath = storage.getFilePath(videoId, "audio.aac");

            // Check if video has audio stream or not
            const hasAudio = await videoProcessor.hasAudioStream(videoPath);
            if (!hasAudio) {
                throw new Error("Video does not contain an audio track to extract"); 
            }

            await videoProcessor.extractAudio(videoPath, audioPath);
            await videoRepo.updateAudioState(videoId);

            console.log("Audio extraction job completed successfully");

        } catch(error) {
            console.error("Audio extraction error:", error);
            
            // Clean up failed file
            try {
                if (audioPath) {
                    await storage.deleteFile(audioPath); 
                }
            } catch (cleanupError) {
                console.error("Failed to clean up audio file:", cleanupError);
            }
            
            throw error; 
        }
    }
}

module.exports = new JobQueue();