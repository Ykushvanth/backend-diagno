-- Drop the existing users table if it exists
DROP TABLE IF EXISTS users;

-- Create the users table with the phone_number column
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    firstname TEXT,
    lastname TEXT,
    email TEXT UNIQUE NOT NULL,
    date_of_birth TEXT,
    gender TEXT,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    phone_number TEXT  -- Added phone_number column
);
ALTER TABLE users ADD COLUMN phone_number TEXT;

PRAGMA table_info(users);
SELECT * FROM users;
DROP Table users
npm install express cors sqlite3 bcrypt jsonwebtoken