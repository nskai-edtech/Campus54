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
