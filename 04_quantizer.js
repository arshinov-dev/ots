// 04_quantizer.js - Квантователь АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.quantizer = {
    process: function(params, SignalData) {
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const L = 16;
      const Dg = 6 * sigmaG;
      const dU = Dg / (L - 1);
      SignalData.levels = [];
      for (let j = 0; j < L; j++) { SignalData.levels.push(-3 * sigmaG + j * dU); }
      SignalData.quantized_v = SignalData.sampled_x_values.map(val => {
        return SignalData.levels.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
      });
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawStemsSVG } = helpers;
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" /><line x1="2" y1="0" x2="2" y2="${H}" stroke="#d5ddd8" stroke-width="2" />`;
      svg += `<text x="${W - 25}" y="${yZero - 15}" fill="#62716b" font-family="monospace" font-size="16">t</text><text x="15" y="25" fill="#62716b" font-family="monospace" font-size="16">u(t)</text>`;
      const currentSigmaG = sigmaG;
      SignalData.levels.forEach(lvl => {
        let y = getY(lvl);
        let isBorder = Math.abs(lvl) >= 2.99 * currentSigmaG;
        let color = isBorder ? 'rgba(231, 76, 60, 0.4)' : 'rgba(213, 221, 216, 0.8)';
        svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="${isBorder ? '8,8' : '4,8'}" />`;
      });
      svg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.sampled_x_values, '#0c6b4f', 0.15);
      let errorPaths = "";
      for (let i = 0; i < SignalData.sampled_x_indices.length; i++) {
        let x = getX(SignalData.sampled_x_indices[i]);
        let yOrig = getY(SignalData.sampled_x_values[i]);
        let yQuant = getY(SignalData.quantized_v[i]);
        errorPaths += `M ${x} ${yOrig} L ${x} ${yQuant} `;
      }
      svg += `<path d="${errorPaths}" stroke="#e74c3c" stroke-width="3" fill="none" />`;
      svg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.quantized_v, '#0c6b4f');
      svg += `</svg>`; return svg;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const Dg = 6 * sigmaG;
      const dU = Dg / 15;
      let theory = "Отсчёты дискретны по времени, но непрерывны по амплитуде. АЦП имеет L=16 уровней. Каждый отсчёт округляется до ближайшего уровня.";
      let formulas = `<div class="formula-preview"><span>Динамический диапазон</span>\\[ D_g = 6\\sigma_g = 6 \\cdot ${toLatexNumber(sigmaG.toFixed(2))} = ${toLatexNumber(Dg.toFixed(2))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Шаг квантования</span>\\[ \\Delta U = \\frac{D_g}{L-1} = \\frac{${toLatexNumber(Dg.toFixed(2))}}{15} \\approx ${toLatexNumber(dU.toFixed(2))} \\text{ В} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
