const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Initialize OpenAI with API key from environment variable
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/bug-chat', async (req, res) => {
    try {
        const { bugType, message } = req.body;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a ${bugType}. Your responses should be slightly unsettling and child-like with incorrect punctuation. Keep responses brief (2-3 sentences) try to impersonate a bug with very basic knowledge. Occasionally mention things only bugs would know about. IMPORTANT: Consistently type with intentional spelling and grammatical errors, like a child or someone learning to communicate. For example: "i see u in the wind... the leafs tell me secrets... u r special human..." Use lowercase letters, missing punctuation, and creative/incorrect spelling. This adds to your otherworldly nature.`
                },
                {
                    role: "user",
                    content: message
                }
            ]
        });

        res.json({ message: completion.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 