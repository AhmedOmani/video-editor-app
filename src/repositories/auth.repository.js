const { pool } = require("../db/db.js");

const isUserExist = async (data) => {
    const {rows} = await pool.query("SELECT id, username, password FROM users WHERE username = $1", [data.username]);
    const user = rows[0];
    return user ;
}

const getUserById = async (userId) => {
    const { rows } = await pool.query(
        `SELECT id, name, username FROM users WHERE id = $1`,
        [userId]
    );
    return rows[0];
};

const getUserByUsername = async (username) => {
    const { rows } = await pool.query(
        `SELECT id, name, username FROM users WHERE username = $1`,
        [username]
    );
    return rows[0];
};

const updateUser = async (userId, { name, username, passwordHash }) => {
    
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(name);
    }
    if (username !== undefined) {
        fields.push(`username = $${idx++}`);
        values.push(username);
    }
    if (passwordHash !== undefined) {
        fields.push(`password = $${idx++}`);
        values.push(passwordHash);
    }

    if (fields.length === 0) return await getUserById(userId);

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, username`;
    const { rows } = await pool.query(query, values);
    return rows[0];
};

module.exports = {
    isUserExist,
    getUserById,
    getUserByUsername,
    updateUser,
}