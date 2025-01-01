const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const {open} = require("sqlite")
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { upload, handleMedicalReportAnalysis,analyzeXrayUsingRapidAPI } = require('./output');

const app = express();

// Configure CORS before other middleware
// app.use(cors());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3004'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

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
   try{
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    const PORT = 3009;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });

   } catch (e) {
        console.error(`Error initializing DB: ${e.message}`);
        process.exit(1);
    }
};


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
                const language = req.body.language || 'english';
                console.log('Target language:', language);
                
                const result = await handleMedicalReportAnalysis(req.file.path, language);
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

    // Example backend code (e.g., Express.js)



  //  Login endpoint old
    // app.post('/api/login', async (req, res) => {
    //     console.log('Login request received:', req.body);
    //     const { username, password } = req.body;

    //     if (!username || !password) {
    //         console.log('Missing username or password');
    //         return res.status(400).json({ error: 'Username and password are required' });
    //     }

    //     try {
    //         db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    //             if (err) {
    //                 console.error('Database error:', err.message);
    //                 return res.status(500).json({ error: 'Server error' });
    //             }

    //             if (!user) {
    //                 console.log('User not found:', username);
    //                 return res.status(401).json({ error: 'Invalid username or password' });
    //             }

    //             try {
    //                 const match = await bcrypt.compare(password, user.password);
    //                 if (!match) {
    //                     console.log('Invalid password for user:', username);
    //                     return res.status(401).json({ error: 'Invalid username or password' });
    //                 }

    //                 const token = jwt.sign(
    //                     { id: user.id, username: user.username },
    //                     'your-secret-key',
    //                     { expiresIn: '30d' }
    //                 );

    //                 console.log('Login successful for user:', username);
    //                 res.json({
    //                     success: true,
    //                     jwtToken: token,
    //                     username: user.username
    //                 });
    //             } catch (error) {
    //                 console.error('Password comparison error:', error.message);
    //                 res.status(500).json({ error: 'Server error' });
    //             }
    //         });
    //     } catch (error) {
    //         console.error('Login error:', error.message);
    //         res.status(500).json({ error: 'Server error' });
    //     }
    // });

    app.post('/api/login', async (request, response) => {
        try {
            const { username, password } = request.body;
    
            if (!username || !password) {
                return response.status(400).json({ error: 'Username and password are required' });
            }
    
            const selectUserQuery = `
                SELECT id, username, email, password, firstname, lastname, phoneNumber, gender
                FROM users
                WHERE username = ?
            `;
    
            const dbUser = await db.get(selectUserQuery , [username])
    
            console.log('Retrieved user:', dbUser); // Debug log
    
            if (!dbUser || !dbUser.password) {
                return response.status(400).json({ error: 'User not found or invalid credentials' });
            }
    
            const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
            
            if (isPasswordMatched) {
                const userData = {
                    id: dbUser.id,
                    username: dbUser.username,
                    email: dbUser.email,
                    firstname: dbUser.firstname,
                    lastname: dbUser.lastname,
                    gender: dbUser.gender,
                    phoneNumber: dbUser.phoneNumber,
                };
    
                const jwtToken = jwt.sign({ username }, 'MY_SECRET_TOKEN');
                console.log('Login successful for user:', userData);
    
                response.json({
                    jwt_token: jwtToken,
                    user: userData,
                });
            } else {
                response.status(400).json({ error: 'Invalid password' });
            }
        } catch (error) {
            console.error('Login error:', error.message);
            response.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
    
    // Add doctor login endpoint
app.post('/doctor-login', async (request, response) => {
    try {
        const { username, password } = request.body;
        
        const selectDoctorQuery = `
            SELECT id, username, password, name, specialization, location, experience, qualification, image_url,	phone_number,rating,appointment_cost
            FROM doctors 
            WHERE username = ? AND password = ?
        `;
        
        const doctor = await db.get(selectDoctorQuery, [username, password]);
        console.log('Found doctor:', { ...doctor, password: '[HIDDEN]' });
        
        if (!doctor) {
            return response.status(400).json({ error: 'Invalid username or password' });
        }

        // Create doctor object without password
        const doctorData = {
            id: doctor.id,
            username: doctor.username,
            name: doctor.name,
            specialization: doctor.specialization,
            location: doctor.location,
            experience: doctor.experience,
            qualification: doctor.qualification,
            profile_image: doctor.image_url,
            appointment_cost:doctor.appointment_cost,
            rating:doctor.rating,
            phone_number:doctor.phone_number
        };

        const jwtToken = jwt.sign({ username: username, role: 'doctor' }, 'MY_SECRET_TOKEN');
        
        response.json({ 
            jwt_token: jwtToken,
            doctor: doctorData
        });
        
    } catch (error) {
        console.error('Doctor login error:', error);
        response.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

app.get('/api/doctor-appointments/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        console.log('Fetching appointments for doctor:', doctorId);

        const query = `
            SELECT 
                id,
                user_id,
                patient_name,
                date,
                time,
                status,
                symptoms,
                prescription,
                diagnosis,
                notes
            FROM appointments 
            WHERE doctor_id = ?
            ORDER BY 
                CASE 
                    WHEN status = 'Upcoming' THEN 1
                    WHEN status = 'Completed' THEN 2
                    ELSE 3
                END,
                date DESC,
                time DESC
        `;

        const appointments = await db.all(query, [doctorId]);
        console.log(`Found ${appointments.length} appointments for doctor ${doctorId}`);

        res.json(appointments);

    } catch (error) {
        console.error('Error fetching doctor appointments:', error);
        res.status(500).json({ 
            error: 'Failed to fetch appointments',
            details: error.message 
        });
    }
});

// Add patient history endpoint
app.get('/api/patient-history/:patientId/:doctorId', async (req, res) => {
    try {
        const { patientId, doctorId } = req.params;
        console.log('Fetching patient history:', { patientId, doctorId });

        const query = `
            SELECT 
                a.id,
                a.date,
                a.time,
                a.status,
                a.symptoms,
                a.prescription,
                a.diagnosis,
                a.notes
            FROM appointments a
            WHERE a.user_id = ? 
            AND a.doctor_id = ?
            ORDER BY a.date DESC, a.time DESC
        `;

        const history = await db.all(query, [patientId, doctorId]);
        console.log(`Found ${history.length} historical records`);

        res.json(history);

    } catch (error) {
        console.error('Error fetching patient history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch patient history',
            details: error.message 
        });
    }
});


    // Helper function to calculate age
    // app.post('/api/login', async (request, response) => {
    //     try {
    //         const { username, password } = request.body;
            
    //         // Make sure to select all necessary fields
    //         const selectUserQuery = `
    //             SELECT id, username, email, password, firstname, lastname ,phoneNumber , gender
    //             FROM users 
    //             WHERE username = ?
    //         `;
            
    //         const dbUser = await db.get(selectUserQuery, [username]);
    //         console.log('Found user:', dbUser); // Debug log
            
    //         if (!dbUser) {
    //             return response.status(400).json({ error: 'User not found' });
    //         }
    
    //         const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
            
    //         if (isPasswordMatched) {
    //             // Create user object without sensitive data
    //             const userData = {
    //                 id: dbUser.id,
    //                 username: dbUser.username,
    //                 email: dbUser.email,
    //                 firstname: dbUser.firstname,
    //                 lastname: dbUser.lastname,
    //                 gender :dbUser.gender,
    //                 phonenumber : dbUser.phoneNumber
    
    //             };
    
    //             const jwtToken = jwt.sign({ username: username }, 'MY_SECRET_TOKEN');
                
             
    //             console.log('Sending response:', { 
    //                 jwt_token: jwtToken, 
    //                 user: userData 
    //             }); // Debug log
    
    //             response.json({ 
    //                 jwt_token: jwtToken,
    //                 user: userData
    //             });
    //         } else {
    //             response.status(400).json({ error: 'Invalid password' });
    //         }
            
    //     } catch (error) {
    //         console.error('Login error:', error);
    //         response.status(500).json({ 
    //             error: 'Internal server error', 
    //             details: error.message 
    //         });
    //     }
    // });        
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
                `INSERT INTO users (username, firstname,  lastname, email,  phoneNumber, dateOfBirth, gender, password) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, firstname, lastname,email,  phoneNumber, dateOfBirth, gender , hashedPassword],
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


    // Get user profile endpoint
    app.get('/api/user/:userId', async (request, response) => {
        try {
            const { userId } = request.params;
            console.log('Fetching user with ID:', userId);
    
            const query = `SELECT id, username, firstname, lastname, email, phoneNumber, dateOfBirth, gender
                           FROM users 
                           WHERE id = ?`;
    
            const user = await db.get(query, [userId]);
            console.log(user)
    
            if (!user) {
                console.warn(`User with ID ${userId} not found`);
                return response.status(404).json({ error: 'User not found' });
            }
    
            response.json(user);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            response.status(500).json({ error: 'Internal server error' });
        }
    });
    


app.get('/api/doctor-locations', async (req, res) => {

// try {
//     const locations = await db.all(`
//         SELECT  location 
//         FROM doctors 
//         ORDER BY location
//     `);
//     console.log(locations)
//     res.json(locations);
// } catch (error) {
//     console.error('Error fetching locations:', error);
//     res.status(500).json({ error: 'Failed to fetch locations' });
// }
const que = `
SELECT DISTINCT location  FROM doctors ORDER BY location
`
const resl = await db.all(que);
res.json(resl)
});

app.get("/api/doctor-locations/getDoctors", async (req, res) => {
try {
    const { location, specialization } = req.query;
    console.log('Fetching doctors with:', { location, specialization });

    const query = `
        SELECT * FROM doctors 
        WHERE location = ? 
        AND specialization = ?
    `;
    
    const doctors = await db.all(query, [location, specialization]);
    console.log('Found doctors:', doctors);

    if (!doctors || doctors.length === 0) {
        return res.json([]);
    }

    res.json(doctors);
} catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
        error: 'Failed to fetch doctors',
        message: error.message 
    });
}
});

