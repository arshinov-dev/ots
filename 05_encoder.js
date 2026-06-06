// 05_encoder.js - Кодер АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.encoder = {
    process: function(params, SignalData) {
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const L = 16;
      const Dg = 6 * sigmaG;
      const dU = Dg / (L - 1);
      const levels = [];
      for (let j = 0; j < L; j++) { levels.push(-3 * sigmaG + j * dU); }
      SignalData.digital_b = [];
      SignalData.b_t = [];
      SignalData.quantized_v.forEach(val => {
        let closestIdx = 0, minDiff = Infinity;
        for (let j = 0; j < levels.length; j++) {
          let diff = Math.abs(levels[j] - val);
          if (diff < minDiff) { minDiff = diff; closestIdx = j; }
        }
        let binStr = closestIdx.toString(2).padStart(4, '0');
        for (let bit of binStr) {
          SignalData.digital_b.push(bit);
          SignalData.b_t.push(bit === '1' ? 1 : -1);
        }
      });
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getLocalY, yZero } = helpers;
      const numBits = SignalData.b_t ? SignalData.b_t.length : 0;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      const bitStepX = (stepSize / (SignalData.N - 1)) * W / 4;

      let topH = 180, topY0 = getLocalY(0, topH);
      let topSVG = `<svg viewBox="0 0 ${W} ${topH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      topSVG += `<line x1="0" y1="${topY0}" x2="${W}" y2="${topY0}" stroke="#d5ddd8" stroke-width="2" />`;
      let stemPaths = "";
      for (let i = 0; i < SignalData.sampled_x_indices.length; i++) {
        let idx = SignalData.sampled_x_indices[i];
        let x = getX(idx);
        let val = SignalData.quantized_v[i];
        let y = getLocalY(val, topH);
        stemPaths += `M ${x} ${topY0} L ${x} ${y} `;
        let binStr = SignalData.digital_b.slice(i * 4, i * 4 + 4).join('');
        topSVG += `<text x="${x}" y="${val > 0 ? y - 10 : y + 20}" fill="#0c6b4f" fill-opacity="0.9" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${binStr}</text>`;
      }
      topSVG += `<path d="${stemPaths}" stroke="#0c6b4f" stroke-width="2" fill="none" stroke-opacity="0.3" />`;
      topSVG += `</svg>`;

      let botH = 120;
      let botSVG = `<svg viewBox="0 0 ${W} ${botH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      let meanderD = "";
      for (let i = 0; i < numBits; i++) {
        let x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
        let y = SignalData.b_t[i] > 0 ? botH * 0.2 : botH * 0.8;
        if (i === 0) meanderD += `M ${x1} ${y} `;
        else {
          let prevY = SignalData.b_t[i - 1] > 0 ? botH * 0.2 : botH * 0.8;
          if (prevY !== y) meanderD += `L ${x1} ${prevY} L ${x1} ${y} `;
        }
        meanderD += `L ${x2} ${y} `;
      }
      botSVG += `<path d="${meanderD}" stroke="#0c6b4f" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
      botSVG += `</svg>`;
      return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Уровни и их двоичные коды</p>${topSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Цифровой меандр b(t)</p>${botSVG}</div></div>`;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      const tau_sim = dt / 4;
      let theory = "Номера уровней квантования переводятся в двоичную систему счисления с разрядностью μ=4 бита. На месте одного отсчёта возникает «пачка» из μ прямоугольных импульсов.";
      let formulas = `<div class="formula-preview"><span>Разрядность кодера</span>\\[ L = 16 \\implies \\mu = \\log_2(L) = 4 \\text{ бит} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Длительность символа</span>\\[ \\tau_{сим} = \\frac{\\Delta t}{\\mu} \\approx ${toLatexNumber((dt / 4).toFixed(4))} \\text{ мс} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
