const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

// Setup Multer
const upload = multer({ dest: 'uploads/' });

// Setup Gemini
// Previously this constructed the client at module load time, which throws
// synchronously if GEMINI_API_KEY is missing — that crashed the entire server
// on startup (require('./routes/ai') in server.js), taking down every route,
// not just the AI ones. Constructing it lazily on first use means a missing
// key only fails the specific AI request that needed it.
let aiClient = null;
const getAiClient = () => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured — AI features are unavailable.');
    }
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};

// Helper to clean JSON
const cleanJSON = (text) => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// @route   POST /api/ai/symptom-check
// @desc    Symptom Analysis using Gemini Node SDK
router.post('/symptom-check', async (req, res) => {
    try {
        const { symptoms, age, duration, severity } = req.body;

        // Handle both string and array input for symptoms
        const symptomsStr = Array.isArray(symptoms) ? symptoms.join(', ') : symptoms;

        const prompt = `
        Act as a medical symptom checker AI.
        Patient Profile:
        - Age: ${age || 'Unknown'}
        - Symptoms: ${symptomsStr}
        - Duration: ${duration || 'Unknown'}
        - Severity: ${severity || 'Unknown'}

        Task: Analyze the symptoms and provide a structured assessment.
        
        Response Format (Strict JSON):
        {
            "disease": "Name of the most likely condition",
            "description": "Brief description of the condition",
            "confidence": 0.0-1.0,
            "severity": "Mild/Moderate/Severe/Emergency",
            "precautions": ["Precaution 1", "Precaution 2", "Precaution 3", "Precaution 4"]
        }
        `;

        const response = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: { role: 'user', parts: [{ text: prompt }] },
        });

        // The response format for @google/genai might differ slightly.
        // Usually response.text is a function or property.
        // User's provided code: res.json({ answer: response.text }); 
        // Note: New SDK return type.

        const text = response.text || "";

        const cleaned = cleanJSON(text || "");
        res.json(JSON.parse(cleaned));

    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// @route   POST /api/ai/chat
// @desc    Chatbot using Gemini Node SDK
router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const response = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: { role: 'user', parts: [{ text: message }] },
        });
        res.json({ response: response.text });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// @route   POST /api/ai/prescription (Proxies to Python for OCR)
router.post('/prescription', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        // 1. Get Text from Python OCR Service (Keep for architecture compliance & extra context)
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));

        let extractedText = "";
        try {
            const pythonResponse = await axios.post(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/ai/ocr`, formData, {
                headers: { ...formData.getHeaders() }
            });
            extractedText = pythonResponse.data.text;
        } catch (err) {
            console.warn("Python OCR Service failed (continuing with Vision only):", err.message);
        }

        // 2. Prepare Image for Gemini Vision
        const imageBuffer = fs.readFileSync(req.file.path);
        const imageBase64 = imageBuffer.toString('base64');

        // 3. Multimodal Prompt (Image + OCR Text Support)
        const prompt = `
        Analyze this prescription image and extracted OCR text to identify medicines.
        
        OCR Text Context: "${extractedText}"
        
        Task: 
        1. Identify doctor name and date.
        2. List all medicines found. IMPORTANT: Use your medical knowledge to correct spelling errors in medicine names (e.g., matching "Althose" to "Aldose" or similar real brands/generics if applicable, but prioritize what is written if clear).
        3. Provide a one-line medical description for each medicine (what it's used for).
        
        Return JSON:
        {
            "doctor": "Doctor Name (if found)",
            "date": "Date (if found)",
            "medicines_detected": [
                { 
                    "name": "Corrected Medicine Name", 
                    "dosage": "Dosage (e.g. 500mg)", 
                    "frequency": "Frequency (e.g. BID, 1-0-1)", 
                    "days": "Duration (e.g. 5 days)", 
                    "instructions": "When to take (e.g. After food)",
                    "description": "One-line description of what this medicine treats"
                }
            ]
        }
        `;

        const geminiResponse = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: req.file.mimetype, data: imageBase64 } }
                    ]
                }
            ],
        });

        const cleaned = cleanJSON(geminiResponse.text || "");

        // Cleanup file
        fs.unlinkSync(req.file.path);

        res.json(JSON.parse(cleaned));

    } catch (error) {
        console.error("Prescription Error:", error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Failed to process prescription" });
    }
});

// @route   POST /api/ai/parse_reminder
// @desc    Parse natural language reminder instruction
router.post('/parse_reminder', async (req, res) => {
    try {
        const { instruction } = req.body;
        const prompt = `
        Extract medicine reminder details from this instruction: "${instruction}"
        
        Return JSON (only):
        {
            "parsed_dosage": "e.g. 500mg",
            "parsed_time": "e.g. 08:00" (24-hour format HH:MM)
        }
        If time is not specified, default to "09:00".
        `;

        const response = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: { role: 'user', parts: [{ text: prompt }] },
        });

        const cleaned = cleanJSON(response.text || "");
        res.json(JSON.parse(cleaned));
    } catch (error) {
        console.error("Parse Reminder Error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
