

import { OpenAI } from 'openai';

const fallbacks = [
  "crayon paint tool", "Game of Life variant with hexagonal cells", "Animated fractal tree that grows with mouse movement",
  "Inverse kinematics tentacle following the cursor", "Procedural city generator", "Interactive cellular automata playground",
  "kaleidoscopic pattern generator", "Generative art inspired by Mondrian", "Particle system with flocking behavior",
  "Recursive subdivision maze generator", "Boids flocking simulation with predators", "Big dog woof woof",
  "Water ripple simulation", "Organic growth algorithm", "Procedural cave generation",
  "fungal capitalism", "whispering calculus", "paper supernova",
  "glitching coral", "breathing architecture", "crying silicon",
  "molten grammar", "electric moss", "arctic circuitry", "neon folklore", "fractal tapestry"
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
          content: `CREATE: A short, interesting, creative idea for a p5.js sketch or generative site.
FORMAT: A short, descriptive phrase or sentence.
EXAMPLES: "Sand physics simulation", "Game of Life variant with hexagonal cells", "Animated fractal tree that grows with mouse movement", "Inverse kinematics tentacle following the cursor", "Procedural city generator", "Interactive cellular automata playground", "Dynamic Voronoi diagram with moving points", "Generative art inspired by Mondrian", "Particle system with flocking behavior", "Recursive subdivision maze generator".
RULES: No explanations, just output the idea as a phrase or sentence.`
        },
        {
          role: "user",
          content: "Create a short, interesting idea for a p5.js sketch or generative site."
        }
      ],
      temperature: 0.95
    });

    let theme = completion.choices[0].message.content.trim();

    // Validate and clean
    if (!theme || theme.length < 8) {
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
