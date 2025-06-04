const express = require("express");
const router = express.Router();

const argon2 = require('argon2');

const db = require('../../utils/database');

router.post("/login", async (req, res) => {
    const { username, password, apiKey } = req.body;
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({
            message: "Invalid data"
        });
    }

    if (!username || !password) {
        return res.status(400).json({
            message: "Missing fields"
        });
    }

    const sql = `SELECT * FROM users WHERE username = '${username}'`;
    db.query(sql, async (err, result) => {
        if (err) throw err;
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const user = result.rows[0];
        if (await argon2.verify(user.password, password)) {
            return res.status(200).json({
                message: "Logged in"
            });
        } else {
            return res.status(401).json({
                message: "Invalid data"
            });
        }
    });

});


module.exports = router;