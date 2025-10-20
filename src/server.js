const config = require("./config");
const { Omix } = require("../Omix-Framework/Omix");
const { generate } = require("./db/db.js");
const { static } = require("./middleware/serve-static-files-middleware");
const { authMiddleware } = require("./middleware/auth.middleware.js");
const { globalLoggerMiddleware } = require("./middleware/global-logger.middleware.js"); 
const Auth = require("./controllers/auth.controller.js");
const Video = require("./controllers/video.controller.js");


const PORT = config.server.port;

const omix = new Omix();

omix.use(globalLoggerMiddleware);
omix.use(static("./public"));

omix.get("/api/user", authMiddleware, (req, res) => {
    res.json({
        id: req.userId,
        message: "User is authenticated"
    });
});

//Auth-routes
omix.post("/api/login" , Auth.login);
omix.delete("/api/logout" , authMiddleware , Auth.logout);
omix.put("/api/user" , authMiddleware , Auth.updateProfile);

//Videos-routes
omix.get("/api/videos" , authMiddleware , Video.getVideos);
omix.post("/api/upload-video" , authMiddleware , Video.uploadVideo);
omix.patch("/api/video/extract-audio" , authMiddleware , Video.extractAudio);
omix.get("/get-video-asset" , authMiddleware , Video.getVideoAssets);
omix.put("/api/video/resize" , authMiddleware , Video.resizeVideo);
omix.put("/api/video/change-format" , authMiddleware , Video.changeFormat);


omix.listen(PORT , async () => {
    await generate();
    // Signal DB readiness to job queue leader
    try {
        process.env.DB_READY = '1';
        // If we're the designated worker and queue is loaded in this process, notify it
        try { require('./utils/jobQueue').setDbReady?.(); } catch(_) {}
    } catch(_) {}
    console.log(`Omix server is up on port ${PORT}`);
});