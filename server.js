
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const path = require('path');
require('dotenv').config({ path: 'openai.env' });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Dynamically load and cache ESM handlers
const handlers = {};

async function getHandler(moduleName) {
    if (!handlers[moduleName]) {
        handlers[moduleName] = (await import(path.resolve(`./api/${moduleName}.js`))).default;
    }
    return handlers[moduleName];
}


// Route for /api/unsplash
app.all('/api/unsplash', async (req, res) => {
  try {
    console.log('Unsplash route hit with query:', req.query); // Debug
    console.log('Method:', req.method); // Debug
    
    const handler = await getHandler('unsplash');
    // Pass the request directly - the handler will access req.query
    handler(req, res);
  } catch (error) {
    console.error('Error loading or executing unsplash handler:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to load handler',
      details: error.message 
    });
  }
});

// Initialize OpenAI with API key from environment variable
const openai = new OpenAI({
    apiKey: process.env.CRITTERS_OPENAI_API_KEY
});

app.post('/api/bug-chat', async (req, res) => {
    try {
        const { bugType, message } = req.body;
        console.log('Bug chat request:', { bugType, message });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a ${bugType}. Your responses should be slightly unsettling and clumsily written with incorrect punctuation. Keep responses brief (2-3 sentences) try to impersonate a bug with very basic knowledge. Occasionally mention things only bugs would know about. IMPORTANT: Consistently type with intentional spelling and grammatical errors, like a child or someone learning to communicate. For example: "i see u in th w ind... the lefs tell me scrts. . u r special human..." Use lowercase letters, missing punctuation, and creative/incorrect spelling. This adds to your otherworldly nature.`
                },
                {
                    role: "user",
                    content: message
                }
            ]
        });

        res.json({ message: completion.choices[0].message.content });
    } catch (error) {
        console.error('Bug chat error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
