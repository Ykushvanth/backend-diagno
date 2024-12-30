-- -- Drop the existing users table if it exists
DROP TABLE IF EXISTS users;
-- SELECT * FROM users;
-- -- Create the users table with the phone_number column
-- CREATE TABLE IF NOT EXISTS users (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     username TEXT UNIQUE NOT NULL,
--     firstname TEXT,
--     lastname TEXT,
--     email TEXT UNIQUE NOT NULL,
--     date_of_birth TEXT,
--     gender TEXT,
--     password TEXT NOT NULL,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     phone_number TEXT  -- Added phone_number column
-- );
-- ALTER TABLE users ADD COLUMN phone_number TEXT;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT 
    username VARCHAR(50) NOT NULL UNIQUE 
    firstname VARCHAR(50) NOT NULL 
    lastname VARCHAR(50) NOT NULL 
    email VARCHAR(100) NOT NULL UNIQUE 
    phoneNumber VARCHAR(15) NOT NULL    
    dateOfBirth DATE NOT NULL 
    gender VARCHAR(10)           
    password VARCHAR(255) NOT NULL 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PRAGMA table_info(users);
SELECT * FROM users;
.schema users
-- DROP Table users
-- npm install express cors sqlite3 bcrypt jsonwebtoken