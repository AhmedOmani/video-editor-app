const fs = require("node:fs/promises");
const path = require("node:path");

const mimeTypes = {
    '.html': 'text/html', // url: /index.html
    '.css': 'text/css',// url: /styles.css
    '.js': 'text/javascript', // url: /scripts.js
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

const static = (rootDir) => {
    return async (req , res , next) => {
        if (req.rawReq.method != "GET" && req.rawReq.method != "HEAD") {
            return next();
        }

        let requestPath = req.rawReq.url;
        // Frontend page calls
        if (requestPath === "/" || requestPath === "/profile" || requestPath === "/login" || requestPath === "/new-post") 
            requestPath = "/index.html";

        // Resolve static root relative to current working directory if not absolute
        const staticRoot = path.isAbsolute(rootDir) ? rootDir : path.resolve(process.cwd(), rootDir);
        // Prevent absolute request paths from discarding staticRoot during join
        const normalizedPath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
        const fullPath = path.join(staticRoot , normalizedPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = mimeTypes[ext] || "application/octet-stream";
           
        try {
            const stats = await fs.stat(fullPath);
            //move forward if the the path is directory.
            
            if (stats.isDirectory()) next();
            res.sendFile(fullPath , contentType);
        } catch(err) {
            
            if (err.code === "ENOENT") {
                return next();
            }
            console.error("Static file serving error: " , err);
            res.status(500).json({
                message: "Internal Server Error from serving statuc file",
                error: err
            });
        }
    }
}

module.exports = {
    static
}