// Yankees Scriptable Widget
// ─────────────────────────────────────────────────────────────────────────────
// SETUP:
//   1. Install Scriptable from the App Store (free)
//   2. Copy this file into Scriptable (tap + → paste, or use iCloud Drive)
//   3. Name the script "Yankees"
//   4. Add a Scriptable widget to your home screen, select "Yankees"
//   5. Small = score/status; Medium = full matchup + extras
// ─────────────────────────────────────────────────────────────────────────────

const YANKEES_ID = 147;
const APP_URL    = "https://bdk55.github.io/Yankees/";

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  navy:    new Color("#0C2340"),
  card:    new Color("#0e1e36"),
  silver:  new Color("#a8b8c8"),
  muted:   new Color("#5c7080"),
  white:   new Color("#FFFFFF"),
  win:     new Color("#4caf87"),
  loss:    new Color("#e05c5c"),
  yellow:  new Color("#f5c518"),
};

// ── Team abbreviation map ────────────────────────────────────────────────────
function abbr(name) {
  const map = {
    "New York Yankees":       "NYY", "Boston Red Sox":         "BOS",
    "Tampa Bay Rays":         "TB",  "Baltimore Orioles":      "BAL",
    "Toronto Blue Jays":      "TOR", "Houston Astros":         "HOU",
    "Texas Rangers":          "TEX", "Seattle Mariners":       "SEA",
    "Los Angeles Angels":     "LAA", "Oakland Athletics":      "OAK",
    "Athletics":              "ATH", "Chicago White Sox":      "CWS",
    "Cleveland Guardians":    "CLE", "Detroit Tigers":         "DET",
    "Kansas City Royals":     "KC",  "Minnesota Twins":        "MIN",
    "New York Mets":          "NYM", "Philadelphia Phillies":  "PHI",
    "Atlanta Braves":         "ATL", "Miami Marlins":          "MIA",
    "Washington Nationals":   "WSH", "Los Angeles Dodgers":    "LAD",
    "San Francisco Giants":   "SF",  "San Diego Padres":       "SD",
    "Colorado Rockies":       "COL", "Arizona Diamondbacks":   "ARI",
    "Chicago Cubs":           "CHC", "Milwaukee Brewers":      "MIL",
    "St. Louis Cardinals":    "STL", "Cincinnati Reds":        "CIN",
    "Pittsburgh Pirates":     "PIT",
  };
  return map[name] || name.split(" ").pop().slice(0, 3).toUpperCase();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const req = new Request(url);
  req.timeoutInterval = 10;
  return req.loadJSON();
}

function todayET() {
  // Returns YYYY-MM-DD in Eastern Time
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function fmtTime(datetime) {
  return new Date(datetime).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

function ordinal(n) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Data fetching ────────────────────────────────────────────────────────────
async function getTodayGame() {
  const today = todayET();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}&date=${today}&hydrate=probablePitcher,linescore,team(record)`;
  const data = await fetchJSON(url);
  const dates = data.dates || [];
  if (!dates.length || !dates[0].games.length) return null;
  const game = dates[0].games[0];
  const state  = game.status.abstractGameState;
  const detail = game.status.detailedState || "";
  const isLive = state === "Live" || detail.includes("Progress") || detail.includes("Delay");
  if (isLive) {
    try {
      game.linescore = await fetchJSON(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/linescore`);
    } catch (e) {}
  }
  return game;
}

async function getNextGame() {
  const today = todayET();
  // Look 14 days ahead for the next scheduled game
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const endStr = end.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}&startDate=${today}&endDate=${endStr}&hydrate=team`;
  const data = await fetchJSON(url);
  for (const d of (data.dates || [])) {
    for (const g of d.games) {
      if (g.status.abstractGameState !== "Final") return g;
    }
  }
  return null;
}

async function getRecord() {
  const today = todayET();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}&date=${today}&hydrate=team(record)`;
  const data = await fetchJSON(url);
  const dates = data.dates || [];
  if (dates.length && dates[0].games.length) {
    const g = dates[0].games[0];
    const isHome = g.teams.home.team.id === YANKEES_ID;
    const rec = isHome ? g.teams.home.leagueRecord : g.teams.away.leagueRecord;
    if (rec) return `${rec.wins}–${rec.losses}`;
  }
  return null;
}

// ── Widget building ──────────────────────────────────────────────────────────
function addLabel(stack, text, font, color, align = "left") {
  const el = stack.addText(text);
  el.font = font;
  el.textColor = color;
  if (align === "center") el.centerAlignText();
  if (align === "right") el.rightAlignText();
  return el;
}

