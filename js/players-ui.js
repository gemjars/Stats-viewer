// Players tab: list rendering, and the add/edit player modal form.

let draftPlayer = null;
let editingPlayerId = null;

function renderPlayersList() {
  const grid = document.getElementById("players-grid");
  const empty = document.getElementById("players-empty");
  grid.innerHTML = "";

  if (players.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  players.forEach((p) => {
    const quali = computeTotals(p.qualifying.modes, QUALI_MODES);
    const champs1 = p.champs1.didNotPlay
      ? null
      : computeTotals(p.champs1.modes, CHAMPS_MODES);

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <h3>${escapeHtml(p.name) || "Unnamed Player"} ${p.pronouns ? `<span class="pronouns">(${escapeHtml(p.pronouns)})</span>` : ""}</h3>
      ${p.country ? `<div class="country">🌍 ${escapeHtml(p.country)}</div>` : ""}
      ${p.namePronounced ? `<div class="pronounced">🔊 ${escapeHtml(p.namePronounced)}</div>` : ""}
      ${p.keyFacts ? `<div class="key-facts">${escapeHtml(p.keyFacts)}</div>` : ""}
      <div class="quick-stats">
        <span>Qualifying: <b>${quali.wins}-${quali.losses}</b> (${formatWinPct(quali.winPct)})</span>
        <span>Champs 1: <b>${champs1 ? `${champs1.wins}-${champs1.losses}` : "Did not play"}</b></span>
      </div>
      <div class="card-actions">
        <button class="btn btn-small btn-edit-player" data-id="${p.id}">Edit</button>
        <button class="btn btn-danger btn-small btn-delete-player" data-id="${p.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function openPlayerModal(playerId) {
  editingPlayerId = playerId || null;
  const source = playerId ? players.find((p) => p.id === playerId) : null;
  draftPlayer = source
    ? JSON.parse(JSON.stringify(source))
    : createEmptyPlayer();

  document.getElementById("player-modal-title").textContent = playerId
    ? "Edit Player"
    : "Add Player";
  document.getElementById("f-name").value = draftPlayer.name;
  document.getElementById("f-pronouns").value = draftPlayer.pronouns;
  document.getElementById("f-country").value = draftPlayer.country || "";
  document.getElementById("f-pronounced").value = draftPlayer.namePronounced;
  document.getElementById("f-keyfacts").value = draftPlayer.keyFacts;
  document.getElementById("f-champs1-dnp").checked =
    draftPlayer.champs1.didNotPlay;
  document.getElementById("f-champs1-placement").value =
    draftPlayer.champs1.placement || "";
  document.getElementById("f-qualifying-elo").value =
    draftPlayer.qualifying.elo || "";
  document.getElementById("f-qualifying-placement").value =
    draftPlayer.qualifying.placement || "";

  renderChamps1Section();
  renderModesGrid(
    "qualifying-modes",
    QUALI_MODES,
    draftPlayer.qualifying.modes,
  );

  document.getElementById("player-modal").hidden = false;
}

function closePlayerModal() {
  document.getElementById("player-modal").hidden = true;
  draftPlayer = null;
  editingPlayerId = null;
}

function renderModesGrid(containerId, modesList, modesObj) {
  const container = document.getElementById(containerId);
  let html = `
    <div class="mode-header">Mode</div>
    <div class="mode-header">Wins</div>
    <div class="mode-header">Losses</div>
    <div class="mode-header">Win %</div>
  `;
  modesList.forEach((mode) => {
    const stats = modesObj[mode];
    const totals = computeTotals({ [mode]: stats }, [mode]);
    html += `
      <div>${MODE_LABELS[mode]}</div>
      <input type="number" min="0" class="mode-input" data-mode="${mode}" data-field="wins" value="${stats.wins}">
      <input type="number" min="0" class="mode-input" data-mode="${mode}" data-field="losses" value="${stats.losses}">
      <div class="winrate" data-mode="${mode}">${formatWinPct(totals.winPct)}</div>
    `;
  });
  container.innerHTML = html;

  // Update the win % readout in place and keep the data model numeric,
  // without re-rendering the inputs (that would wipe out what's being typed).
  function updateWinrate(mode) {
    const totals = computeTotals({ [mode]: modesObj[mode] }, [mode]);
    const el = container.querySelector(`.winrate[data-mode="${mode}"]`);
    if (el) el.textContent = formatWinPct(totals.winPct);
  }

  container.querySelectorAll(".mode-input").forEach((input) => {
    input.addEventListener("input", () => {
      const mode = input.dataset.mode;
      const field = input.dataset.field;
      modesObj[mode][field] =
        input.value === "" ? 0 : Math.max(0, Number(input.value) || 0);
      updateWinrate(mode);
    });
    input.addEventListener("blur", () => {
      if (input.value === "") input.value = "0";
    });
  });
}

function renderChamps1Section() {
  const dnp = draftPlayer.champs1.didNotPlay;
  document.getElementById("champs1-content").style.display = dnp ? "none" : "";
  if (!dnp) {
    renderModesGrid("champs1-modes", CHAMPS_MODES, draftPlayer.champs1.modes);
    renderMatchesList();
  }
}

function renderMatchesList() {
  const container = document.getElementById("champs1-matches");
  const matches = draftPlayer.champs1.matchHistory;
  if (matches.length === 0) {
    container.innerHTML =
      '<p class="empty-state" style="padding:8px 0;">No matches recorded yet.</p>';
    return;
  }

  container.innerHTML = matches
    .map(
      (match, idx) => `
    <div class="match-card" data-match-id="${match.id}">
      <div class="match-card-top">
        <input type="text" class="match-opponent" data-match-id="${match.id}" placeholder="Opponent name" value="${escapeHtml(match.opponentName || "")}">
        <input type="text" class="match-round" data-match-id="${match.id}" placeholder="Round (e.g. Quarterfinal)" value="${escapeHtml(match.round || "")}">
        <div class="score-pair">
          <input type="number" min="0" class="match-overall" data-match-id="${match.id}" data-side="you" value="${match.overallScore.you}" title="Your score">
          <span>-</span>
          <input type="number" min="0" class="match-overall" data-match-id="${match.id}" data-side="opponent" value="${match.overallScore.opponent}" title="Opponent score">
        </div>
        <button type="button" class="btn-remove-match" data-idx="${idx}">Remove</button>
      </div>
      <div class="match-modes-grid">
        ${CHAMPS_MODES.map(
          (mode) => `
          <div>
            <span class="mode-score-label">${MODE_LABELS[mode]}</span>
            <label class="pick-checkbox">
              <input type="checkbox" class="match-mode-pick" data-match-id="${match.id}" data-mode="${mode}" ${match.modeScores[mode].picked ? "checked" : ""}>
              Pick
            </label>
            <div class="score-pair">
              <input type="number" min="0" class="match-mode-score" data-match-id="${match.id}" data-mode="${mode}" data-side="you" value="${match.modeScores[mode].you}">
              <span>-</span>
              <input type="number" min="0" class="match-mode-score" data-match-id="${match.id}" data-mode="${mode}" data-side="opponent" value="${match.modeScores[mode].opponent}">
            </div>
          </div>
        `,
        ).join("")}
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll(".match-opponent").forEach((input) => {
    input.addEventListener("input", () => {
      const match = matches.find((m) => m.id === input.dataset.matchId);
      match.opponentName = input.value;
    });
  });

  container.querySelectorAll(".match-round").forEach((input) => {
    input.addEventListener("input", () => {
      const match = matches.find((m) => m.id === input.dataset.matchId);
      match.round = input.value;
    });
  });

  container.querySelectorAll(".match-overall").forEach((input) => {
    input.addEventListener("input", () => {
      const match = matches.find((m) => m.id === input.dataset.matchId);
      match.overallScore[input.dataset.side] =
        input.value === "" ? 0 : Math.max(0, Number(input.value) || 0);
    });
    input.addEventListener("blur", () => {
      if (input.value === "") input.value = "0";
    });
  });

  container.querySelectorAll(".match-mode-pick").forEach((cb) => {
    cb.addEventListener("change", () => {
      const match = matches.find((m) => m.id === cb.dataset.matchId);
      match.modeScores[cb.dataset.mode].picked = cb.checked;
    });
  });

  container.querySelectorAll(".match-mode-score").forEach((input) => {
    input.addEventListener("input", () => {
      const match = matches.find((m) => m.id === input.dataset.matchId);
      match.modeScores[input.dataset.mode][input.dataset.side] =
        input.value === "" ? 0 : Math.max(0, Number(input.value) || 0);
    });
    input.addEventListener("blur", () => {
      if (input.value === "") input.value = "0";
    });
  });

  container.querySelectorAll(".btn-remove-match").forEach((btn) => {
    btn.addEventListener("click", () => {
      matches.splice(Number(btn.dataset.idx), 1);
      renderMatchesList();
    });
  });
}

function setupPlayersTab() {
  document
    .getElementById("btn-add-player")
    .addEventListener("click", () => openPlayerModal(null));
  document
    .getElementById("btn-close-modal")
    .addEventListener("click", closePlayerModal);
  document
    .getElementById("btn-cancel-player")
    .addEventListener("click", closePlayerModal);

  document.getElementById("player-modal").addEventListener("click", (e) => {
    if (e.target.id === "player-modal") closePlayerModal();
  });

  document.getElementById("f-champs1-dnp").addEventListener("change", (e) => {
    draftPlayer.champs1.didNotPlay = e.target.checked;
    renderChamps1Section();
  });

  document.getElementById("btn-add-match").addEventListener("click", () => {
    draftPlayer.champs1.matchHistory.push(createEmptyMatch());
    renderMatchesList();
  });

  document
    .getElementById("player-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      draftPlayer.name = document.getElementById("f-name").value.trim();
      draftPlayer.pronouns = document.getElementById("f-pronouns").value.trim();
      draftPlayer.country = document.getElementById("f-country").value.trim();
      draftPlayer.namePronounced = document
        .getElementById("f-pronounced")
        .value.trim();
      draftPlayer.keyFacts = document.getElementById("f-keyfacts").value.trim();
      draftPlayer.champs1.placement = document
        .getElementById("f-champs1-placement")
        .value.trim();
      draftPlayer.qualifying.elo = document
        .getElementById("f-qualifying-elo")
        .value.trim();
      draftPlayer.qualifying.placement = document
        .getElementById("f-qualifying-placement")
        .value.trim();

      if (!draftPlayer.name) {
        showToast("Player name is required.", true);
        return;
      }

      const existingIdx = players.findIndex((p) => p.id === draftPlayer.id);
      if (existingIdx >= 0) {
        players[existingIdx] = draftPlayer;
      } else {
        players.push(draftPlayer);
      }

      closePlayerModal();
      await persistAndRefresh();
    });

  document
    .getElementById("players-grid")
    .addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".btn-edit-player");
      const delBtn = e.target.closest(".btn-delete-player");
      if (editBtn) {
        openPlayerModal(editBtn.dataset.id);
      } else if (delBtn) {
        const player = players.find((p) => p.id === delBtn.dataset.id);
        if (
          player &&
          window.confirm(`Delete ${player.name}? This cannot be undone.`)
        ) {
          players = players.filter((p) => p.id !== delBtn.dataset.id);
          await persistAndRefresh();
        }
      }
    });
}
