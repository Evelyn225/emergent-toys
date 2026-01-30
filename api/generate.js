import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse JSON body if POST
  let body = {};
  if (req.method === 'POST') {
    try {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          try {
            console.log('Raw POST data:', data);
            resolve(JSON.parse(data));
          } catch (err) {
            console.error('JSON parse error. Data received:', data);
            reject(err);
          }
        });
      });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { theme, prompt, isReview } = body;

  // Validate input
  if (!theme || !prompt) {
    return res.status(400).json({ error: "Missing 'theme' or 'prompt'." });
  }

  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });

    // If this is a review pass, just do a single generation with high tokens
    if (isReview) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 16000
      });

      let html = completion.choices[0].message.content.trim();
      html = html.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');
      
      return res.json({ html: html });
    }

    // Multi-pass generation for initial creation
    console.log('Starting multi-pass generation for theme:', theme);

    try {
      // PASS 1: Generate core structure with styling
      const pass1Prompt = `${prompt}

PASS 1 OF 3: FOUNDATION
Focus on:
- Complete HTML structure with semantic elements
- Comprehensive CSS styling (gradients, animations, effects)
- Initial JavaScript framework and state management
- At least 3 external library imports
- Basic interactive elements

Output ONLY the code for this foundation. Make it substantial (400+ lines).`;

      console.log('Starting Pass 1...');
      const pass1 = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: pass1Prompt }],
        temperature: 0.9,
        max_tokens: 8000
      });

      let foundationCode = pass1.choices[0].message.content.trim();
      foundationCode = foundationCode.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');

      console.log('Pass 1 complete. Length:', foundationCode.length);

      // Check if foundation code is too large for next pass
      if (foundationCode.length > 30000) {
        console.warn('Foundation code too large, returning as-is');
        return res.json({ html: foundationCode });
      }

      // PASS 2: Enhance with advanced features and interactions
      const pass2Prompt = `You previously generated this foundation code for theme "${theme}":

${foundationCode.substring(0, 25000)}${foundationCode.length > 25000 ? '\n\n[...code truncated for brevity...]' : ''}

PASS 2 OF 3: ENHANCEMENT
Add these advanced features to the EXISTING code:
- Complex animations and transitions (requestAnimationFrame)
- Additional interactive systems (drag, keyboard controls, gestures)
- Data visualizations or particle systems
- Sound/audio integration if relevant
- Hidden easter eggs and surprises
- Advanced library features (physics, 3D, audio synthesis)

Output the COMPLETE, ENHANCED code with all pass 1 + pass 2 features. Minimum 600+ lines.`;

      console.log('Starting Pass 2...');
      const pass2 = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: pass2Prompt }],
        temperature: 0.85,
        max_tokens: 12000
      });

      let enhancedCode = pass2.choices[0].message.content.trim();
      enhancedCode = enhancedCode.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');

      console.log('Pass 2 complete. Length:', enhancedCode.length);

      // Return pass 2 result (skip pass 3 to save time and tokens)
      console.log('Returning enhanced code from Pass 2');
      return res.json({ html: enhancedCode });

    } catch (passError) {
      console.error('Error in multi-pass generation:', passError);
      console.log('Falling back to single-pass generation');
      
      // Fallback to single-pass generation
      const fallbackCompletion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 16000
      });

      let fallbackHtml = fallbackCompletion.choices[0].message.content.trim();
      fallbackHtml = fallbackHtml.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');
      
      return res.json({ html: fallbackHtml });
    }
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate website',
      details: error.message
    });
  }
}
