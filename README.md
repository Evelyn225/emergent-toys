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

sleepOS now runs user scripts as real processes in Web Workers, which browsers
will not load from `file://`. Open it through a server - `node server.cjs`, then
http://localhost:3000/sleep-os.html - rather than double-clicking the HTML file.
