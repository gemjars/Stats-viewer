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

function emptyModeScores(modes) {
  const obj = {};
  modes.forEach((m) => {
    obj[m] = { you: 0, opponent: 0 };
  });
  return obj;
}

function createEmptyMatch() {
  return {
    id: uuid(),
    opponentId: "",
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
      modes: emptyModeStats(CHAMPS_MODES),
      matchHistory: [],
    },
    qualifying: {
      modes: emptyModeStats(QUALI_MODES),
    },
  };
}

function computeTotals(modesObj, modesList) {
  let wins = 0;
  let losses = 0;
  modesList.forEach((m) => {
    const s = modesObj[m] || { wins: 0, losses: 0 };
    wins += Number(s.wins) || 0;
    losses += Number(s.losses) || 0;
  });
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : null;
  return { wins, losses, winPct };
}

function formatWinPct(winPct) {
  return winPct === null ? "—" : `${winPct}%`;
}
