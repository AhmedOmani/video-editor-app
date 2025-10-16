const path = require("node:path");

const uploadVideo = (req , res) => {
    const requestHeaders = req.headers();
    const filename = requestHeaders.filename;
    
    const fileBasename = path.parse(filename).name;
    const extension = path.extname(filename).substring(1).toLowerCase();

    //TODO: start reading the contetn binary files
};

module.exports = {
    uploadVideo
}