# Campus 54 website

The landing page for Campus 54, a free, fully virtual global AI summit by NSK AI (28–30 January 2027). It lives at campus54.nskai.org (its own Vercel project, GitHub repo nskai-edtech/campus54).

## Files
- `index.html` — the whole page. All English text is written here.
- `i18n.js` — French text. Every `data-i18n="key"` in index.html has a matching `"key"` here.
- `config.js` — the three application form links (English, French, Arabic), the sponsor form link (`sponsorForm`) and the countdown date. Change links here, nowhere else.
- `app.js` — language switch (EN/FR, remembered in the browser, also `?lang=fr` in the URL), form links and countdown.
- `styles.css` — all styles. The look is a retro arcade: Argentum Sans headings (in `assets/fonts`), Press Start 2P labels, Urbanist body text, red `#E00000`, black `#0A0A12`, yellow `#FFC400`, thick black borders and hard block shadows.
- `assets/img` — NSK AI logo, pixel Saturn, pixel robot and role sprites.

## Rules
- Plain HTML, CSS and JS. No framework and no build step, so it can be uploaded to any host as it is.
- Any new text on the page needs a `data-i18n` key in index.html and a French line in i18n.js. Run the key check below after editing.
- Write "Campus 54" with "by NSK AI" next to it where the brand appears, smaller.
- Contact for speakers, partners and sponsors: campus54@nskai.org.
- No placeholder text, no invented numbers, no photos of real people.
- The page must work on a phone (390px wide): check the sticky apply bar, the language switch and that nothing overlaps.
- Respect `prefers-reduced-motion` for any new animation.

## Checks
- Preview: `python -m http.server 8000`, then open http://localhost:8000 and http://localhost:8000/?lang=fr
- Missing French keys:
  `python -c "import re;h=open('index.html').read();j=open('i18n.js').read();k=set(re.findall(r'data-i18n=\"([^\"]+)\"',h));f=set(re.findall(r'^\s*\"([^\"]+)\":',j,re.M));print(sorted(k-f) or 'all translated')"`

## Possible next steps
- Arabic version of the page: add an `ar` block in i18n.js, add an AR button, and set `dir="rtl"` on `<html>` when Arabic is on.
- Partner and sponsor logo rows once partners have agreed.
