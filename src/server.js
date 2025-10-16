const config = require("./config");
const { Omix } = require("../Omix-Framework/Omix");
const { generate } = require("./db/db.js");
const { static } = require("./middleware/serve-static-files-middleware");
const { authMiddleware } = require("./middleware/auth.middleware.js");
const { globalLoggerMiddleware } = require("./middleware/global-logger.middleware.js"); 
const Auth = require("./controllers/auth.controller.js");
const Video = require("./controllers/video.controller.js");
const bcrypt = require("bcrypt");

const PORT = config.server.port;

const omix = new Omix();

omix.use(globalLoggerMiddleware);
omix.use(static("./public"));

//Auth-routes
omix.post("/api/login" , Auth.login);
omix.delete("/api/logout" , authMiddleware , Auth.logout);

//Videos-routes
omix.post("/api/upload-video" , authMiddleware , Video.uploadVideo);

omix.listen(PORT , async () => {
    await generate();
    console.log(`Omix server is up on port ${PORT}`);
});