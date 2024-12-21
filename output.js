const express = require('express');
const multer = require('multer');
const cors = require('cors');
const tesseract = require('node-tesseract-ocr');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    console.log('Received file:', file.originalname, 'Type:', file.mimetype);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter
});

// Configure tesseract
const config = {
    lang: "eng",
    oem: 1,
    psm: 3,
};

// Extract text from image
async function extractTextFromImage(imagePath) {
    console.log('Extracting text from:', imagePath);
    try {
        const text = await tesseract.recognize(imagePath, config);
        console.log('Extracted text length:', text.length);
        return text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error(`Error in OCR: ${error.message}`);
    }
}

// Analyze medical report text
async function analyzeMedicalReport(text) {
    console.log('Analyzing text...');
    const analysis = {
        tests: [],
        abnormalValues: [],
        diagnosis: [],
        recommendations: [],
        medications: [],
        vitals: {}
    };

    // Common medical test patterns
    const testPatterns = [
        { name: 'Blood Pressure', pattern: /blood pressure:?\s*(\d{2,3}\/\d{2,3})/gi },
        { name: 'Glucose', pattern: /(?:glucose|blood sugar):?\s*(\d+\.?\d*)/gi },
        { name: 'Cholesterol', pattern: /(?:cholesterol|lipid):?\s*(\d+\.?\d*)/gi },
        { name: 'Hemoglobin', pattern: /(?:hemoglobin|hb):?\s*(\d+\.?\d*)/gi },
        { name: 'WBC', pattern: /(?:wbc|white blood cells?):?\s*(\d+\.?\d*)/gi },
        { name: 'RBC', pattern: /(?:rbc|red blood cells?):?\s*(\d+\.?\d*)/gi },
        { name: 'Platelets', pattern: /platelets?:?\s*(\d+\.?\d*)/gi }
    ];

    // Extract tests and values
    testPatterns.forEach(({ name, pattern }) => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            analysis.tests.push({
                name,
                value: match[1],
                raw: match[0]
            });
        }
    });

    // Extract vital signs
    const vitalPatterns = {
        temperature: /(?:temperature|temp):?\s*(\d+\.?\d*)/gi,
        pulse: /(?:pulse|heart rate):?\s*(\d+)/gi,
        respiratory: /(?:respiratory rate|breathing rate):?\s*(\d+)/gi,
        oxygen: /(?:oxygen saturation|spo2):?\s*(\d+)/gi
    };

    for (const [key, pattern] of Object.entries(vitalPatterns)) {
        const match = pattern.exec(text);
        if (match) {
            analysis.vitals[key] = match[1];
        }
    }

    // Look for abnormal indicators
    const abnormalIndicators = [
        'high', 'low', 'abnormal', 'elevated', 'deficient',
        'positive', 'negative', 'irregular', 'concerning'
    ];
    abnormalIndicators.forEach(indicator => {
        const regex = new RegExp(`\\b${indicator}\\b[^.]*`, 'gi');
        const matches = text.match(regex);
        if (matches) {
            analysis.abnormalValues.push(...matches);
        }
    });

    // Extract diagnosis
    const diagnosisPatterns = [
        /diagnosis:?[^.]*\./gi,
        /impression:?[^.]*\./gi,
        /assessment:?[^.]*\./gi
    ];

    diagnosisPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            analysis.diagnosis.push(...matches);
        }
    });

    // Extract medications
    const medicationPattern = /(?:prescribed|taking|medication):?\s*([^.]*\.)/gi;
    const medicationMatches = text.match(medicationPattern);
    if (medicationMatches) {
        analysis.medications = medicationMatches.map(med => med.trim());
    }

    // Extract recommendations
    const recommendationPatterns = [
        /recommend(?:ed|ation)?:?[^.]*\./gi,
        /advised?:?[^.]*\./gi,
        /follow(?:-|\s)?up:?[^.]*\./gi
    ];

    recommendationPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            analysis.recommendations.push(...matches);
        }
    });

    console.log('Analysis complete');
    return analysis;
}

// Format analysis output
function formatAnalysis(analysis) {
    console.log('Formatting analysis...');
    let output = "Medical Report Analysis\n\n";

    // Format vital signs
    if (Object.keys(analysis.vitals).length > 0) {
        output += "Vital Signs:\n";
        for (const [key, value] of Object.entries(analysis.vitals)) {
            output += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
        }
        output += "\n";
    }

    // Format tests
    if (analysis.tests.length > 0) {
        output += "Test Results:\n";
        analysis.tests.forEach(test => {
            output += `- ${test.name}: ${test.value}\n`;
        });
        output += "\n";
    }

    // Format abnormal values
    if (analysis.abnormalValues.length > 0) {
        output += "Abnormal Findings:\n";
        analysis.abnormalValues.forEach(value => {
            output += `- ${value.trim()}\n`;
        });
        output += "\n";
    }

    // Format diagnosis
    if (analysis.diagnosis.length > 0) {
        output += "Diagnosis:\n";
        analysis.diagnosis.forEach(diagnosis => {
            output += `- ${diagnosis.trim()}\n`;
        });
        output += "\n";
    }

    // Format medications
    if (analysis.medications.length > 0) {
        output += "Medications:\n";
        analysis.medications.forEach(medication => {
            output += `- ${medication.trim()}\n`;
        });
        output += "\n";
    }

    // Format recommendations
    if (analysis.recommendations.length > 0) {
        output += "Recommendations:\n";
        analysis.recommendations.forEach(recommendation => {
            output += `- ${recommendation.trim()}\n`;
        });
    }

    return output;
}

// Handle medical report analysis request
async function handleMedicalReportAnalysis(req, res) {
    console.log('Received analyze-report request');
    try {
        if (!req.file) {
            console.error('No file uploaded');
            throw new Error('No file uploaded');
        }

        console.log('File received:', req.file.originalname);
        const text = await extractTextFromImage(req.file.path);
        const analysis = await analyzeMedicalReport(text);
        const formattedOutput = formatAnalysis(analysis);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        console.log('Analysis complete, sending response');
        res.json({ 
            success: true, 
            formattedOutput,
            rawAnalysis: analysis 
        });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Error analyzing report' 
        });
    }
}

module.exports = {
    upload,
    handleMedicalReportAnalysis
};