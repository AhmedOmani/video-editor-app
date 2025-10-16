require("dotenv").config({path : "/home/hp/video-editor-app/.env"});

const config = {
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_DATABASE
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    server: {
        port: process.env.APP_PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        httpOnly: true,
    }
}

const requiredVars = [
    'DB_HOST',
    'DB_PORT', 
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE',
    'JWT_SECRET'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error("Missing required enviroment variables: " , missingVars);
    process.exit(1);
} 

module.exports = config;