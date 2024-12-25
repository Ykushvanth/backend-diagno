const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');
const axios = require('axios');
const translate = require('translate-google');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
console.log('Upload directory:', uploadDir);

(async () => {
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log('Upload directory created/verified successfully');
    } catch (error) {
        console.error('Error creating upload directory:', error);
    }
})();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('Multer destination called');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        console.log('Multer filename called');
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        console.log('Generated filename:', uniqueName);
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    console.log('Received file:', file.originalname, 'Type:', file.mimetype);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        console.log('File type accepted');
        cb(null, true);
    } else {
        console.log('File type rejected');
        cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF) are allowed.'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max-size
    }
});

// Extract text from image using tesseract.js
async function extractTextFromImage(imagePath) {
    console.log('Starting OCR for:', imagePath);
    try {
        // Verify file exists
        await fs.access(imagePath);
        console.log('File exists and is accessible');

        const result = await Tesseract.recognize(
            imagePath,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        console.log('OCR completed successfully');
        console.log('Extracted text length:', result.data.text.length);
        return result.data.text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error(`Error in OCR: ${error.message}`);
    }
}

// Analyze text using GPT-4 API
async function analyzeTextUsingRapidAPI(text) {
    console.log('Starting GPT analysis');
    const url = 'https://cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com/v1/chat/completions';
    
    const systemPrompt = `You are a medical expert analyzing medical reports. Provide a structured analysis with exactly these sections: 1. Symptoms, 2. Diagnosis, 3. Severity Level, 4. Treatment Recommendations, and 5. Recommended Specialist.`;
    
    try {
        console.log('Sending request to GPT API...');
        const response = await axios.post(url, {
            model: 'gpt-4-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 1000
        }, {
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': '3efdacf94emshf16c671952bd548p154347jsned18c78a2091',
                'X-RapidAPI-Host': 'cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com'
            }
        });

        console.log('Received response from GPT API');
        if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid API response structure');
        }

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('GPT API Error:', error.response?.data || error.message);
        throw error;
    }
}

// Translate text using Google Translate
async function translateText(text, targetLanguage) {
    if (targetLanguage === 'english') return text;
    
    try {
        console.log(`Translating to ${targetLanguage}...`);
        const languageCode = getLanguageCode(targetLanguage);
        const translatedText = await translate(text, { to: languageCode });
        console.log('Translation completed');
        return translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error(`Translation failed: ${error.message}`);
    }
}

// Get language code for translation
function getLanguageCode(language) {
    const languageCodes = {
        'english': 'en',
        'telugu': 'te',
        'hindi': 'hi',
        'tamil': 'ta',
        'kannada': 'kn',
        'malayalam': 'ml',
        'marathi': 'mr',
        'bengali': 'bn',
        'gujarati': 'gu',
        'punjabi': 'pa'
    };
    return languageCodes[language.toLowerCase()] || 'en';
}

// Handle medical report analysis request
async function handleMedicalReportAnalysis(filePath, language = 'english') {
    console.log('Starting analysis for file:', filePath);
    try {
        // Verify file exists
        await fs.access(filePath);
        console.log('File exists and is accessible');

        // Extract text using Tesseract
        const text = await extractTextFromImage(filePath);
        console.log('Text extraction completed');

        if (!text || text.trim().length < 10) {
            throw new Error('Could not extract sufficient text from the image. Please ensure the image is clear and contains readable text.');
        }

        console.log('Extracted text:', text.substring(0, 100) + '...');

        // Analyze the extracted text using GPT-4
        const analysis = await analyzeTextUsingRapidAPI(text);
        console.log('Analysis completed');

        // Translate the analysis if needed
        const translatedAnalysis = await translateText(analysis, language);
        console.log('Translation completed (if needed)');
        
        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
            console.log('File cleanup completed');
        } catch (err) {
            console.error('Error deleting file:', err);
        }

        return {
            success: true,
            formattedOutput: translatedAnalysis,
            extractedText: text
        };

    } catch (error) {
        console.error('Analysis error:', error);
        
        // Clean up uploaded file in case of error
        try {
            await fs.unlink(filePath);
            console.log('File cleanup completed (error case)');
        } catch (err) {
            console.error('Error deleting file:', err);
        }

        throw error;
    }
}

module.exports = {
    upload,
    handleMedicalReportAnalysis
};