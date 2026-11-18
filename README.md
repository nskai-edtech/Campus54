# Campus 54 website

## See it on your computer
```bash
cd campus54-site
python -m http.server 8000
```
Open http://localhost:8000 in your browser. Use the EN / FR buttons at the top right to switch language.

## Add the form links
Open `config.js` and paste the three Google Form links between the quotes:
```js
forms: {
  en: "https://forms.gle/...",
  fr: "https://forms.gle/...",
  ar: "https://forms.gle/..."
}
```
Paste the sponsor form link (for example Airtable) into `sponsorForm`. While it is empty, "Sponsor Campus 54" opens an email instead.

On the English page, "Apply now" opens the English form. On the French page, it opens the French form. The small links under the button offer the other language and Arabic.

## Change the French text
Edit `i18n.js`. English text is in `index.html`.

## Put it online
It is its own Vercel project at campus54.nskai.org. Every push to the `main` branch on GitHub (nskai-edtech/campus54) goes live about a minute later.

## Rock Run (the game at /play)
- `play/` is the game: `index.html`, `game.js` (all game logic, EN/FR text inside), `play.css`, `sw.js` (offline support, controls /play/ only), `manifest.webmanifest`.
- `api/score.js` saves a score, `api/leaderboard.js` returns the top 50 players. Both use Upstash Redis through `api/_redis.js` (keys start with `c54:`). The Vercel project needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the game still plays and says the ranking is unavailable.
- Names are unique: the first player to use a name owns it (`c54:name:<lowercased name>` holds their player id), and anyone else gets a 409 and is asked for another. Renaming frees the old name. Limits: 20 scores per minute per IP, scores above 2000 points per second played are refused, names are cleaned.
- Offline: scores are kept in the browser (`c54-pending`) and sent when the device is online again.
- After changing any game file, bump `VERSION` in `play/sw.js`, or returning players keep the old copy.
- To remove a bad name: in Upstash, delete its id from the `c54:players` sorted set, and delete `c54:player:<id>` and `c54:name:<lowercased name>`.
