const { Omix } = require("../Omix-Framework/Omix");
const { static } = require("../middleware/serve-static-files-middleware");
require("dotenv").config({ path : "../.env"});

const PORT = process.env.PORT;

const omix = new Omix();

omix.use(static("./public"));

console.log(PORT);
omix.listen(PORT , () => {
    console.log(`Omix server is up on port ${PORT}`);
});