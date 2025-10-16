const config = require("../config");
const jwt = require("jsonwebtoken");

const JWT_SECRET = config.jwt.secret;

const authMiddleware = async (req , res , next) => {
    const requestHeaders = req.headers();

    const cookieHeader = requestHeaders["cookie"];

    if (!cookieHeader) {
        console.error("[Authentication Middleware Error]: No cookie header provided");
        return res.status(401).json({
            error: "Unautorized, cookie missed!"
        });
    } 

    const tokenMatch = cookieHeader.split(";").find(c => c.trim().startsWith("token="));
    if (!tokenMatch) {
        console.error("[Authentication Middleware Error]: No token provided");
        return res.status(401).json({
            error: "Unautorized, token missed!"
        });
    }

    const token = tokenMatch.split("=")[1].trim();
    
    try {
        const decoded = jwt.verify(token , JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        if (error.name == "TokenExpiredError") {
            return res.status(401).json({ error: "Token expired"});
        }
        return res.status(401).json({error: "Invalid token"});
    }
}

module.exports = {
    authMiddleware
}