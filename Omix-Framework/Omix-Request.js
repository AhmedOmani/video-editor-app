const { pipeline } = require("node:stream/promises");

class OmixRequest {
    constructor(req, params , searchUrls) {
        this.rawReq = req ;
        this.params = params;
        this.queryParam = searchUrls
    }

    queryParams() {
        return this.queryParam;
    }

    headers() {
        return this.rawReq.headers ;
    }

    body() {
        return new Promise((resolve , reject) => {
            let data = "";
            this.rawReq.on("data" , (chunk) => data += chunk.toString());
            this.rawReq.on("error" , (err) => reject(err));
            this.rawReq.on("end" , () => {
                const contentType = this.rawReq.headers["content-type"] || "";
                try {
                    if (contentType.includes("application/json")) {
                        resolve(JSON.parse(data || '{}'));
                    } else {
                        resolve(data);
                    }
                } catch(err) {
                    reject(new Error("Invalid JSON body received"));
                }
            }); 
        });
    }

    async pipe(writableStream) {
        try {    
            return await pipeline(this.rawReq , writableStream);
        } catch (error) {
            if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
                const abortError = new Error("Upload aborted by client");
                abortError.code = "UPLOAD_APORTED";
                throw abortError;
            }
            throw error;
        }
    }
}

module.exports = {
    OmixRequest
}