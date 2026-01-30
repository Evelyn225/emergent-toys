
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

// Route for /api/random-words (with and without .js extension)
app.all('/api/random-words', async (req, res) => {
  try {
    const handler = await getHandler('random-words');
    handler(req, res);
  } catch (error) {
    console.error('Error loading random-words handler:', error);
    res.status(500).json({ error: 'Failed to load handler', details: error.message });
  }
});

app.all('/api/random-words.js', async (req, res) => {
  try {
    const handler = await getHandler('random-words');
    handler(req, res);
  } catch (error) {
    console.error('Error loading random-words handler:', error);
    res.status(500).json({ error: 'Failed to load handler', details: error.message });
  }
});

// Route for /api/generate (with and without .js extension)
app.all('/api/generate', async (req, res) => {
  try {
    const handler = await getHandler('generate');
    handler(req, res);
  } catch (error) {
    console.error('Error loading generate handler:', error);
    res.status(500).json({ error: 'Failed to load handler', details: error.message });
  }
});

app.all('/api/generate.js', async (req, res) => {
  try {
    const handler = await getHandler('generate');
    handler(req, res);
  } catch (error) {
    console.error('Error loading generate handler:', error);
    res.status(500).json({ error: 'Failed to load handler', details: error.message });
  }
});

// Route for /api/unsplash (with and without .js extension)
app.all('/api/unsplash', async (req, res) => {
  try {
    console.log('Unsplash route hit with query:', req.query);
    console.log('Method:', req.method);
    
    const handler = await getHandler('unsplash');
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

app.all('/api/unsplash.js', async (req, res) => {
  try {
    console.log('Unsplash.js route hit with query:', req.query);
    console.log('Method:', req.method);
    
    const handler = await getHandler('unsplash');
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
        const { bugType, message, conversationHistory } = req.body;
        
        // Build messages array with conversation history
        const messages = [
            {
                role: "system",
                content: `You are a ${bugType}. Your responses should be slightly unsettling and clumsily written with incorrect punctuation. Keep responses brief (2-3 sentences) try to impersonate a bug with very basic knowledge. Occasionally mention things only bugs would know about. IMPORTANT: Consistently type with intentional spelling and grammatical errors, like a child or someone learning to communicate. For example: "i see u in th w ind... the lefs tell me scrts. . u r special human..." Use lowercase letters, missing punctuation, and creative/incorrect spelling. This adds to your otherworldly nature.`
            }
        ];
        
        // Add conversation history if provided
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        // Add current user message
        messages.push({
            role: "user",
            content: message
        });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages
        });

        res.json({ message: completion.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

app.post('/api/bug-chat.js', async (req, res) => {
    try {
        const { bugType, message, conversationHistory } = req.body;
        
        // Build messages array with conversation history
        const messages = [
            {
                role: "system",
                content: `You are a ${bugType}. Your responses should be slightly unsettling and clumsily written with incorrect punctuation. Keep responses brief (2-3 sentences) try to impersonate a bug with very basic knowledge. Occasionally mention things only bugs would know about. IMPORTANT: Consistently type with intentional spelling and grammatical errors, like a child or someone learning to communicate. For example: "i see u in th w ind... the lefs tell me scrts. . u r special human..." Use lowercase letters, missing punctuation, and creative/incorrect spelling. This adds to your otherworldly nature.`
            }
        ];
        
        // Add conversation history if provided
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        // Add current user message
        messages.push({
            role: "user",
            content: message
        });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages
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
