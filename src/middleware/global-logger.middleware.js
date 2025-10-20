const globalLoggerMiddleware = (req , res , next) => {
    console.log(`[GLOBAL]: worker ${process.pid} handles => ${req.rawReq.method} to ${req.rawReq.url}`);
    next();
}

module.exports = {
    globalLoggerMiddleware
}