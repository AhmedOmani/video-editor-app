const fs = require("node:fs");
const fss = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");

class OmixResponse {
    constructor(res) {
        this.rawRes = res;
        this.statusCode = 200;
    }

    headersSent() {
        return this.rawRes.headersSent
    }

    status(code) {
        this.statusCode = code ;
        return this;
    }

    setHeader(header , value) {
        this.rawRes.setHeader(header , value);
        return this;
    }

    sendFile(filePath, contentType = "text/plain") {
        const readStream = fs.createReadStream(filePath);

        readStream.on("error" , (err) => {
            console.error("File Read Error: " , err);
            if (err.code == "ENOENT") {
                this.rawRes.writeHead(404 , { "Content-Type" : "text/plain" });
                this.rawRes.end("404 File Not Found");
            } else {
                this.rawRes.writeHead(500 , { "Content-Type" : "text/plain" });
                this.rawRes.end("500 Internal Server Error");
            }
        });

        this.rawRes.writeHead(this.statusCode , {"Content-Type" : contentType});
        readStream.pipe(this.rawRes);
    }

    send(data) {
        this.rawRes.writeHead(this.statusCode , { 'Content-Type' : 'text/plain' });
        this.rawRes.end(data);
        return this;
    }

    json(data) {
        this.rawRes.writeHead(this.statusCode , {"Content-Type" : "application/json"});
        this.rawRes.write(JSON.stringify(data));
        this.end();
        return this
    }

    end(data) {
        this.rawRes.end(data);
    }

    async pipe(readableStream) {
        try {    
            return await pipeline(readableStream, this.rawRes);
        } catch (error) {
            // Handle premature close gracefully
            if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                console.log('Client disconnected during asset streaming');
                return; // Don't throw, just return
            }
            
            // Handle other stream errors
            if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
                console.log('Connection reset during asset streaming');
                return; // Don't throw, just return
            }
            
            console.log("Error while reading asset:", error.message);
            throw error; // Re-throw other errors
        }
    }
}

module.exports = { OmixResponse };