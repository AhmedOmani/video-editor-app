const { pool } = require("../db/db.js");

const isUserExist = async (data) => {
    const {rows} = await pool.query("SELECT id, username, password FROM users WHERE username = $1", [data.username]);
    const user = rows[0];
    return user ;
}

module.exports = {
    isUserExist,
}