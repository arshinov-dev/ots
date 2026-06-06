// 03_sampler.js - Дискретизатор АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.sampler = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      SignalData.sampled_x_indices = [];
      SignalData.sampled_x_values = [];
      for (let i = 0; i < N; i += stepSize) {
        SignalData.sampled_x_indices.push(i);
        SignalData.sampled_x_values.push(SignalData.x_t[i]);
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawCurveSVG, drawStemsSVG } = helpers;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" /><line x1="2" y1="0" x2="2" y2="${H}" stroke="#d5ddd8" stroke-width="2" />`;
      svg += `<text x="${W - 25}" y="${yZero - 15}" fill="#62716b" font-family="monospace" font-size="16">t</text><text x="15" y="25" fill="#62716b" font-family="monospace" font-size="16">u(t)</text>`;
      svg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.5, 0.2);
      svg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.sampled_x_values, '#0c6b4f');
      svg += `</svg>`; return svg;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      let theory = "Теорема Котельникова: сигнал с ограниченным спектром заменяется последовательностью отсчётов через равные промежутки времени Δt.";
      let formulas = `<div class="formula-preview"><span>Частота дискретизации</span>\\[ f_д = 2 \\alpha \\Delta f_g = 2 \\cdot ${toLatexNumber(params.samplingIncrease)} \\cdot ${toLatexNumber(params.signalBandwidth)} = ${toLatexNumber(fd.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Интервал дискретизации</span>\\[ \\Delta t = 1 / f_д \\approx ${toLatexNumber(dt.toFixed(4))} \\text{ мс} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
