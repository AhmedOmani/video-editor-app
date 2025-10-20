const cluster = require("node:cluster");
const Queue = require("./utils/jobQueue.js");

if (cluster.isPrimary) {
    const cpus = require("node:os").availableParallelism();
    
    for (let i = 0 ; i < cpus ; i++) {
        const worker = cluster.fork();
        if (i === 0) {
            worker.send({ type: 'designate_job_processor' });
        }
    }

} else {
    require("./server.js");
}