// 02_tx_filter.js - Передающий ФНЧ
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers['tx-filter'] = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const w2 = Math.max(3, Math.floor(800 / dfg));
      SignalData.x_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w2); j <= Math.min(N - 1, i + w2); j++) { sum += SignalData.g_t[j]; count++; }
        SignalData.x_t[i] = sum / count;
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawCurveSVG } = helpers;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" /><line x1="2" y1="0" x2="2" y2="${H}" stroke="#d5ddd8" stroke-width="2" />`;
      svg += `<text x="${W - 25}" y="${yZero - 15}" fill="#62716b" font-family="monospace" font-size="16">t</text><text x="15" y="25" fill="#62716b" font-family="monospace" font-size="16">u(t)</text>`;
      svg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5, 0.3);
      svg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.5);
      svg += `<rect x="${W - 200}" y="15" width="180" height="56" fill="#ffffff" fill-opacity="0.85" rx="6" stroke="#d5ddd8" />`;
      svg += `<line x1="${W - 185}" y1="31" x2="${W - 155}" y2="31" stroke="#287c9f" stroke-width="2.5" stroke-opacity="0.3" /><text x="${W - 145}" y="36" fill="#62716b" font-family="monospace" font-size="13">Оригинал g(t)</text>`;
      svg += `<line x1="${W - 185}" y1="53" x2="${W - 155}" y2="53" stroke="#0c6b4f" stroke-width="2.5" /><text x="${W - 145}" y="58" fill="#62716b" font-family="monospace" font-size="13">Сглаженный x(t)</text>`;
      svg += `</svg>`; return svg;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      let theory = "Реальный сигнал имеет бесконечный спектр. ФНЧ отсекает частоты выше f_cp, подготавливая сигнал к теореме Котельникова.";
      let formulas = `<div class="formula-preview"><span>Частота среза ФНЧ</span>\\[ f_{cp} = \\Delta f_g = ${toLatexNumber(params.signalBandwidth)} \\text{ кГц} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
