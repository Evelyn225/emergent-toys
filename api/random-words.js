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

    const moods = [
      "apocalyptic", "euphoric", "melancholic", "anxious", "nostalgic",
      "whimsical", "mysterious", "serene", "chaotic", "dreamlike",
      "surreal", "playful", "ominous", "strange", "vibrant",
      "refined", "minimal", "gritty", "futuristic", "retro",
      "ugly", "beautiful", "dark", "light", "liminal",
      "ceremonial", "feral", "synthetic", "sublime", "uncanny"
    ];

    const mood = moods[Math.floor(Math.random() * moods.length)];

    // Mood-specific guidance
    const moodDirectives = {
      "apocalyptic": "Think: ruins, survival, aftermath, resilience",
      "euphoric": "Think: transcendence, dissolution, ecstasy, unity",
      "melancholic": "Think: memory, absence, soft decay, quiet longing",
      "whimsical": "Think: absurd charm, playful logic, delightful nonsense",
      "ominous": "Think: quiet dread, unseen threat, subtle wrongness",
      "ugly": "Think: intentionally off-putting, wrong beauty, unsettling",
      "dreamlike": "Think: fluid logic, shifting forms, memory distortion",
      "liminal": "Think: threshold spaces, between states, waiting, transit",
      "uncanny": "Think: familiar yet strange, subtle horror, almost-right"
    };

    const personas = [
      {
        name: "The Poet",
        desc: "Creates beautiful, meaningful metaphors",
        style: "poetic",
        examples: ["whispering calculus", "paper supernova"],
        instruction: "Find the hidden connection between seemingly unrelated concepts."
      },
      {
        name: "The Dadaist",
        desc: "Creates absurd, nonsensical combinations",
        style: "absurd",
        examples: ["dirt piano", "blood horse"],
        instruction: "Combine words that absolutely should not go together. Reject meaning."
      },
      {
        name: "The Surrealist",
        desc: "Creates dreamlike, bizarre imagery",
        style: "surreal",
        examples: ["melting clocks", "floating elephants"],
        instruction: "Create imagery from dreams or altered states of consciousness."
      },
      {
        name: "The Scientist",
        desc: "Creates technical-sounding nonsense",
        style: "technical",
        examples: ["quantum toast", "cellular democracy"],
        instruction: "Mix scientific terms with everyday objects in impossible ways."
      },
      {
        name: "The Child",
        desc: "Creates simple, literal, funny combinations",
        style: "childlike",
        examples: ["angry carpet", "fuzzy electricity"],
        instruction: "Think like a 5-year-old describing things literally and simply."
      }
    ];

    const persona = personas[Math.floor(Math.random() * personas.length)];
    const selectedMood = moods[Math.floor(Math.random() * moods.length)];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are: ${persona.name}
${persona.desc}

YOUR MISSION: ${persona.instruction}

MOOD TO INFUSE: ${selectedMood}

YOUR STYLE EXAMPLES:
${persona.examples.map(ex => `• ${ex}`).join('\n')}

CREATE: One two-word phrase in your unique style
FORMAT: word1 word2
RULES: No explanations, just output`
        },
        {
          role: "user",
          content: "Create a phrase."
        }
      ],
      temperature: persona.style === "absurd" ? 1.0 : 0.8
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
      theme: theme,
      persona: {
        name: persona.name,
        style: persona.style,
        desc: persona.desc
      },
      mood: selectedMood
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate random words',
      details: error.message
    });
  }
}
