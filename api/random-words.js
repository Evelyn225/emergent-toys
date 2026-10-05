import { OpenAI } from 'openai';

const fallbacks = [
  "90s dental office aquarium screensaver",
  "cursed tamagotchi that eats your mouse clicks",
  "haunted vending machine in a 3D abandoned subway station",
  "bureaucratic rubber stamp physics simulator",
  "first person corridor crawler set inside a microwave oven",
  "cassette tape rewinding synth visualizer",
  "procedural mold growth on forgotten cheese",
  "ant colony building a brutalist shopping mall",
  "windows 95 defragmenter game with glitching blocks",
  "arcade claw machine filled with gelatinous glowing cubes",
  "dial-up modem handshake signal visualizer",
  "overheated server rack ambient soundscape and heat monitor",
  "medieval monk illuminator manuscript painter",
  "retro bowling alley strike animation generator",
  "subterranean fungus capitalism simulation",
  "oscilloscope displaying angry cat facial expressions"
];

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
          content: `You generate ultra-creative, weird, niche, nostalgic, absurd, or hyper-specific themes for web experiments, retro 3D games, audio toys, and interactive art pieces.

STRICT BANNED WORDS (NEVER USE THESE):
- dreamscape, digital cosmos, ethereal, luminescent, nexus, tapestry, quantum, sanctuary, symphony, realm, voyage, matrix, harmonic, canvas of infinity, digital playground.

WHAT TO GENERATE INSTEAD:
- Concrete, weird, retro, tactile, absurd, or niche ideas!
- Mix odd combinations of real-world artifacts, retro tech, physics toys, bizarre simulations, and specific aesthetic genres.
- EXAMPLES:
  * 90s dental office aquarium screensaver
  * Cursed tamagotchi that eats your mouse clicks
  * Haunted vending machine in a 3D subway station
  * Bureaucratic rubber stamp physics simulator
  * 3D corridor crawler set inside a microwave oven
  * Cassette tape rewinding sound synth
  * Ant colony building a brutalist shopping mall
  * Arcade claw machine filled with gelatinous glowing cubes
  * Windows 95 defragmenter puzzle game
  * Subterranean fungus capitalism simulation

FORMAT: Return ONLY a single short phrase (3-8 words). No quotes, no markdown, no explanations.`
        },
        {
          role: "user",
          content: "Give me a weird, niche, highly specific idea for an interactive web toy or game."
        }
      ],
      temperature: 1.15
    });

    let theme = completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');

    // Validate and clean
    if (!theme || theme.length < 5) {
      theme = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    res.json({
      theme: theme
    });
  } catch (error) {
    console.error('Detailed error:', error);
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({
      theme: fallback,
      fallback: true,
      error: 'Failed to generate random theme',
      details: error.message
    });
  }
}
