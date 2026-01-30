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
      return res.status(500).json({ error: 'API key not configured' });
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });

    // Generate two random, interesting words
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative word generator. Generate two very random words. Return ONLY the two words separated by a space, nothing else. Make them unexpected, weird, or abstract. Examples: 'quantum pickle', 'glitchy nostalgia', 'floating anxiety', 'digital moss'"
        },
        {
          role: "user",
          content: "Generate two random words."
        }
      ],
      temperature: 1.2,
      max_tokens: 20
    });

    const words = completion.choices[0].message.content.trim();
    
    res.json({ 
      words: words,
      theme: words // Support both for compatibility
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate random words',
      details: error.message
    });
  }
}