app.get('/api/appointments/check-availability', async (req, res) => {
try {
    const { doctor_id, date, time } = req.query;
    
    console.log('Checking availability for:', { doctor_id, date, time }); // Debug log

    const query = `
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE doctor_id = ? 
        AND date = ? 
        AND time = ?
    `;

    const result = await db.get(query, [doctor_id, date, time]);
    
    console.log('Query result:', result); // Debug log

    // If count is 0, the slot is available
    const available = result.count === 0;

    res.json({ 
        available,
        message: available ? 'Time slot is available' : 'Time slot is already booked'
    });

} catch (error) {
    console.error('Error checking appointment availability:', error);
    res.status(500).json({ 
        message: 'Error checking appointment availability',
        error: error.message 
    });
}
});

// const checkAvailability = async (db, doctorId, date, time) => {
//     const query = `
//         SELECT COUNT(*) as count 
//         FROM appointments 
//         WHERE doctor_id = ? 
//         AND date = ? 
//         AND time = ?
//     `;
    
//     const result = await db.get(query, [doctorId, date, time]);
//     return result.count === 0; // Returns true if slot is available
// };

app.post('/api/appointments', async (req, res) => {
    try {
        const {
            doctor_id,
            user_id,
            patient_name,
            gender,
            age,
            date,
            time,
            phone_number,
            address,
            specialist,
            location
        } = req.body;

        // Debug log for received data
        console.log('Received appointment data:', req.body);

        // Validate required fields
        if (!doctor_id || !user_id || !patient_name || !date || !time) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'doctor_id, user_id, patient_name, date, and time are required'
            });
        }

        // Validate age if provided
        if (age && isNaN(age)) {
            return res.status(400).json({
                error: 'Invalid age',
                details: 'Age must be a number'
            });
        }

        // Check slot availability
        console.log('Checking availability for:', { doctor_id, date, time });
        const isAvailable = await checkAvailability(db, doctor_id, date, time);
        if (!isAvailable) {
            return res.status(409).json({
                error: 'Time slot already booked',
                message: 'Please select a different time or date'
            });
        }

        // Insert the appointment
        const query = `
            INSERT INTO appointments (
                doctor_id,
                user_id,
                patient_name,
                gender,
                age,
                date,
                time,
                phone_number,
                address,
                specialist,
                location,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await db.run(query, [
            doctor_id,
            user_id,
            patient_name,
            gender,
            age,
            date,
            time,
            phone_number,
            address,
            specialist,
            location,
            'Upcoming'
        ]);

        console.log('Appointment created:', result);

        res.status(201).json({
            message: 'Appointment booked successfully',
            appointmentId: result.lastID
        });

    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({
            error: 'Failed to book appointment',
            details: error.message
        });
    }
});

// Utility function to check slot availability
async function checkAvailability(db, doctor_id, date, time) {
    const query = `
        SELECT 1 
        FROM appointments 
        WHERE doctor_id = ? AND date = ? AND time = ?
    `;
    const row = await db.get(query, [doctor_id, date, time]);
    return !row; // Slot is available if no row is returned
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    jwt.verify(token, 'MY_SECRET_TOKEN', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Add this new endpoint for booking history
app.get('/booking-history', authenticateToken, async (req, res) => {
    try {
        // Get username from the verified token
        const username = req.user.username;
        
        // First get the user's ID
        const userQuery = 'SELECT id FROM users WHERE username = ?';
        const user = await db.get(userQuery, [username]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Then get their appointments
        const query = `
            SELECT 
                a.*,
                d.name as doctor_name,
                CASE
                    WHEN a.date > date('now') THEN 'Upcoming'
                    ELSE 'Completed'
                END as status
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            WHERE a.user_id = ?
            ORDER BY a.date DESC, a.time DESC
        `;
        
        const appointments = await db.all(query, [user.id]);
        res.json(appointments);
        
    } catch (error) {
        console.error('Error fetching booking history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch booking history',
            details: error.message 
        });
    }
});

// app.post('/api/appointments', async (req, res) => {
// try {
//     const {
//         doctor_id,
//         user_id,
//         patient_name,
//         gender,
//         age,
//         date,
//         time,
//         phone_number,
//         address,
//         specialist,
//         location
//     } = req.body;

//     console.log('Checking availability for:', { doctor_id, date, time });

//     // Check if the slot is available
//     const isAvailable = await checkAvailability(db, doctor_id, date, time);
    
//     if (!isAvailable) {
//         return res.status(409).json({
//             error: 'Time slot already booked',
//             message: 'Please select a different time or date'
//         });
//     }

//     console.log('Received appointment data:', req.body);

//     // Validate required fields
//     console.log("mm")
//     console.log(doctor_id)
//     console.log(user_id)
//     console.log(patient_name)
//     console.log(date)
//     console.log(time)
//     console.log("sss")
//     if (!doctor_id || !user_id || !patient_name || !date || !time) {
//         return res.status(400).json({
//             error: 'Missing required fields',
//             details: 'doctor_id, user_id, patient_name, date, and time are required'
//         });
//     }

//     // Insert the appointment
//     const query = `
//         INSERT INTO appointments (
//             doctor_id,
//             user_id,
//             patient_name,
//             gender,
//             age,
//             date,
//             time,
//             phone_number,
//             address,
//             specialist,
//             location,
//             status
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;

