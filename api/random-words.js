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

  const moods = [
    "apocalyptic", "euphoric", "melancholic", "anxious", "nostalgic",
    "whimsical", "mysterious", "serene", "chaotic", "dreamlike",
    "surreal", "playful", "ominous", "strange", "vibrant",
    "refined", "minimal", "gritty", "futuristic", "retro",
    "ugly", "beautiful", "dark", "light", "liminal",
    "ceremonial", "feral", "synthetic", "sublime", "uncanny"
  ];

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
      },
      {
        name: "The Mystic",
        desc: "Creates spiritual, occult, ritualistic combinations",
        style: "mystical",
        examples: ["astral bread", "prayer static"],
        instruction: "Channel the sacred and the supernatural into everyday objects."
      },
      {
        name: "The Architect",
        desc: "Creates structural, spatial, geometric combinations",
        style: "architectural",
        examples: ["recursive doorway", "angular emotion"],
        instruction: "Build impossible spaces and structural metaphors."
      },
      {
        name: "The Glitch",
        desc: "Creates corrupted, broken, error-state combinations",
        style: "corrupted",
        examples: ["█████ memory", "404 emotion"],
        instruction: "Embrace digital decay, system failures, and beautiful errors."
      },
      {
        name: "The Collector",
        desc: "Creates archival, taxonomic, obsessive combinations",
        style: "curatorial",
        examples: ["catalogued ghosts", "indexed silence"],
        instruction: "Organize the unorganizable. Create systems for the abstract."
      },
      {
        name: "The Prophet",
        desc: "Creates apocalyptic, visionary, future-past combinations",
        style: "prophetic",
        examples: ["yesterday's tomorrow", "extinct dawn"],
        instruction: "Speak of futures that have already happened and pasts yet to come."
      },
      {
        name: "The Dog Who Understands English But Can't Speak",
        desc: "Knows exactly what's wrong but can only woof",
        style: "canine",
        examples: ["bark democracy", "whimper algorithm", "growl poetry"],
        instruction: "Express complex ideas through simple canine emotions and sounds."
      },
      {
        name: "The ZIP Bomb",
        desc: "Compresses absurdity into dense nonsense",
        style: "compressed",
        examples: ["recursive cat", "infinite folder", "compressed scream"],
        instruction: "Create tiny inputs that explode into vast complexity."
      },
      {
        name: "The Server at 3AM",
        desc: "Sleep-deprived, hallucinating system administrator",
        style: "exhausted",
        examples: ["caffeine memory", "log file dreams", "kernel panic"],
        instruction: "Channel the delirium of late-night debugging and system maintenance."
      },
      {
        name: "The Compiler Error",
        desc: "Creates themes from programming nightmares",
        style: "error-prone",
        examples: ["syntax blood", "null pointer dance", "stack overflow"],
        instruction: "Transform code failures into poetic disasters."
      },
      {
        name: "The Arcade Machine (1983)",
        desc: "Classic quarter-munching, high-score chasing design",
        style: "arcade",
        examples: ["high score attack", "quarter eater", "crt filter"],
        instruction: "Think in coins, lives, and attract modes."
      },
      {
        name: "The Puzzle Master",
        desc: "Creates logical challenges and 'aha!' moments",
        style: "puzzle",
        examples: ["logic maze", "pattern recognition", "escape room"],
        instruction: "Design mysteries that unfold through observation and deduction."
      },
      {
        name: "The Browser Abuser",
        desc: "Uses browser APIs in unintended, creative ways",
        style: "hacker",
        examples: ["localStorage saga", "cookie monster", "geolocation game"],
        instruction: "Weaponize browser features for unexpected purposes."
      },
      {
        name: "The Geocities Architect (1998)",
        desc: "Builds maximalist, animated, under-construction sites",
        style: "retro-web",
        examples: ["under construction", "guestbook madness", "webring portal"],
        instruction: "Embrace the chaos of the early web with pride."
      }
    ];

  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      throw new Error('API key not configured');
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });

    const persona = personas[Math.floor(Math.random() * personas.length)];
    const selectedMood = moods[Math.floor(Math.random() * moods.length)];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are: ${persona.name}
${persona.desc}

YOUR MISSION: ${persona.instruction}

MOOD TO INFUSE: ${selectedMood}

YOUR STYLE EXAMPLES:
${persona.examples.map(ex => `• ${ex}`).join('\n')}

CREATE: One nonsensical two-word phrase in your unique style
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
    const fallbackPersonas = personas.length > 0 ? personas : [
      { name: "The Poet", style: "poetic", desc: "Creates beautiful, meaningful metaphors" }
    ];
    const fallbackPersona = fallbackPersonas[Math.floor(Math.random() * fallbackPersonas.length)];
    const fallbackTheme = [
      "fungal capitalism", "whispering calculus", "paper supernova",
      "glitching coral", "breathing architecture", "crying silicon",
      "molten grammar", "electric moss", "arctic circuitry", "neon folklore", "fractal tapestry"
    ][Math.floor(Math.random() * 11)];
    const fallbackMood = moods[Math.floor(Math.random() * moods.length)];

    res.json({
      theme: fallbackTheme,
      persona: {
        name: fallbackPersona.name,
        style: fallbackPersona.style,
        desc: fallbackPersona.desc
      },
      mood: fallbackMood,
      fallback: true,
      error: 'Failed to generate random words',
      details: error.message
    });
  }
}
