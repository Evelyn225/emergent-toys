
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


  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      throw new Error('API key not configured');
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `CREATE: Two random words.
FORMAT: word1 word2
RULES: No explanations, just output.`
        },
        {
          role: "user",
          content: "Create two random words."
        }
      ],
      temperature: 0.95
    });

    let theme = completion.choices[0].message.content.trim();

    // Validate and clean
    if (theme.split(" ").length !== 2) {
      // Fallback to interesting combos
      const fallbacks = [
        "fungal capitalism", "whispering calculus", "paper supernova",
        "glitching coral", "breathing architecture", "crying silicon",
        "molten grammar", "electric moss", "arctic circuitry", "neon folklore", "fractal tapestry"
      ];
      theme = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    res.json({
      theme: theme
    });
  } catch (error) {
    console.error('Detailed error:', error);
    const fallbackTheme = [
      "fungal capitalism", "whispering calculus", "paper supernova",
      "glitching coral", "breathing architecture", "crying silicon",
      "molten grammar", "electric moss", "arctic circuitry", "neon folklore", "fractal tapestry"
    ][Math.floor(Math.random() * 11)];

    res.json({
      theme: fallbackTheme,
      fallback: true,
      error: 'Failed to generate random theme',
      details: error.message
    });
  }
}