//     const result = await db.run(query, [
//         doctor_id,
//         user_id,
//         patient_name,
//         gender,
//         age,
//         date,
//         time,
//         phone_number,
//         address,
//         specialist,
//         location,
//         'Upcoming'
//     ]);

//     console.log('Appointment created:', result);

//     res.status(201).json({
//         message: 'Appointment booked successfully',
//         appointmentId: result.lastID
//     });

// } catch (error) {
//     console.error('Error booking appointment:', error);
//     res.status(500).json({
//         error: 'Failed to book appointment',
//         details: error.message
//     });
// }
// });


// app.post('/api/signup', async (req, res) => {
//     console.log('Signup request received:', { ...req.body, password: '[HIDDEN]' });
//     const { username, password, email, firstname, lastname, phoneNumber, dateOfBirth, gender } = req.body;

//     if (!username || !password || !email) {
//         console.log('Missing required fields');
//         return res.status(400).json({ error: 'Username, password, and email are required' });
//     }

//     if (!dateOfBirth) {
//         return res.status(400).json({ error: 'Date of birth is required' });
//     }

//     const age = calculateAge(dateOfBirth);
//     if (age < 18) {
//         console.log('User age verification failed:', age);
//         return res.status(400).json({ error: 'You must be 18 years or older to register' });
//     }

