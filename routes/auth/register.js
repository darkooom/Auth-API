const express = require("express");
const router = express.Router();
const argon2 = require('argon2');

const db = require('../../utils/database');

router.post("/register", (req, res) => {
    const { username, password, email, key, apiKey } = req.body;
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({
            message: "Invalid API Key"
        });
    }

    if (!username || !password || !email || !key) {
        return res.status(400).json({
            message: "Missing fields"
        });
    }

    const sql = `SELECT * FROM users WHERE username = '${username}' OR email = '${email}'`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        if (result.rows.length > 0) {
            return res.status(405).json({
                message: "User already exists"
            });
        }
    });

    const sql2 = `SELECT * FROM keys WHERE key = '${key}'`;
    db.query(sql2, (err, result) => {
        if (err) throw err;
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Key not found"
            });
        }
    });

    const sql3 = `SELECT * FROM users WHERE key = '${key}'`;
    db.query(sql3, (err, result) => {
        if (err) throw err;
        if (result.rows.length > 0) {
            return res.status(409).json({
                message: "Key already used"
            });
        }
    });

    const sql4 = `SELECT * FROM keys WHERE key = '${key}'`;
    db.query(sql4, (err, result) => {
        if (err) throw err;
        const keyDuration = result.rows[0].duration;
        const keyDurationInDays = keyDuration * 30;
        const currentDate = new Date();
        const expirationDate = new Date(currentDate.getTime() + (keyDurationInDays * 24 * 60 * 60 * 1000));
        const expirationDateFormatted = expirationDate.getFullYear() + "-" + (expirationDate.getMonth() + 1) + "-" + expirationDate.getDate();
        argon2.hash(password).then(hash => {

            const sql = `INSERT INTO users (username, password, email, key, expiration) VALUES ('${username}', '${hash}', '${email}', '${key}', '${expirationDateFormatted}')`;
            db.query(sql, (err, result) => {
                if (err) throw err;
                res.status(201).json({
                    message: "User created"
                });
            });
        }).catch(err => {
            console.log(err);
        });
    });

});

module.exports = router;