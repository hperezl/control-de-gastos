window.CDG = window.CDG || {};

/* View helper: weekly gastos bar chart (SVG), rendered into a given <svg>.
   Single series (Movimientos only tracks gastos), so no legend box is needed —
   the section title already names it. */
CDG.Chart = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;
  const ns = "http://www.w3.org/2000/svg";

  function renderWeekChart(svg, movimientosDelPeriodo) {
    const totals = new Map();
    movimientosDelPeriodo.forEach(m => {
      const wk = M.weekKey(m.fecha);
      totals.set(wk, (totals.get(wk) || 0) + M.toColones(m.monto, m.moneda));
    });
    const weeks = Array.from(totals.keys()).sort();

    const width = Math.max(560, weeks.length * 90);
    const height = 200;
    const padL = 56, padB = 28, padT = 10, padR = 10;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.innerHTML = "";

    if (weeks.length === 0) {
      svg.innerHTML = `<text x="20" y="40" fill="var(--text-muted)" font-size="13">Sin gastos en este periodo.</text>`;
      return;
    }

    const maxVal = Math.max(1, ...weeks.map(w => totals.get(w)));
    const plotH = height - padT - padB;
    const plotW = width - padL - padR;
    const groupW = plotW / weeks.length;
    const barW = Math.min(36, groupW * 0.5);
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH - (plotH * i / 4);
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", padL); line.setAttribute("x2", width - padR);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("stroke", cssVar("--gridline")); line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
      const val = maxVal * i / 4;
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", padL - 8); t.setAttribute("y", y + 4);
      t.setAttribute("text-anchor", "end"); t.setAttribute("font-size", "10");
      t.setAttribute("fill", cssVar("--text-muted"));
      t.textContent = Math.round(val / 1000) + "k";
      svg.appendChild(t);
    }
    const baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("x1", padL); baseline.setAttribute("x2", width - padR);
    baseline.setAttribute("y1", padT + plotH); baseline.setAttribute("y2", padT + plotH);
    baseline.setAttribute("stroke", cssVar("--baseline")); baseline.setAttribute("stroke-width", "1.5");
    svg.appendChild(baseline);

    const tooltip = document.getElementById("barTooltip");
    const color = cssVar("--series-gasto");

    weeks.forEach((wk, i) => {
      const val = totals.get(wk);
      const cx = padL + groupW * i + groupW / 2;
      const h = (val / maxVal) * plotH;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", cx - barW / 2);
      rect.setAttribute("y", padT + plotH - h);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", Math.max(h, 0));
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", color);
      rect.addEventListener("mousemove", (e) => {
        tooltip.style.display = "block";
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
        tooltip.innerHTML = `<div class="t-title">Semana ${M.weekLabel(wk)}</div>${U.fmtCRC(val)}`;
      });
      rect.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
      svg.appendChild(rect);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", cx); label.setAttribute("y", height - 8);
      label.setAttribute("text-anchor", "middle"); label.setAttribute("font-size", "10");
      label.setAttribute("fill", cssVar("--text-muted"));
      label.textContent = M.weekLabel(wk);
      svg.appendChild(label);
    });
  }

  /* Donut chart: gasto por categoría del periodo. Caps at the top 3 categories
     (individually colored) and folds the rest into "Otros" (muted gray) — a
     pie/donut puts every slice adjacent to every other one, and per the
     palette's own validation only its first 3 categorical hues clear the
     colorblind-safety floor under that "all pairs" condition. The legend
     always carries the name + amount as text, so identity never rests on
     hue alone even for the folded slices. */
  function renderCategoryDonut(svg, legendEl, movimientosDelPeriodo) {
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const tooltip = document.getElementById("barTooltip");

    const totals = new Map();
    movimientosDelPeriodo.forEach(m => {
      const cat = m.categoria || "Otro";
      totals.set(cat, (totals.get(cat) || 0) + M.toColones(m.monto, m.moneda));
    });
    const entries = Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    svg.innerHTML = "";
    if (entries.length === 0 || total <= 0) {
      svg.innerHTML = `<text x="100" y="104" text-anchor="middle" fill="var(--text-muted)" font-size="13">Sin gastos</text>`;
      legendEl.innerHTML = `<div class="empty-hint">Sin gastos en este periodo.</div>`;
      return;
    }

    const CAT_COLORS = [cssVar("--series-cat-1"), cssVar("--series-cat-2"), cssVar("--series-cat-3")];
    const OTROS_COLOR = cssVar("--text-muted");
    let slices;
    if (entries.length <= 3) {
      slices = entries.map(([cat, val], i) => ({ label: cat, value: val, color: CAT_COLORS[i] }));
    } else {
      const top = entries.slice(0, 3).map(([cat, val], i) => ({ label: cat, value: val, color: CAT_COLORS[i] }));
      const restTotal = entries.slice(3).reduce((s, [, v]) => s + v, 0);
      slices = top.concat([{ label: "Otros", value: restTotal, color: OTROS_COLOR }]);
    }

    const size = 200, r = 70, c = size / 2, strokeW = 26;
    const circumference = 2 * Math.PI * r;
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    const group = document.createElementNS(ns, "g");
    group.setAttribute("transform", `rotate(-90 ${c} ${c})`);
    svg.appendChild(group);

    const track = document.createElementNS(ns, "circle");
    track.setAttribute("cx", c); track.setAttribute("cy", c); track.setAttribute("r", r);
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", cssVar("--gridline"));
    track.setAttribute("stroke-width", strokeW);
    group.appendChild(track);

    let cumulative = 0;
    slices.forEach(s => {
      const frac = s.value / total;
      const len = frac * circumference;
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", c); circle.setAttribute("cy", c); circle.setAttribute("r", r);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", s.color);
      circle.setAttribute("stroke-width", strokeW);
      circle.setAttribute("stroke-dasharray", `${Math.max(len - 2, 0)} ${circumference - len + 2}`);
      circle.setAttribute("stroke-dashoffset", String(-cumulative));
      circle.style.cursor = "pointer";
      circle.addEventListener("mousemove", (e) => {
        tooltip.style.display = "block";
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
        tooltip.innerHTML = `<div class="t-title">${U.escapeHtml(s.label)}</div>${U.fmtCRC(s.value)} · ${(frac * 100).toFixed(1)}%`;
      });
      circle.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
      group.appendChild(circle);
      cumulative += len;
    });

    const centerVal = document.createElementNS(ns, "text");
    centerVal.setAttribute("x", c); centerVal.setAttribute("y", c - 2);
    centerVal.setAttribute("text-anchor", "middle");
    centerVal.setAttribute("font-size", "15");
    centerVal.setAttribute("font-weight", "700");
    centerVal.setAttribute("fill", cssVar("--text-primary"));
    centerVal.textContent = U.fmtCRC(total);
    svg.appendChild(centerVal);

    const centerLabel = document.createElementNS(ns, "text");
    centerLabel.setAttribute("x", c); centerLabel.setAttribute("y", c + 16);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("font-size", "10");
    centerLabel.setAttribute("fill", cssVar("--text-muted"));
    centerLabel.textContent = "Total gastado";
    svg.appendChild(centerLabel);

    legendEl.innerHTML = slices.map(s => {
      const pct = ((s.value / total) * 100).toFixed(1);
      return `<div class="donut-legend-item">
        <span class="swatch" style="background:${s.color}"></span>
        <span class="donut-legend-label">${U.escapeHtml(s.label)}</span>
        <span class="donut-legend-pct">${pct}%</span>
        <span class="donut-legend-amt">${U.fmtCRC(s.value)}</span>
      </div>`;
    }).join("");
  }

  return { renderWeekChart, renderCategoryDonut };
})();
