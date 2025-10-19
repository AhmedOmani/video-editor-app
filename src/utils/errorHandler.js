class ErrorHandler {
    constructor() {
        this.errorCallbacks = new Map(); // Store callbacks by job ID
    }

   
    registerErrorCallback(jobId, callback) {
        this.errorCallbacks.set(jobId, callback);
    }

    removeErrorCallback(jobId) {
        this.errorCallbacks.delete(jobId);
    }


    async handleJobError(jobId, error, jobData) {
        const callback = this.errorCallbacks.get(jobId);
        
        if (callback) {
            try {
                await callback(error, jobData);
            } catch (callbackError) {
                console.error("Error in error callback:", callbackError);
            }
        }

        this.removeErrorCallback(jobId);
    }

    handleJobSuccess(jobId, result) {
        this.removeErrorCallback(jobId);
    }
}

module.exports = new ErrorHandler();