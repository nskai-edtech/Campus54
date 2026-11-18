(function () {
  var cfg = window.CAMPUS54 || { forms: {} };
  var dict = window.I18N || {};
  var SUPPORTED = ["en", "fr"];

  // ---------- language ----------
  function pickLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q && SUPPORTED.indexOf(q) > -1) return q;
    try {
      var saved = localStorage.getItem("c54-lang");
      if (saved && SUPPORTED.indexOf(saved) > -1) return saved;
    } catch (e) {}
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return SUPPORTED.indexOf(nav) > -1 ? nav : "en";
  }

  function formUrl(code) {
    var u = (cfg.forms || {})[code];
    return u && u.trim() ? u.trim() : "#apply";
  }

  function applyLang(lang) {
    var strings = dict[lang] || {};
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML; // keep the English once
      var key = el.getAttribute("data-i18n");
      el.innerHTML = lang === "en" ? el.dataset.en : (strings[key] || el.dataset.en);
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var parts = el.getAttribute("data-i18n-attr").split(":");
      var attr = parts[0], key = parts[1];
      var store = "en" + attr;
      if (el.dataset[store] === undefined) el.dataset[store] = el.getAttribute(attr);
      el.setAttribute(attr, lang === "en" ? el.dataset[store] : (strings[key] || el.dataset[store]));
    });

    // Main apply button goes to the form in the page's language;
    // the small link offers the other of English/French, plus Arabic.
    var main = document.getElementById("apply-main");
    if (main) main.href = formUrl(lang);
    var other = lang === "fr" ? "en" : "fr";
    var a = document.getElementById("form-link-a");
    if (a) {
      a.href = formUrl(other);
      a.textContent = other === "fr" ? "Français" : "English";
      a.lang = other;
    }
    var ar = document.getElementById("form-link-ar");
    if (ar) ar.href = formUrl("ar");

    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false");
    });

    try { localStorage.setItem("c54-lang", lang); } catch (e) {}
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      var lang = b.dataset.lang;
      applyLang(lang);
      var url = new URL(location.href);
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    });
  });

  applyLang(pickLang());

  // ---------- Discord ----------
  if (cfg.discord && cfg.discord.trim()) {
    document.querySelectorAll("[data-discord]").forEach(function (el) { el.href = cfg.discord.trim(); });
  }

  // ---------- sponsor and community forms ----------
  // Each button keeps its mailto: fallback until a form link is set in config.js.
  [["sponsor-main", cfg.sponsorForm], ["community-main", cfg.communityForm]].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    var url = pair[1] && pair[1].trim();
    if (el && url) {
      el.href = url;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  });

  // ---------- countdown ----------
  var target = new Date(cfg.eventStart || "2027-01-28T00:00:00+01:00").getTime();
  var els = {
    d: document.getElementById("cd-days"),
    h: document.getElementById("cd-hours"),
    m: document.getElementById("cd-mins"),
    s: document.getElementById("cd-secs")
  };
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function tick() {
    var diff = Math.max(0, target - Date.now());
    if (els.d) els.d.textContent = String(Math.floor(diff / 86400000));
    if (els.h) els.h.textContent = pad(Math.floor(diff / 3600000) % 24);
    if (els.m) els.m.textContent = pad(Math.floor(diff / 60000) % 60);
    if (els.s) els.s.textContent = pad(Math.floor(diff / 1000) % 60);
  }
  tick();
  setInterval(tick, 1000);
})();
