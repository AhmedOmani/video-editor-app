const config = require("../config");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

const { isUserExist, getUserById, getUserByUsername, updateUser } = require("../repositories/auth.repository.js")

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
};

const logout = async (req , res) => {
    res.setHeader("Set-Cookie", 
        `token=; Path=/; HttpOnly; ${config.cookie.secure ? 'Secure;' : ''} SameSite=${config.cookie.sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    res.json({
        message: "User logged out successfully"
    });
};

const updateProfile = async (req , res) => {
    try {
        const data = await req.body();
        const { name , username , password } = data ; 

        // Basic validation
        if (name !== undefined && typeof name !== 'string') {
            return res.status(400).json({ error: 'Invalid name' });
        }
        if (username !== undefined && typeof username !== 'string') {
            return res.status(400).json({ error: 'Invalid username' });
        }
        if (password !== undefined && typeof password !== 'string') {
            return res.status(400).json({ error: 'Invalid password' });
        }

        if (username) {
            const existing = await getUserByUsername(username);
            if (existing && existing.id !== req.userId) {
                return res.status(409).json({ error: 'Username already in use' });
            }
        }

        let passwordHash;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const updated = await updateUser(req.userId, { name, username, passwordHash });

        return res.status(200).json({
            message: 'Profile updated successfully',
            data: {
                id: updated.id,
                name: updated.name,
                username: updated.username,
            }
        });
    } catch (error) {
        console.log('[Update Profile Error]: ', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

module.exports = {
    login,
    logout,
    updateProfile
}