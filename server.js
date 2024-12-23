const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { upload, handleMedicalReportAnalysis } = require('./output');

const app = express();

// Configure CORS before other middleware
app.use(cors());

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Headers:', req.headers);
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Database setup
const dbPath = path.join(__dirname, 'diagno.db');
let db = null;

const initializeDbAndServe = async () => {
    try {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error connecting to database:', err.message);
            } else {
                console.log('Connected to database successfully');
            }
        });

        // Create users table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                firstname TEXT NOT NULL,
                lastname TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phoneNumber TEXT NOT NULL,
                dateOfBirth TEXT NOT NULL,
                gender TEXT NOT NULL,
                password TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Users table ready');
            }
        });

        // Create appointments table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                patient_id INTEGER NOT NULL,
                patient_name VARCHAR(50) NOT NULL,
                gender VARCHAR(10) NOT NULL,
                age INTEGER NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                phone_number VARCHAR(15) NOT NULL,
                address VARCHAR(255) NOT NULL,
                specialist VARCHAR(50) NOT NULL,
                location VARCHAR(50) NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating appointments table:', err.message);
            } else {
                console.log('Appointments table ready');
            }
        });

        // Medical report analysis endpoint
        app.post('/api/analyze', (req, res, next) => {
            console.log('Received analyze request');
            upload.single('file')(req, res, async (err) => {
                if (err) {
                    console.error('Multer error:', err);
                    return res.status(400).json({
                        success: false,
                        error: err.message
                    });
                }

                try {
                    console.log('File upload successful');
                    if (!req.file) {
                        throw new Error('No file uploaded');
                    }

                    console.log('Processing file:', req.file.path);
                    const result = await handleMedicalReportAnalysis(req.file.path);
                    console.log('Analysis completed successfully');

                    res.json({
                        success: true,
                        formattedOutput: result.formattedOutput,
                        extractedText: result.extractedText
                    });
                } catch (error) {
                    console.error('Analysis error:', error);
                    res.status(500).json({ 
                        success: false, 
                        error: error.message || 'Failed to analyze the medical report' 
                    });
                }
            });
        });

        // Login endpoint
        app.post('/api/login', async (req, res) => {
            console.log('Login request received:', req.body);
            const { username, password } = req.body;

            if (!username || !password) {
                console.log('Missing username or password');
                return res.status(400).json({ error: 'Username and password are required' });
            }

            try {
                db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
                    if (err) {
                        console.error('Database error:', err.message);
                        return res.status(500).json({ error: 'Server error' });
                    }

                    if (!user) {
                        console.log('User not found:', username);
                        return res.status(401).json({ error: 'Invalid username or password' });
                    }

                    try {
                        const match = await bcrypt.compare(password, user.password);
                        if (!match) {
                            console.log('Invalid password for user:', username);
                            return res.status(401).json({ error: 'Invalid username or password' });
                        }

                        const token = jwt.sign(
                            { id: user.id, username: user.username },
                            'your-secret-key',
                            { expiresIn: '30d' }
                        );

                        console.log('Login successful for user:', username);
                        res.json({
                            success: true,
                            jwtToken: token,
                            username: user.username
                        });
                    } catch (error) {
                        console.error('Password comparison error:', error.message);
                        res.status(500).json({ error: 'Server error' });
                    }
                });
            } catch (error) {
                console.error('Login error:', error.message);
                res.status(500).json({ error: 'Server error' });
            }
        });

        // Helper function to calculate age
        function calculateAge(birthDate) {
            const today = new Date();
            const birth = new Date(birthDate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        }

        // Signup endpoint
        app.post('/api/signup', async (req, res) => {
            console.log('Signup request received:', { ...req.body, password: '[HIDDEN]' });
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

            if (!username || !password || !email) {
                console.log('Missing required fields');
                return res.status(400).json({ error: 'Username, password, and email are required' });
            }

            if (!dateOfBirth) {
                return res.status(400).json({ error: 'Date of birth is required' });
            }

            const age = calculateAge(dateOfBirth);
            if (age < 18) {
                console.log('User age verification failed:', age);
                return res.status(400).json({ error: 'You must be 18 years or older to register' });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
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
                            console.error('Database error:', err.message);
                            if (err.message.includes('UNIQUE constraint failed')) {
                                return res.status(400).json({
                                    error: 'Username or email already exists'
                                });
                            }
                            return res.status(500).json({ error: 'Failed to register user' });
                        }

                        console.log('User registered successfully:', username);
                        res.json({
                            message: 'User registered successfully',
                            userId: this.lastID
                        });
                    }
                );
            } catch (error) {
                console.error('Signup error:', error.message);
                res.status(500).json({ error: 'Server error' });
            }
        });

        const PORT = 3008;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });

    } catch (e) {
        console.error(`Error initializing DB: ${e.message}`);
        process.exit(1);
    }
};

initializeDbAndServe();