// backend/server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'diagno.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to database successfully');
    }
});

// Ensure the users table has the correct schema
db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    firstname TEXT,
    lastname TEXT,
    phone_number TEXT,
    date_of_birth TEXT,
    gender TEXT
)`);

// Assuming you have a function to add a user
function addUser(userData) {
    const { email } = userData;

    // Check if the email already exists
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error(err);
            return;
        }
        if (row) {
            console.log("Email already exists. Please use a different email.");
            // Handle the case where the email exists (e.g., return an error response)
        } else {
            // Proceed to insert the new user
            db.run("INSERT INTO users (username, firstname, lastname, email, phone_number, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                [userData.username, userData.firstname, userData.lastname, email, userData.phone_number, userData.date_of_birth, userData.gender], 
                function(err) {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log("User added successfully.");
                    }
                });
        }
    });
}

// User registration endpoint
app.post('/api/signup', async (req, res) => {
    const {
        username,
        password,
        email,
        firstname,
        lastname,
        phoneNumber,
        dateOfBirth,
        gender
    } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        // Insert the user into the database
        db.run(
            `INSERT INTO users (
                username, 
                password, 
                email, 
                firstname, 
                lastname, 
                phone_number, 
                date_of_birth, 
                gender
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, email, firstname, lastname, phoneNumber, dateOfBirth, gender],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ 
                            error: 'Username, email, or phone number already exists' 
                        });
                    }
                    return res.status(500).json({ error: 'Failed to register user' });
                }

                    res.json({ 
                        message: 'User registered successfully',
                        userId: this.lastID
                    });
                }
            );
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        return res.status(500).json({ error: 'Failed to hash password' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        res.json({ message: 'Login successful', userId: user.id });
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});