//     try {
//         const hashedPassword = await bcrypt.hash(password, 10);
//         const sql = `
//             INSERT INTO users 
//             (username, firstname, lastname, email, phoneNumber, dateOfBirth, gender, password) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//         db.run(sql, [username, firstname, lastname, email, phoneNumber, dateOfBirth, gender, hashedPassword], function (err) {
//             if (err) {
//                 console.error('Database error:', err.message);
//                 if (err.message.includes('UNIQUE constraint failed')) {
//                     return res.status(400).json({
//                         error: 'Username or email already exists'
//                     });
//                 }
//                 return res.status(500).json({ error: 'Failed to register user' });
//             }

//             console.log('User registered successfully:', username);
//             res.json({
//                 message: 'User registered successfully',
//                 userId: this.lastID
//             });
//         });
//     } catch (error) {
//         console.error('Signup error:', error.message);
//         res.status(500).json({ error: 'Server error' });
//     }
// });


// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received:', {
        file: req?.file?.originalname,
        language: req.body?.language,
        fileType: req.body?.fileType
    });

    try {
        if (!req.file) {
            console.log('No file received');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputFile = req.file.path;
        const targetLanguage = (req.body.language || 'english').toLowerCase();
        const fileType = req.body.fileType || 'text';

        console.log('Processing file:', {
            path: inputFile,
            language: targetLanguage,
            type: fileType
        });

        let imagePath = inputFile;
        let analysisResult;

        try {
            if (fileType === 'xray') {
                console.log('Starting X-ray analysis...');
                analysisResult = await analyzeXrayUsingRapidAPI(imagePath);
                console.log('X-ray analysis completed');
            } else {
                const extractedText = await extractTextFromImage(imagePath);
                if (!extractedText) {
                    throw new Error('No text could be extracted from the image');
                }
                analysisResult = await analyzeTextUsingRapidAPI(extractedText);
            }

            if (!analysisResult) {
                throw new Error('Analysis failed to produce results');
            }

            let finalOutput = analysisResult;
            if (targetLanguage !== 'english') {
                console.log(`Translating to ${targetLanguage}...`);
                finalOutput = await translateText(analysisResult, targetLanguage);
            }

            // Cleanup files
            try {
                fs.unlinkSync(inputFile);
                if (imagePath !== inputFile) {
                    fs.unlinkSync(imagePath);
                }
            } catch (cleanupError) {
                console.error('File cleanup error:', cleanupError);
            }

            console.log('Processing completed successfully');
            res.status(200).json({
                formattedOutput: finalOutput,
                targetLanguage,
                translationPerformed: targetLanguage !== 'english',
                fileType
            });

        } catch (processingError) {
            console.error('Processing error:', processingError);
            res.status(400).json({
                error: 'Processing failed',
                details: processingError.message
            });
        }

    } catch (error) {
        console.error('Upload route error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
});



initializeDbAndServe();