function buildSmall(widget, game) {
  widget.backgroundColor = C.navy;
  widget.url = APP_URL;
  widget.setPadding(12, 12, 12, 12);

  const root = widget.addStack();
  root.layoutVertically();
  root.spacing = 4;

  if (!game) {
    addLabel(root, "NYY", Font.boldSystemFont(28), C.white);
    root.addSpacer();
    addLabel(root, "No game today", Font.mediumSystemFont(11), C.muted);
    return;
  }

  const isHome   = game.teams.home.team.id === YANKEES_ID;
  const oppTeam  = isHome ? game.teams.away : game.teams.home;
  const oppName  = abbr(oppTeam.team.name);
  const state    = game.status.abstractGameState;
  const detail   = game.status.detailedState || "";
  const isLive   = state === "Live" || detail.includes("Progress") || detail.includes("Delay");
  const isFinal  = state === "Final";
  const ls       = game.linescore;

  // Header: NYY vs OPP
  const headerStack = root.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  addLabel(headerStack, "NYY", Font.boldSystemFont(20), C.white);
  headerStack.addSpacer();
  addLabel(headerStack, "vs", Font.systemFont(11), C.muted, "center");
  headerStack.addSpacer();
  addLabel(headerStack, oppName, Font.boldSystemFont(20), C.silver);

  root.addSpacer(2);

  if (isLive && ls) {
    const aw = ls.teams?.away?.runs ?? 0;
    const hw = ls.teams?.home?.runs ?? 0;
    const yankRuns = isHome ? hw : aw;
    const oppRuns  = isHome ? aw : hw;

    // Score
    const scoreStack = root.addStack();
    scoreStack.layoutHorizontally();
    scoreStack.centerAlignContent();

    const yColor = yankRuns > oppRuns ? C.win : (yankRuns < oppRuns ? C.loss : C.white);
    const oColor = oppRuns > yankRuns ? C.win : (oppRuns < yankRuns ? C.loss : C.silver);
    addLabel(scoreStack, String(yankRuns), Font.boldSystemFont(30), yColor);
    headerStack.addSpacer();
    addLabel(scoreStack, "–", Font.systemFont(20), C.muted);
    scoreStack.addSpacer();
    addLabel(scoreStack, String(oppRuns), Font.boldSystemFont(30), oColor);

    root.addSpacer(2);

    // Inning
    const halfSymbol = ls.isTopInning ? "▲" : "▼";
    const innText = `${halfSymbol} ${ls.currentInning || 1}`;
    addLabel(root, innText, Font.mediumSystemFont(11), C.yellow);

  } else if (isFinal) {
    const aw = game.teams.away.score ?? 0;
    const hw = game.teams.home.score ?? 0;
    const yankRuns = isHome ? hw : aw;
    const oppRuns  = isHome ? aw : hw;
    const color = yankRuns > oppRuns ? C.win : C.loss;

    const scoreStack = root.addStack();
    scoreStack.layoutHorizontally();
    scoreStack.centerAlignContent();
    addLabel(scoreStack, String(yankRuns), Font.boldSystemFont(30), color);
    scoreStack.addSpacer();
    addLabel(scoreStack, "–", Font.systemFont(20), C.muted);
    scoreStack.addSpacer();
    addLabel(scoreStack, String(oppRuns), Font.boldSystemFont(30), C.silver);

    root.addSpacer(2);
    addLabel(root, "Final", Font.mediumSystemFont(10), C.muted);

  } else {
    // Scheduled
    const timeStr = fmtTime(game.gameDate);
    addLabel(root, timeStr, Font.boldSystemFont(16), C.white);
    addLabel(root, isHome ? "Home" : "@ " + oppName, Font.mediumSystemFont(10), C.muted);
  }

  root.addSpacer();

  // Updated-at timestamp
  const now = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  addLabel(root, `Updated ${now}`, Font.systemFont(8), C.muted);
}

