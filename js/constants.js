// Game mode definitions and data model helpers.

const CHAMPS_MODES = ["UHC", "Sword", "SpearMace", "Cart", "DSMP"];
const QUALI_MODES = [
  "UHC",
  "Sword",
  "SpearMace",
  "Cart",
  "DSMP",
  "Crystal",
  "DiaPot",
];

const MODE_LABELS = {
  UHC: "UHC",
  Sword: "Sword",
  SpearMace: "Spear & Mace",
  Cart: "Cart",
  DSMP: "DSMP",
  Crystal: "Crystal",
  DiaPot: "Dia Pot",
};

const CHART_GROUP_COLORS = {
  quali: "#5b8def",
  champs1: "#e2566b",
  dnp: "#4b5873",
};

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptyModeStats(modes) {
  const obj = {};
  modes.forEach((m) => {
    obj[m] = { wins: 0, losses: 0 };
  });
  return obj;
}

function emptyModePlayedWon(modes) {
  const obj = {};
  modes.forEach((m) => {
    obj[m] = { played: 0, won: 0 };
  });
  return obj;
}

function emptyModeScores(modes) {
  const obj = {};
  modes.forEach((m) => {
    obj[m] = { played: 0, won: 0, picked: false };
  });
  return obj;
}

// Match mode scores are entered as "games played" + "games won" (losses are
// derived). Old saved data used "you"/"opponent" - back-fill played/won from
// those so existing matches keep showing correctly.
function normalizeModeScore(scoreObj) {
  if (scoreObj.played === undefined || scoreObj.won === undefined) {
    const legacyYou = Number(scoreObj.you) || 0;
    const legacyOpponent = Number(scoreObj.opponent) || 0;
    scoreObj.played = legacyYou + legacyOpponent;
    scoreObj.won = legacyYou;
  }
  return scoreObj;
}

// Champs 1 mode totals are entered as "games played" + "games won" too. Old
// saved data used "wins"/"losses" - back-fill played/won for old players.
function normalizeModeStat(statObj) {
  if (statObj.played === undefined || statObj.won === undefined) {
    const legacyWins = Number(statObj.wins) || 0;
    const legacyLosses = Number(statObj.losses) || 0;
    statObj.played = legacyWins + legacyLosses;
    statObj.won = legacyWins;
  }
  return statObj;
}

// Reads a mode stat as {wins, losses} regardless of whether it's stored in
// the old wins/losses shape or the played/won shape.
function modeStatWinsLosses(stat) {
  if (stat.played !== undefined || stat.won !== undefined) {
    const played = Number(stat.played) || 0;
    const won = Number(stat.won) || 0;
    return { wins: won, losses: Math.max(0, played - won) };
  }
  return { wins: Number(stat.wins) || 0, losses: Number(stat.losses) || 0 };
}

function createEmptyMatch() {
  return {
    id: uuid(),
    opponentName: "",
    round: "",
    overallScore: { you: 0, opponent: 0 },
    modeScores: emptyModeScores(CHAMPS_MODES),
  };
}

function createEmptyPlayer() {
  return {
    id: uuid(),
    name: "",
    pronouns: "",
    country: "",
    namePronounced: "",
    keyFacts: "",
    champs1: {
      didNotPlay: false,
      placement: "",
      modes: emptyModePlayedWon(CHAMPS_MODES),
      matchHistory: [],
    },
    qualifying: {
      elo: "",
      placement: "",
      modes: emptyModeStats(QUALI_MODES),
    },
  };
}

function computeTotals(modesObj, modesList) {
  let wins = 0;
  let losses = 0;
  modesList.forEach((m) => {
    const s = modesObj[m] || { wins: 0, losses: 0 };
    const wl = modeStatWinsLosses(s);
    wins += wl.wins;
    losses += wl.losses;
  });
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : null;
  return { wins, losses, winPct };
}

function formatWinPct(winPct) {
  return winPct === null ? "—" : `${winPct}%`;
}
