const config = require("../config");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

const { isUserExist , saveToken } = require("../repositories/auth.repository.js")

const generateToken = (userId) => {
    return jwt.sign({userId} , JWT_SECRET , {expiresIn: JWT_EXPIRES_IN});
}

const login = async (req , res) => {
    try {
        const data = await req.body();
        
        const user = await isUserExist(data);
        if (!user) {
            return res.status(401).json({
                message: "Username is not exist"
            });
        }

        const password = data.password;
        const hashedPassword = user.password;
        const isPasswordValid = await bcrypt.compare(password , hashedPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: "Username or Password are not correct"
            });
        }

        const token = generateToken(user.id);
        
        res.setHeader("Set-Cookie" , `token=${token}; Path=/; Max-Age=86400`)
           .status(200)
           .json({
                message: "User logged in successfully" ,
                data: {
                    username: user.username,
                } 
        });
    } catch (error) {
        console.log("[Server Error]: " , error);
        res.status(500).json({
            message: "Internal Server Error",
            error: error
        });
    }
}

const logout = async (req , res) => {
    res.setHeader("Set-Cookie", 
        `token=; Path=/; HttpOnly; ${config.cookie.secure ? 'Secure;' : ''} SameSite=${config.cookie.sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    res.json({
        message: "User logged out successfully"
    });
}


module.exports = {
    login,
    logout
}