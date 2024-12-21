const express = require('express')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')

const app = express()

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json())

// Database setup
const db = new sqlite3.Database('diagno.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message)
    } else {
        console.log('Connected to database successfully')
    }
})

// Create users table
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT UNIQUE,
    firstname TEXT,
    lastname TEXT,
    phone_number TEXT,
    date_of_birth TEXT,
    gender TEXT
)`, (err) => {
    if (err) {
        console.error('Error creating users table:', err.message)
    } else {
        console.log('Users table ready')
    }
})

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
})

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
    console.log('Signup request received:', { ...req.body, password: '[HIDDEN]' })
    const {
        username,
        password,
        email,
        firstname,
        lastname,
        phoneNumber,
        dateOfBirth,
        gender
    } = req.body

    if (!username || !password || !email) {
        console.log('Missing required fields')
        return res.status(400).json({ error: 'Username, password, and email are required' })
    }

    // Validate age
    if (!dateOfBirth) {
        return res.status(400).json({ error: 'Date of birth is required' })
    }

    const age = calculateAge(dateOfBirth)
    if (age < 18) {
        console.log('User age verification failed:', age)
        return res.status(400).json({ error: 'You must be 18 years or older to register' })
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10)
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
                    console.error('Database error:', err.message)
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({
                            error: 'Username or email already exists'
                        })
                    }
                    return res.status(500).json({ error: 'Failed to register user' })
                }

                console.log('User registered successfully:', username)
                res.json({
                    message: 'User registered successfully',
                    userId: this.lastID
                })
            }
        )
    } catch (error) {
        console.error('Signup error:', error.message)
        res.status(500).json({ error: 'Server error' })
    }
})

// Import medical report analysis
const { upload, handleMedicalReportAnalysis } = require('./output');

// Add medical report analysis endpoint
app.post('/analyze-report', upload.single('file'), handleMedicalReportAnalysis);

// Start server
const PORT = 3000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log('Press Ctrl+C to stop the server')
})