function buildMedium(widget, game) {
  widget.backgroundColor = C.navy;
  widget.url = APP_URL;
  widget.setPadding(14, 16, 14, 16);

  const root = widget.addStack();
  root.layoutVertically();
  root.spacing = 6;

  // ── Title bar ──
  const titleBar = root.addStack();
  titleBar.layoutHorizontally();
  titleBar.centerAlignContent();

  addLabel(titleBar, "NEW YORK YANKEES", Font.boldSystemFont(11), C.silver);
  titleBar.addSpacer();

  if (!game) {
    addLabel(root, "No game scheduled today", Font.mediumSystemFont(13), C.muted);
    root.addSpacer();
    return;
  }

  const isHome   = game.teams.home.team.id === YANKEES_ID;
  const oppTeam  = isHome ? game.teams.away : game.teams.home;
  const oppName  = abbr(oppTeam.team.name);
  const state    = game.status.abstractGameState;
  const detail   = game.status.detailedState || "";
  const isLive   = state === "Live" || detail.includes("Progress") || detail.includes("Delay");
  const isFinal  = state === "Final";
  const ls       = game.linescore;

  // ── Matchup row ──
  const matchupStack = root.addStack();
  matchupStack.layoutHorizontally();
  matchupStack.centerAlignContent();
  matchupStack.spacing = 8;

  const awayName = abbr(game.teams.away.team.name);
  const homeName = abbr(game.teams.home.team.name);

  if (isLive && ls) {
    const aw = ls.teams?.away?.runs ?? 0;
    const hw = ls.teams?.home?.runs ?? 0;

    const awColor = aw > hw ? C.win : (aw < hw ? C.loss : C.white);
    const hwColor = hw > aw ? C.win : (hw < aw ? C.loss : C.white);
    const awFont  = game.teams.away.team.id === YANKEES_ID ? Font.boldSystemFont(26) : Font.systemFont(26);
    const hwFont  = game.teams.home.team.id === YANKEES_ID ? Font.boldSystemFont(26) : Font.systemFont(26);

    addLabel(matchupStack, awayName, Font.boldSystemFont(14), game.teams.away.team.id === YANKEES_ID ? C.white : C.silver);
    addLabel(matchupStack, String(aw), awFont, awColor);
    addLabel(matchupStack, "–", Font.systemFont(18), C.muted);
    addLabel(matchupStack, String(hw), hwFont, hwColor);
    addLabel(matchupStack, homeName, Font.boldSystemFont(14), game.teams.home.team.id === YANKEES_ID ? C.white : C.silver);

    matchupStack.addSpacer();

    // Inning badge
    const halfSymbol = ls.isTopInning ? "▲" : "▼";
    const innLabel = `${halfSymbol} ${ls.currentInning || 1}`;
    addLabel(matchupStack, innLabel, Font.boldSystemFont(13), C.yellow);

  } else if (isFinal) {
    const aw = game.teams.away.score ?? 0;
    const hw = game.teams.home.score ?? 0;
    const awColor = aw > hw ? C.win : (aw < hw ? C.loss : C.white);
    const hwColor = hw > aw ? C.win : (hw < aw ? C.loss : C.white);

    addLabel(matchupStack, awayName, Font.boldSystemFont(14), game.teams.away.team.id === YANKEES_ID ? C.white : C.silver);
    addLabel(matchupStack, String(aw), Font.boldSystemFont(26), awColor);
    addLabel(matchupStack, "–", Font.systemFont(18), C.muted);
    addLabel(matchupStack, String(hw), Font.boldSystemFont(26), hwColor);
    addLabel(matchupStack, homeName, Font.boldSystemFont(14), game.teams.home.team.id === YANKEES_ID ? C.white : C.silver);
    matchupStack.addSpacer();
    addLabel(matchupStack, "Final", Font.mediumSystemFont(11), C.muted);

  } else {
    // Scheduled
    addLabel(matchupStack, awayName, Font.boldSystemFont(16), game.teams.away.team.id === YANKEES_ID ? C.white : C.silver);
    matchupStack.addSpacer();
    addLabel(matchupStack, "vs", Font.systemFont(13), C.muted);
    matchupStack.addSpacer();
    addLabel(matchupStack, homeName, Font.boldSystemFont(16), game.teams.home.team.id === YANKEES_ID ? C.white : C.silver);
    matchupStack.addSpacer();
    addLabel(matchupStack, fmtTime(game.gameDate), Font.boldSystemFont(14), C.white);
  }

  // ── Live details: batter / pitcher / outs ──
  if (isLive && ls && ls.offense && ls.defense?.pitcher) {
    root.addSpacer(2);
    const detailStack = root.addStack();
    detailStack.layoutHorizontally();
    detailStack.spacing = 12;

    const batter  = ls.offense?.batter?.fullName  || "—";
    const pitcher = ls.defense?.pitcher?.fullName || "—";
    const outs    = ls.outs ?? 0;
    const outsStr = outs === 1 ? "1 out" : `${outs} outs`;

    // Batter
    const batStack = detailStack.addStack();
    batStack.layoutVertically();
    addLabel(batStack, "BATTER", Font.boldSystemFont(7), C.muted);
    const batEl = batStack.addText(batter);
    batEl.font = Font.mediumSystemFont(11);
    batEl.textColor = C.white;
    batEl.lineLimit = 1;
    batEl.minimumScaleFactor = 0.7;

    detailStack.addSpacer();

    // Outs
    addLabel(detailStack, outsStr, Font.mediumSystemFont(10), C.muted);

    detailStack.addSpacer();

    // Pitcher
    const pitStack = detailStack.addStack();
    pitStack.layoutVertically();
    addLabel(pitStack, "PITCHER", Font.boldSystemFont(7), C.muted);
    const pitEl = pitStack.addText(pitcher);
    pitEl.font = Font.mediumSystemFont(11);
    pitEl.textColor = C.silver;
    pitEl.lineLimit = 1;
    pitEl.minimumScaleFactor = 0.7;
  }

  // ── Probable pitchers (scheduled games) ──
  if (!isLive && !isFinal) {
    const awayP = game.teams.away.probablePitcher?.fullName;
    const homeP = game.teams.home.probablePitcher?.fullName;
    if (awayP || homeP) {
      root.addSpacer(2);
      const pitRow = root.addStack();
      pitRow.layoutHorizontally();
      pitRow.spacing = 4;

      addLabel(pitRow, "SP:", Font.boldSystemFont(9), C.muted);
      if (awayP) {
        const awEl = pitRow.addText(awayP);
        awEl.font = Font.systemFont(9);
        awEl.textColor = game.teams.away.team.id === YANKEES_ID ? C.white : C.silver;
        awEl.lineLimit = 1;
      }
      if (awayP && homeP) addLabel(pitRow, "vs", Font.systemFont(9), C.muted);
      if (homeP) {
        const hwEl = pitRow.addText(homeP);
        hwEl.font = Font.systemFont(9);
        hwEl.textColor = game.teams.home.team.id === YANKEES_ID ? C.white : C.silver;
        hwEl.lineLimit = 1;
      }
      pitRow.addSpacer();
    }
  }

  // ── Count + bases (live, medium only) ──
  if (isLive && ls && ls.offense) {
    root.addSpacer(2);
    const cbRow = root.addStack();
    cbRow.layoutHorizontally();
    cbRow.centerAlignContent();
    cbRow.spacing = 10;

    // Count
    const balls   = ls.balls   ?? 0;
    const strikes = ls.strikes ?? 0;
    addLabel(cbRow, `${balls}-${strikes}`, Font.boldSystemFont(12), C.white);
    addLabel(cbRow, "COUNT", Font.boldSystemFont(7), C.muted);

    cbRow.addSpacer();

    // Runners (text fallback since SFSymbols are unreliable in widgets)
    const onFirst  = !!ls.offense?.first;
    const onSecond = !!ls.offense?.second;
    const onThird  = !!ls.offense?.third;
    const runners  = [onThird ? "3B" : null, onSecond ? "2B" : null, onFirst ? "1B" : null]
      .filter(Boolean);
    const runnersStr = runners.length ? `On: ${runners.join(", ")}` : "Bases empty";
    addLabel(cbRow, runnersStr, Font.mediumSystemFont(10), runners.length ? C.yellow : C.muted);
  }

  root.addSpacer();

  // ── Footer: record + updated ──
  const footer = root.addStack();
  footer.layoutHorizontally();

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  addLabel(footer, `Updated ${now}`, Font.systemFont(8), C.muted);
  footer.addSpacer();
  addLabel(footer, "bdk55.github.io/Yankees", Font.systemFont(8), C.muted);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const widget = new ListWidget();
  widget.url = APP_URL;

  // Refresh: 5 min by default; check for live game to refresh sooner
  let refreshMinutes = 5;

  let game = null;
  try {
    game = await getTodayGame();
  } catch (e) {
    widget.backgroundColor = C.navy;
    widget.setPadding(14, 14, 14, 14);
    const root = widget.addStack();
    root.layoutVertically();
    addLabel(root, "NYY", Font.boldSystemFont(20), C.white);
    root.addSpacer(4);
    addLabel(root, "Unable to load data", Font.systemFont(11), C.loss);
    addLabel(root, e.message || "Network error", Font.systemFont(9), C.muted);
    Script.setWidget(widget);
    Script.complete();
    return;
  }

  // If no game today, show the next upcoming game
  if (!game) {
    try {
      game = await getNextGame();
    } catch (e) {}
  }

  const state  = game?.status.abstractGameState;
  const detail = game?.status.detailedState || "";
  const isLive = state === "Live" || detail.includes("Progress") || detail.includes("Delay");

  // Refresh aggressively during live games
  if (isLive) refreshMinutes = 1;

  widget.refreshAfterDate = new Date(Date.now() + refreshMinutes * 60 * 1000);

  const family = config.widgetFamily;
  if (family === "small") {
    buildSmall(widget, game);
  } else {
    // medium or large — use medium layout
    buildMedium(widget, game);
  }

  Script.setWidget(widget);

  // Also present inline when run from the app
  if (family === "small") {
    widget.presentSmall();
  } else {
    widget.presentMedium();
  }

  Script.complete();
}

run();
