(function () {
  const data = window.SITE_DATA || {};
  const fmt = (n) => n.toLocaleString("en-US");
  const SVG = "http://www.w3.org/2000/svg";

  function el(name, attrs, text) {
    const node = document.createElementNS(SVG, name);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text != null) node.textContent = text;
    return node;
  }

  function renderBridge(key) {
    const chart = document.getElementById("bridge-chart");
    const bridge = data.bridges && data.bridges[key];
    if (!chart || !bridge) return;

    document.getElementById("bridge-title").textContent = bridge.title;
    document.getElementById("bridge-desc").textContent = bridge.desc;

    const W = 960;
    const H = 340;
    const pad = { top: 34, bottom: 64, left: 12, right: 12 };
    const steps = bridge.steps;
    const slot = (W - pad.left - pad.right) / steps.length;
    const barW = Math.min(96, slot * 0.58);

    let running = 0;
    const bars = steps.map((s) => {
      let from;
      let to;
      if (s.total) {
        from = 0;
        to = s.value;
        running = s.value;
      } else {
        from = running;
        to = running + s.value;
        running = to;
      }
      return { ...s, from, to };
    });

    const max = Math.max(...bars.map((b) => Math.max(b.from, b.to))) * 1.08;
    const y = (v) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
    svg.appendChild(el("line", { x1: pad.left, x2: W - pad.right, y1: y(0), y2: y(0), stroke: "#c6ccc5" }));

    bars.forEach((b, i) => {
      const cx = pad.left + slot * i + slot / 2;
      const top = y(Math.max(b.from, b.to));
      const bottom = y(Math.min(b.from, b.to));
      const fill = b.total ? "#0c3a2c" : b.value >= 0 ? "#1f7a52" : "#c0432f";

      svg.appendChild(el("rect", { x: cx - barW / 2, y: top, width: barW, height: Math.max(2, bottom - top), rx: 4, fill }));

      if (i < bars.length - 1) {
        const next = cx + slot;
        svg.appendChild(el("line", { x1: cx + barW / 2, x2: next - barW / 2, y1: y(b.to), y2: y(b.to), stroke: "#9aa59f", "stroke-dasharray": "3 3" }));
      }

      const label = b.total ? fmt(b.value) : (b.value > 0 ? "+" : "−") + fmt(Math.abs(b.value));
      svg.appendChild(el("text", { x: cx, y: top - 10, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: b.total ? "#0f1a15" : fill }, label));

      const words = b.label.split(" ");
      const lines = [];
      words.forEach((w) => {
        const last = lines[lines.length - 1];
        if (last && (last + " " + w).length <= 14) lines[lines.length - 1] = last + " " + w;
        else lines.push(w);
      });
      lines.slice(0, 3).forEach((line, li) => {
        svg.appendChild(el("text", { x: cx, y: y(0) + 22 + li * 17, "text-anchor": "middle", "font-size": 13.5, "font-weight": b.total ? 700 : 400, fill: "#3b4842" }, line));
      });
    });

    chart.replaceChildren(svg);
  }

  document.querySelectorAll("[data-bridge]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-bridge]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      renderBridge(btn.getAttribute("data-bridge"));
    });
  });
  renderBridge("ebitda");

  let sortKey = "rank";
  let sortDir = 1;

  function verdictClass(v) {
    if (v.startsWith("Standalone")) return "go";
    if (v.startsWith("Too small")) return "no";
    return "";
  }

  function renderScorecard() {
    const tbody = document.querySelector("#scorecard tbody");
    if (!tbody || !data.counties) return;
    const rows = data.counties.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
    tbody.innerHTML = rows
      .map(
        (c) => `<tr class="${c.rank === 1 ? "top" : ""}">
        <td>${c.rank}</td>
        <td><strong>${c.name}</strong><div class="sub">${c.region}</div></td>
        <td><div class="score-cell"><span>${c.score}</span><span class="mini-bar"><span style="width:${c.score}%"></span></span></div></td>
        <td>$${fmt(c.income)}</td>
        <td>${c.own}%</td>
        <td>${c.competition}</td>
        <td><span class="pill ${verdictClass(c.verdict)}">${c.verdict}</span></td>
      </tr>`
      )
      .join("");
  }

  document.querySelectorAll("#scorecard [data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-sort");
      if (sortKey === key) sortDir *= -1;
      else {
        sortKey = key;
        sortDir = ["name", "rank", "competition", "verdict"].includes(key) ? 1 : -1;
      }
      renderScorecard();
    });
  });
  renderScorecard();

  const tornado = document.getElementById("tornado");
  if (tornado && data.tornado) {
    const max = Math.max(...data.tornado.map((d) => d.swing));
    tornado.innerHTML = data.tornado
      .map((d) => {
        const w = Math.round((d.swing / max) * 100);
        return `<div class="tornado-row${d.swing < 30 ? " small" : ""}">
          <div>${d.driver}</div>
          <div class="tornado-bar"><span style="width:${w}%"></span></div>
          <div class="tornado-val">${d.swing}</div>
        </div>`;
      })
      .join("");
  }

  const heat = document.getElementById("heatmap");
  if (heat && data.heatmap) {
    const vals = data.heatmap.values.flat();
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const color = (v) => {
      if (v < 0) return `rgba(192, 67, 47, ${0.18 + (Math.abs(v) / Math.abs(min)) * 0.5})`;
      return `rgba(31, 122, 82, ${0.08 + (v / max) * 0.55})`;
    };
    let html = "<thead><tr><th>Wage ↓ / Util. →</th>" + data.heatmap.utils.map((u) => `<th>${u}</th>`).join("") + "</tr></thead><tbody>";
    data.heatmap.wages.forEach((w, i) => {
      html += `<tr><th>${w}</th>`;
      data.heatmap.values[i].forEach((v, j) => {
        const base = w === "Base" && data.heatmap.utils[j] === "Base";
        html += `<td class="${base ? "base" : ""}" style="background:${color(v)}">${v}</td>`;
      });
      html += "</tr>";
    });
    heat.innerHTML = html + "</tbody>";
  }
})();
