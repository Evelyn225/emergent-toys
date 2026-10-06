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

Install the [Rust toolchain](https://www.rust-lang.org/tools/install) and Tauri CLI (`cargo install tauri-cli --version '^2.0' --locked`), then run `npm run desktop:build` from Windows. This creates a per-user NSIS installer under `src-tauri/target/release/bundle/nsis/`. The installer packages the game and its audio for offline play. The desktop app checks GitHub releases on launch and offers newer Windows installers in the pause menu; checking is optional when offline, and installing remains a manual action. To publish a download, push a tag such as `ascii-city-v1.0.4` (the version should match both `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`); GitHub Actions builds and attaches `Glyphport-Setup.exe` to the release. Draft releases, prereleases, unrelated tags and releases without that installer are ignored.

sleepOS now runs user scripts as real processes in Web Workers, which browsers
will not load from `file://`. Open it through a server - `node server.cjs`, then
http://localhost:3000/sleep-os.html - rather than double-clicking the HTML file.
