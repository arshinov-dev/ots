// 03_sampler.js - Дискретизатор АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  window.StageHandlers.sampler = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const stepSize = window.VisualMath.getSampleStep(params);
      SignalData.sampled_x_indices = [];
      SignalData.sampled_x_values = [];
      for (let i = 0; i < N; i += stepSize) {
        SignalData.sampled_x_indices.push(i);
        SignalData.sampled_x_values.push(SignalData.x_t[i]);
      }
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawCurveSVG, drawStemsSVG } = helpers;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += window.VisualMath.axes(W, H, yZero, "t", "x(t)");
      svg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.6, 0.22);
      svg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.sampled_x_values, '#0c6b4f');

      SignalData.sampled_x_indices.forEach((idx, i) => {
        const x = getX(idx);
        const y = getY(SignalData.sampled_x_values[i]);
        svg += `<circle cx="${x}" cy="${y}" r="4.5" fill="#0c6b4f" stroke="#ffffff" stroke-width="1.5" />`;
      });

      if (SignalData.sampled_x_indices.length > 2) {
        const x1 = getX(SignalData.sampled_x_indices[1]);
        const x2 = getX(SignalData.sampled_x_indices[2]);
        const y = H - 42;
        svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#e74c3c" stroke-width="2" />
          <path d="M ${x1 + 7} ${y - 5} L ${x1} ${y} L ${x1 + 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />
          <path d="M ${x2 - 7} ${y - 5} L ${x2} ${y} L ${x2 - 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />
          <text x="${(x1 + x2) / 2}" y="${y - 10}" fill="#e74c3c" font-family="monospace" font-size="15" text-anchor="middle">Δt = ${dt.toFixed(4)} мс</text>`;
      }

      svg += `<text x="${W - 18}" y="${H - 18}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="end">fд = ${fd.toFixed(2)} кГц</text>`;
      svg += `</svg>`;
      return `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отсчёты x(kΔt) через интервал Δt</p>${svg}</div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      let theory = "Дискретизатор берёт значения ограниченного по спектру сигнала через равные интервалы. Чем больше α, тем выше частота дискретизации и тем плотнее отсчёты на графике.";
      let formulas = `<div class="formula-preview"><span>Теорема Котельникова</span>\\[ f_д \\ge 2\\Delta f_g, \\quad f_д = 2\\alpha\\Delta f_g \\]</div>`;
      formulas += `<div class="formula-preview"><span>Частота дискретизации</span>\\[ f_д = 2 \\cdot ${toLatexNumber(alpha)} \\cdot ${toLatexNumber(dfg)} = ${toLatexNumber(fd.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Интервал дискретизации</span>\\[ \\Delta t = \\frac{1}{f_д} \\approx ${toLatexNumber(dt.toFixed(4))} \\text{ мс} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
