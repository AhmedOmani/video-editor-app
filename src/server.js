const config = require("./config");
const { Omix } = require("../Omix-Framework/Omix");
const { generate } = require("./db/db.js");
const { static } = require("./middleware/serve-static-files-middleware");
const { authMiddleware } = require("./middleware/auth.middleware.js");
const { login , logout } = require("./controllers/auth.controller.js");
const bcrypt = require("bcrypt");

const PORT = config.server.port;

const omix = new Omix();

omix.use(static("./public"));

//Auth-routes
omix.post("/api/login" , login);
omix.delete("/api/logout" , authMiddleware , logout);

omix.listen(PORT , async () => {
    await generate();
    console.log(`Omix server is up on port ${PORT}`);
});