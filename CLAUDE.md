# Eve Net — emergent-toys

A collection of interactive generative web toys, live at **evenet.fun**.

## Stack

- Vanilla HTML/CSS/JavaScript (no build step)
- Node.js + Express backend (`server.js`) for the bug hotline API
- Deployed on Vercel (`vercel.json`)

## Projects

| Emoji | Name | File |
|-------|------|------|
| ⏳ | Sand Playground | `Sands.html` |
| 🐛 | Bug Hotline | `critters.html` |
| 🎆 | Fireworks | `fireworks.html` |
| 🔮 | Pixel Splatter | `pixel-splatter.html` |
| 🔥 | Anime Hell | `hell.html` |
| 💧 | Fluid | `fluid.html` |
| 🎰 | The Web Wizard's Casino | `webwizardcasino.html` |
| 🌱 | Automata Garden | `automata-garden.html` |
| 🏔️ | Erosion Toy | `erosion.html` |
| 🌊 | Wave Collapse | `wave-collapse.html` |
| 🦑 | Tentacle Catch | `catch.html` |
| ⚗️ | Reaction Diffusion | `philosophers-stone.html` |
| 🔬 | Voronoi | `vornoi.html` |
| 📡 | Morse Code | `morse.html` |
| 〰️ | Lissajous | `lissajous.html` |
| 🌐 | Net Sanctuary Project | `net-sanctuary-project.html` |
| 💻 | ASCII Rendering | `ascii-render.html` |
| 🧶 | Tablecloth | `tablecloth.html` |
| 🚪 | Corridor Crawler | `corridor.html` |
| 🎛️ | Patch Synth | `synth.html` |

## Site Structure

- `index.html` — homepage dock with animated splash intro, dark/light theme toggle, and floating terminal background
- `images/` — icons, backgrounds, cursors
- `audio/` — audio assets
- `casino-assets/` — assets for the casino toy
- `api/` — serverless API routes (Vercel)
- `server.js` — local Express server (bug hotline backend, uses OpenAI)

## Dev

```bash
npm install
npm start   # runs server.js on localhost
```

For purely static toys, just open the HTML file directly in a browser — no server needed.
