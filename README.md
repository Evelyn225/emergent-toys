# eve net

*a collection of interactive curiosities*

→ **[evenet.fun](https://evenet.fun)**

---

## run locally

```bash
npm install
npm start
```

opens at `localhost:3000`

## build the Windows desktop app

Install the [Rust toolchain](https://www.rust-lang.org/tools/install) and Tauri CLI (`cargo install tauri-cli --version '^2.0' --locked`), then run `npm run desktop:build` from Windows. This creates a per-user NSIS installer under `src-tauri/target/release/bundle/nsis/`. The installer packages the game and its audio for offline play. To publish a download in the in-game pause menu, push a tag named `ascii-city-v1.0.0` (the version should match `src-tauri/tauri.conf.json`); GitHub Actions builds and attaches `Glyphport-Setup.exe` to a release.

sleepOS now runs user scripts as real processes in Web Workers, which browsers
will not load from `file://`. Open it through a server - `node server.cjs`, then
http://localhost:3000/sleep-os.html - rather than double-clicking the HTML file.
