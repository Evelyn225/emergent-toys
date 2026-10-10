
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: 'openai.env' });

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' })); // web wizard edits post the full generated page

// Dynamically load and cache ESM handlers
const handlers = {};

async function getHandler(moduleName) {
    if (!handlers[moduleName]) {
        handlers[moduleName] = (await import(pathToFileURL(path.resolve(`./api/${moduleName}.js`)).href)).default;
    }
    return handlers[moduleName];
}

// Voronoi used to be misspelled; keep old links working.
app.get(['/vornoi', '/vornoi.html'], (req, res) => res.redirect(301, '/voronoi.html'));

app.get(['/ottawa', '/ottawa/'], (req, res) => {
  res.sendFile(path.resolve('ottawa-trip.html'));
});

app.all('/api/ottawa-state', async (req, res) => {
  try {
    const handler = await getHandler('ottawa-state');
    await handler(req, res);
  } catch {
    res.status(500).json({ error: 'Failed to load Ottawa planner API' });
  }
});

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

// Route for /api/bug-chat (with and without .js extension)
app.all(['/api/bug-chat', '/api/bug-chat.js'], async (req, res) => {
  try {
    const handler = await getHandler('bug-chat');
    await handler(req, res);
  } catch (error) {
    console.error('Error loading bug-chat handler:', error);
    res.status(500).json({ error: 'Failed to load handler' });
  }
});

// Static files go last so /api/*.js hits the handlers above instead of
// being served as source.
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
