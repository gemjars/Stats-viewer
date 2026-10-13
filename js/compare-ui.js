// Compare tab: player picker + side-by-side comparison table and match history.

let compareSelection = new Set();

function renderComparePicker() {
  const container = document.getElementById("compare-picker");
  container.innerHTML = players
    .map(
      (p) => `
    <label>
      <input type="checkbox" class="compare-check" value="${p.id}" ${compareSelection.has(p.id) ? "checked" : ""}>
      ${escapeHtml(p.name) || "Unnamed Player"}
    </label>
  `,
    )
    .join("");

  container.querySelectorAll(".compare-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) compareSelection.add(cb.value);
      else compareSelection.delete(cb.value);
      renderCompareTable();
    });
  });
}

function statRow(label, cells) {
  return `<tr><td class="stat-label">${label}</td>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

function sectionRow(label, span) {
  return `<tr class="section-row"><td colspan="${span}">${label}</td></tr>`;
}

// Shared by the inline single-player view and the collapsed detail section.
function buildMatchHistoryItemsHtml(matches) {
  if (matches.length === 0) {
    return '<p class="empty-state" style="padding:4px 0;">No matches recorded.</p>';
  }
  return matches
    .map((m) => {
      const oppName =
        m.opponentName ||
        (players.find((pl) => pl.id === m.opponentId) || {}).name ||
        "Unknown opponent";
      const resultClass =
        m.overallScore.you > m.overallScore.opponent
          ? "match-win"
          : m.overallScore.you < m.overallScore.opponent
            ? "match-loss"
            : "";
      const modeBreakdown = CHAMPS_MODES.filter((mode) => {
        const s = normalizeModeScore(m.modeScores[mode]);
        return s.wins !== 0 || s.losses !== 0;
      })
        .map((mode) => {
          const s = normalizeModeScore(m.modeScores[mode]);
          return `${MODE_LABELS[mode]}${s.picked ? ' <span class="pick-tag">Pick</span>' : ""} ${s.wins}-${s.losses}`;
        })
        .join(" · ");
      return `
          <div class="compare-match-item ${resultClass}">
            <div class="vs-line"><span>vs ${escapeHtml(oppName)}${m.round ? ` <span class="match-round-tag">${escapeHtml(m.round)}</span>` : ""}</span><span>${m.overallScore.you}-${m.overallScore.opponent}</span></div>
            ${modeBreakdown ? `<div class="mode-breakdown">${modeBreakdown}</div>` : ""}
          </div>
        `;
    })
    .join("");
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Builds a single-category wheel (Qualifying or Champs 1 only) so each chart
// has fewer, larger wedges and is easier to read than one combined wheel.
function buildGroupWheelSvg(modesList, modesObj, color, centerLabel) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 76;
  const labelR = maxR + 28;
  const n = modesList.length;
  const anglePer = 360 / n;

  const sectorData = modesList.map((mode, i) => {
    const stats = modesObj[mode];
    const totals = computeTotals({ [mode]: stats }, [mode]);
    const winPct = totals.winPct;
    const r = winPct === null ? 0 : Math.max((winPct / 100) * maxR, 3);
    const games = totals.wins + totals.losses;
    return { mode, startAngle: i * anglePer, winPct, r, games };
  });

  const gridCircles = [0.25, 0.5, 0.75, 1]
    .map(
      (f) =>
        `<circle cx="${cx}" cy="${cy}" r="${(maxR * f).toFixed(1)}" class="wheel-grid" />`,
    )
    .join("");

  const spokes = sectorData
    .map((s) => {
      const p = polarPoint(cx, cy, maxR, s.startAngle);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="wheel-spoke" />`;
    })
    .join("");

  const wedges = sectorData
    .map((s) => {
      const p1 = polarPoint(cx, cy, s.r, s.startAngle);
      const p2 = polarPoint(cx, cy, s.r, s.startAngle + anglePer);
      const path = `M ${cx} ${cy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${s.r.toFixed(1)} ${s.r.toFixed(1)} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
      return `<path d="${path}" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1" />`;
    })
    .join("");

  // Skip labels for modes with no games played - an empty wedge already says "no data".
  // Always place the number near the outer ring (not scaled to wedge size) so a
  // cluster of small wedges doesn't bunch their labels up against the center readout.
  const valueLabels = sectorData
    .filter((s) => s.winPct !== null)
    .map((s) => {
      const mid = s.startAngle + anglePer / 2;
      const r = maxR - 10;
      const p = polarPoint(cx, cy, r, mid);
      return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="wheel-value">${formatWinPct(s.winPct)}</text>`;
    })
    .join("");

  const outerLabels = sectorData
    .map((s) => {
      const mid = s.startAngle + anglePer / 2;
      const p = polarPoint(cx, cy, labelR, mid);
      const rad = ((mid - 90) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const anchor = dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";
      // Stack the games-count line directly under the mode name (not further along
      // the radius) so side labels don't smear into the next sector's label.
      return `
        <text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="wheel-label" text-anchor="${anchor}">${MODE_LABELS[s.mode]}</text>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 12).toFixed(1)}" class="wheel-label-games" text-anchor="${anchor}">${s.games} game${s.games === 1 ? "" : "s"}</text>
      `;
    })
    .join("");

  const totals = computeTotals(modesObj, modesList);

  return `
    <svg class="wheel-svg" viewBox="0 0 ${size} ${size}">
      ${gridCircles}
      ${spokes}
      ${wedges}
      ${valueLabels}
      ${outerLabels}
      <text x="${cx}" y="${cy - 6}" class="wheel-center-pct">${formatWinPct(totals.winPct)}</text>
      <text x="${cx}" y="${cy + 12}" class="wheel-center-label">${centerLabel}</text>
    </svg>
  `;
}

function renderCompareCharts(selected) {
  const wrap = document.getElementById("compare-charts-wrap");
  // A single selected player gets more room, so make their charts bigger and roomier.
  const single = selected.length === 1;
  const singleClass = single ? " chart-card--single" : "";
  wrap.innerHTML = selected
    .map((p) => {
      const qualiTotals = computeTotals(p.qualifying.modes, QUALI_MODES);
      const qualiSvg = buildGroupWheelSvg(
        QUALI_MODES,
        p.qualifying.modes,
        CHART_GROUP_COLORS.quali,
        "Qualifying",
      );
      const champsTotals = p.champs1.didNotPlay
        ? null
        : computeTotals(p.champs1.modes, CHAMPS_MODES);
      const champsBlock = p.champs1.didNotPlay
        ? '<div class="dnp-placeholder">Did not play in Champs 1</div>'
        : buildGroupWheelSvg(
            CHAMPS_MODES,
            p.champs1.modes,
            CHART_GROUP_COLORS.champs1,
            "Champs 1",
          );
      // Only room (and context) to show full match history inline when it's the one chart on screen.
      const inlineMatches =
        single && !p.champs1.didNotPlay
          ? `<div class="chart-group-matches">
              <h5>Match History</h5>
              ${buildMatchHistoryItemsHtml(p.champs1.matchHistory)}
            </div>`
          : "";
      return `
    <div class="chart-card${singleClass}">
      <h4>${escapeHtml(p.name)}${p.pronouns ? `<span class="pronouns">(${escapeHtml(p.pronouns)})</span>` : ""}</h4>
      ${single ? `<button type="button" class="btn btn-secondary btn-small btn-save-image" data-player-id="${p.id}">Save as Image</button>` : ""}
      <div class="wheel-row">
        <div class="chart-group">
          <h5>Qualifying</h5>
          <div class="chart-group-totals">${qualiTotals.wins}W – ${qualiTotals.losses}L</div>
          ${p.qualifying.elo ? `<div class="chart-group-placement">Elo: ${escapeHtml(p.qualifying.elo)}</div>` : ""}
          ${p.qualifying.placement ? `<div class="chart-group-placement">Placement: ${escapeHtml(p.qualifying.placement)}</div>` : ""}
          ${qualiSvg}
        </div>
        <div class="chart-group">
          <h5>Champs 1</h5>
          ${champsTotals ? `<div class="chart-group-totals">${champsTotals.wins}W – ${champsTotals.losses}L</div>` : ""}
          ${champsTotals && p.champs1.placement ? `<div class="chart-group-placement">Placement: ${escapeHtml(p.champs1.placement)}</div>` : ""}
          ${champsBlock}
        </div>
      </div>
      ${inlineMatches}
      <div class="chart-player-info">
        ${p.country ? `<div class="info-line">🌍 ${escapeHtml(p.country)}</div>` : ""}
        ${p.namePronounced ? `<div class="info-line">🔊 ${escapeHtml(p.namePronounced)}</div>` : ""}
        ${p.keyFacts ? `<div class="info-keyfacts">${escapeHtml(p.keyFacts)}</div>` : ""}
      </div>
    </div>`;
    })
    .join("");
}

function renderCompareTable() {
  const tableWrap = document.getElementById("compare-table-wrap");
  const matchesWrap = document.getElementById("compare-matches-wrap");
  const chartsWrap = document.getElementById("compare-charts-wrap");
  const details = document.getElementById("compare-details");
  const empty = document.getElementById("compare-empty");

  const selected = players.filter((p) => compareSelection.has(p.id));

  if (selected.length < 1) {
    tableWrap.innerHTML = "";
    matchesWrap.innerHTML = "";
    chartsWrap.innerHTML = "";
    details.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  details.hidden = false;
  renderCompareCharts(selected);

  const colCount = selected.length + 1;
  let html = '<table class="compare-table"><thead><tr><th>Player</th>';
  selected.forEach((p) => {
    html += `<th>${escapeHtml(p.name)}</th>`;
  });
  html += "</tr></thead><tbody>";

  html += statRow(
    "Pronouns",
    selected.map((p) => escapeHtml(p.pronouns) || "—"),
  );
  html += statRow(
    "Country",
    selected.map((p) => escapeHtml(p.country) || "—"),
  );
  html += statRow(
    "Name Pronounced",
    selected.map((p) => escapeHtml(p.namePronounced) || "—"),
  );
  html += `<tr><td class="stat-label">Key Facts</td>${selected.map((p) => `<td class="key-facts-cell">${escapeHtml(p.keyFacts) || "—"}</td>`).join("")}</tr>`;

  html += sectionRow("Qualifying", colCount);
  html += statRow(
    "Elo",
    selected.map((p) => escapeHtml(p.qualifying.elo) || "—"),
  );
  html += statRow(
    "Placement",
    selected.map((p) => escapeHtml(p.qualifying.placement) || "—"),
  );
  QUALI_MODES.forEach((mode) => {
    const cells = selected.map((p) => {
      const s = p.qualifying.modes[mode];
      const t = computeTotals({ [mode]: s }, [mode]);
      return `${s.wins}-${s.losses} <span style="color:var(--text-dim)">(${formatWinPct(t.winPct)})</span>`;
    });
    html += statRow(MODE_LABELS[mode], cells);
  });
  html += statRow(
    "<b>Qualifying Total</b>",
    selected.map((p) => {
      const t = computeTotals(p.qualifying.modes, QUALI_MODES);
      return `<b>${t.wins}-${t.losses}</b> (${formatWinPct(t.winPct)})`;
    }),
  );

  html += sectionRow("Champs 1", colCount);
  html += statRow(
    "Status",
    selected.map((p) => (p.champs1.didNotPlay ? "Did not play" : "Played")),
  );
  html += statRow(
    "Placement",
    selected.map((p) => escapeHtml(p.champs1.placement) || "—"),
  );
  CHAMPS_MODES.forEach((mode) => {
    const cells = selected.map((p) => {
      if (p.champs1.didNotPlay) return "—";
      const s = p.champs1.modes[mode];
      const wl = modeStatWinsLosses(s);
      const t = computeTotals({ [mode]: s }, [mode]);
      return `${wl.wins}-${wl.losses} <span style="color:var(--text-dim)">(${formatWinPct(t.winPct)})</span>`;
    });
    html += statRow(MODE_LABELS[mode], cells);
  });
  html += statRow(
    "<b>Champs 1 Total</b>",
    selected.map((p) => {
      if (p.champs1.didNotPlay) return "—";
      const t = computeTotals(p.champs1.modes, CHAMPS_MODES);
      return `<b>${t.wins}-${t.losses}</b> (${formatWinPct(t.winPct)})`;
    }),
  );

  html += "</tbody></table>";
  tableWrap.innerHTML = html;

  matchesWrap.innerHTML = selected
    .map((p) => {
      const itemsHtml = buildMatchHistoryItemsHtml(p.champs1.matchHistory);
      return `<div class="compare-match-card"><h4>${escapeHtml(p.name)} — Champs 1 Matches</h4>${itemsHtml}</div>`;
    })
    .join("");
}

function setupCompareTab() {
  document.getElementById("btn-select-all").addEventListener("click", () => {
    compareSelection = new Set(players.map((p) => p.id));
    renderComparePicker();
    renderCompareTable();
  });
  document.getElementById("btn-select-none").addEventListener("click", () => {
    compareSelection = new Set();
    renderComparePicker();
    renderCompareTable();
  });

  document
    .getElementById("compare-charts-wrap")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-save-image");
      if (!btn) return;
      const player = players.find((p) => p.id === btn.dataset.playerId);
      if (player) exportPlayerImage(player);
    });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

// Draws one Qualifying/Champs 1 wheel directly onto the canvas (same angle/radius
// math as buildGroupWheelSvg) so the exported PNG never needs to rasterize an
// <img>, which avoids the browser's canvas "tainted by foreignObject" restriction.
function drawWheelOnCanvas(ctx, cx, cy, maxR, modesList, modesObj, color) {
  const n = modesList.length;
  const anglePer = 360 / n;
  const toXY = (r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const sectorData = modesList.map((mode, i) => {
    const totals = computeTotals({ [mode]: modesObj[mode] }, [mode]);
    const r =
      totals.winPct === null ? 0 : Math.max((totals.winPct / 100) * maxR, 3);
    return {
      mode,
      startAngle: i * anglePer,
      winPct: totals.winPct,
      r,
      games: totals.wins + totals.losses,
    };
  });

  ctx.strokeStyle = "#d7dce3";
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2);
    ctx.stroke();
  });
  sectorData.forEach((s) => {
    const p = toXY(maxR, s.startAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  sectorData.forEach((s) => {
    const startRad = ((s.startAngle - 90) * Math.PI) / 180;
    const endRad = ((s.startAngle + anglePer - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, s.r, startRad, endRad);
    ctx.closePath();
    ctx.fillStyle = `${color}d9`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.textBaseline = "middle";
  sectorData
    .filter((s) => s.winPct !== null)
    .forEach((s) => {
      const mid = s.startAngle + anglePer / 2;
      const p = toXY(maxR - 10, mid);
      ctx.fillStyle = "#1a2130";
      ctx.font = "bold 15px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText(formatWinPct(s.winPct), p.x, p.y);
    });

  const labelR = maxR + 30;
  sectorData.forEach((s) => {
    const mid = s.startAngle + anglePer / 2;
    const p = toXY(labelR, mid);
    const rad = ((mid - 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    ctx.textAlign = dx > 0.3 ? "left" : dx < -0.3 ? "right" : "center";
    ctx.fillStyle = "#1a2130";
    ctx.font = "bold 14px 'Segoe UI'";
    ctx.fillText(modeLabelPlain(s.mode), p.x, p.y);
    ctx.fillStyle = "#5b6472";
    ctx.font = "11px 'Segoe UI'";
    ctx.fillText(`${s.games} game${s.games === 1 ? "" : "s"}`, p.x, p.y + 16);
  });

  const totals = computeTotals(modesObj, modesList);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1a2130";
  ctx.font = "bold 28px 'Segoe UI'";
  ctx.fillText(formatWinPct(totals.winPct), cx, cy - 8);
  ctx.fillStyle = "#5b6472";
  ctx.font = "12px 'Segoe UI'";
  ctx.fillText("OVERALL", cx, cy + 16);
}

function drawDnpBox(ctx, cx, cy, size) {
  const half = size / 2;
  ctx.strokeStyle = "#d7dce3";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - half, cy - half, size, size);
  ctx.setLineDash([]);
  ctx.fillStyle = "#5b6472";
  ctx.font = "22px 'Segoe UI'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Did not play in Champs 1", cx, cy);
}

// A4 at 150dpi (close enough for sharp on-screen/print output without being too heavy to render).
const EXPORT_WIDTH = 1240;
const EXPORT_HEIGHT = 1754;

// Paints the whole single-player stats sheet straight onto a canvas (no
// intermediate image), which is the only reliable way to end up with a
// non-tainted canvas we're actually allowed to export as a PNG file.
function exportPlayerImage(player) {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  const marginX = 70;
  const contentWidth = EXPORT_WIDTH - marginX * 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  // Header
  let y = 100;
  ctx.textAlign = "center";
  ctx.fillStyle = "#1a2130";
  ctx.font = "bold 48px 'Segoe UI'";
  let headerText = player.name || "Unnamed Player";
  if (player.pronouns) headerText += `  (${player.pronouns})`;
  ctx.fillText(headerText, EXPORT_WIDTH / 2, y);
  y += 40;
  const infoBits = [];
  if (player.country) infoBits.push(`🌍 ${player.country}`);
  if (player.namePronounced) infoBits.push(`🔊 ${player.namePronounced}`);
  if (infoBits.length) {
    ctx.font = "22px 'Segoe UI'";
    ctx.fillStyle = "#5b6472";
    ctx.fillText(infoBits.join("      "), EXPORT_WIDTH / 2, y);
  }

  // Wheels row
  const rowTop = 220;
  const colWidth = (contentWidth - 60) / 2;
  const colCenters = [
    marginX + colWidth / 2,
    marginX + colWidth + 60 + colWidth / 2,
  ];
  const maxR = 220;

  [
    {
      title: "QUALIFYING",
      totals: computeTotals(player.qualifying.modes, QUALI_MODES),
      extra: [
        player.qualifying.elo ? `Elo: ${player.qualifying.elo}` : "",
        player.qualifying.placement
          ? `Placement: ${player.qualifying.placement}`
          : "",
      ].filter(Boolean),
      draw: (cx, cy) =>
        drawWheelOnCanvas(
          ctx,
          cx,
          cy,
          maxR,
          QUALI_MODES,
          player.qualifying.modes,
          CHART_GROUP_COLORS.quali,
        ),
    },
    {
      title: "CHAMPS 1",
      totals: player.champs1.didNotPlay
        ? null
        : computeTotals(player.champs1.modes, CHAMPS_MODES),
      extra: player.champs1.placement
        ? [`Placement: ${player.champs1.placement}`]
        : [],
      draw: (cx, cy) =>
        player.champs1.didNotPlay
          ? drawDnpBox(ctx, cx, cy, maxR * 1.3)
          : drawWheelOnCanvas(
              ctx,
              cx,
              cy,
              maxR,
              CHAMPS_MODES,
              player.champs1.modes,
              CHART_GROUP_COLORS.champs1,
            ),
    },
  ].forEach((col, i) => {
    const cx = colCenters[i];
    let colY = rowTop;
    ctx.textAlign = "center";
    ctx.font = "bold 24px 'Segoe UI'";
    ctx.fillStyle = "#5b6472";
    ctx.fillText(col.title, cx, colY);
    colY += 38;
    if (col.totals) {
      ctx.font = "bold 30px 'Segoe UI'";
      ctx.fillStyle = "#1a2130";
      ctx.fillText(
        `${col.totals.wins}W \u2013 ${col.totals.losses}L`,
        cx,
        colY,
      );
      colY += 32;
    }
    col.extra.forEach((line) => {
      ctx.font = "20px 'Segoe UI'";
      ctx.fillStyle = "#5b6472";
      ctx.fillText(line, cx, colY);
      colY += 26;
    });
    colY += maxR + 70;
    col.draw(cx, colY);
  });

  // Match history (full width, below the wheels)
  let matchY = rowTop + 38 + 32 + 26 * 2 + maxR * 2 + 100;
  const matches = player.champs1.didNotPlay ? [] : player.champs1.matchHistory;
  const footerReserve = player.keyFacts ? 160 : 60;
  const matchBottom = EXPORT_HEIGHT - footerReserve;

  if (matches.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "bold 24px 'Segoe UI'";
    ctx.fillStyle = "#5b6472";
    ctx.fillText("MATCH HISTORY", EXPORT_WIDTH / 2, matchY);
    matchY += 36;
    ctx.textAlign = "left";

    for (const m of matches) {
      if (matchY > matchBottom) break;
      const oppName = m.opponentName || "Unknown opponent";
      const resultWin = m.overallScore.you > m.overallScore.opponent;
      const resultLoss = m.overallScore.you < m.overallScore.opponent;
      ctx.fillStyle = resultWin
        ? "#eaf7ef"
        : resultLoss
          ? "#fbe9ec"
          : "#f0f2f5";
      ctx.fillRect(marginX, matchY - 24, contentWidth, 56);

      ctx.font = "bold 20px 'Segoe UI'";
      ctx.fillStyle = "#1a2130";
      let vsLine = `vs ${oppName}`;
      if (m.round) vsLine += `  (${m.round})`;
      ctx.fillText(vsLine, marginX + 14, matchY);
      ctx.textAlign = "right";
      ctx.fillText(
        `${m.overallScore.you}-${m.overallScore.opponent}`,
        marginX + contentWidth - 14,
        matchY,
      );
      ctx.textAlign = "left";

      const breakdown = CHAMPS_MODES.filter((mode) => {
        const s = normalizeModeScore(m.modeScores[mode]);
        return s.wins !== 0 || s.losses !== 0;
      })
        .map((mode) => {
          const s = normalizeModeScore(m.modeScores[mode]);
          const pick = s.picked ? " [Pick]" : "";
          return `${modeLabelPlain(mode)}${pick} ${s.wins}-${s.losses}`;
        })
        .join("   \u00b7   ");
      if (breakdown) {
        ctx.font = "16px 'Segoe UI'";
        ctx.fillStyle = "#5b6472";
        ctx.fillText(breakdown, marginX + 14, matchY + 22);
      }
      matchY += 70;
    }
  }

  // Key facts footer, pinned near the bottom
  if (player.keyFacts) {
    ctx.font = "bold 30px 'Segoe UI'";
    const lines = player.keyFacts
      .split("\n")
      .flatMap((line) => wrapCanvasText(ctx, line, contentWidth));
    const blockHeight = lines.length * 38 + 30;
    const topY = EXPORT_HEIGHT - 60 - blockHeight;
    ctx.strokeStyle = "#d7dce3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginX, topY - 10);
    ctx.lineTo(EXPORT_WIDTH - marginX, topY - 10);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#1a2130";
    lines.forEach((line, i) => {
      ctx.fillText(line, marginX, topY + 30 + i * 38);
    });
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      showToast("Could not generate the image.", true);
      return;
    }
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const safeName = (player.name || "player").replace(/[^a-z0-9]+/gi, "-");
    a.download = `${safeName}-stats.png`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  }, "image/png");
}
