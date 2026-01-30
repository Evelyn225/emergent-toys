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

    const pass1 = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: pass1Prompt }],
      temperature: 0.9,
      max_tokens: 8000
    });

    let foundationCode = pass1.choices[0].message.content.trim();
    foundationCode = foundationCode.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');

    console.log('Pass 1 complete. Length:', foundationCode.length);

    // PASS 2: Enhance with advanced features and interactions
    const pass2Prompt = `You previously generated this foundation code for theme "${theme}":

${foundationCode}

PASS 2 OF 3: ENHANCEMENT
Add these advanced features to the EXISTING code:
- Complex animations and transitions (requestAnimationFrame)
- Additional interactive systems (drag, keyboard controls, gestures)
- Data visualizations or particle systems
- Sound/audio integration if relevant
- Hidden easter eggs and surprises
- Advanced library features (physics, 3D, audio synthesis)

Output the COMPLETE, ENHANCED code with all pass 1 + pass 2 features. Minimum 600+ lines.`;

    const pass2 = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: pass2Prompt }],
      temperature: 0.85,
      max_tokens: 12000
    });

    let enhancedCode = pass2.choices[0].message.content.trim();
    enhancedCode = enhancedCode.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');

    console.log('Pass 2 complete. Length:', enhancedCode.length);

    // PASS 3: Polish and add rich content
    const pass3Prompt = `You previously generated this enhanced code for theme "${theme}":

${enhancedCode}

PASS 3 OF 3: POLISH & CONTENT
Final improvements:
- Add rich textual content (descriptions, lore, instructions)
- Implement error handling (try-catch blocks)
- Add loading states and transitions
- Include help/info/about sections
- Add visual polish (more effects, better colors)
- Ensure all interactive elements have visual feedback
- Add accessibility features where needed
- Remove any TODO/FIXME comments with actual implementations

Output the FINAL, COMPLETE, POLISHED code. This should be production-ready.`;

    const pass3 = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: pass3Prompt }],
      temperature: 0.8,
      max_tokens: 16000
    });

    let finalCode = pass3.choices[0].message.content.trim();
    finalCode = finalCode.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');

    console.log('Pass 3 complete. Final length:', finalCode.length);

    res.json({ html: finalCode });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate website',
      details: error.message
    });
  }
}
