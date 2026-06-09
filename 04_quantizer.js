// 04_quantizer.js - Квантователь АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function getQuantizerParams(params) {
    const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
    const L = 16;
    const Dg = 6 * sigmaG;
    const dU = Dg / (L - 1);
    const levels = [];
    for (let j = 0; j < L; j++) levels.push(-3 * sigmaG + j * dU);
    return { sigmaG, L, Dg, dU, levels };
  }

  window.StageHandlers.quantizer = {
    process: function(params, SignalData) {
      const { L, dU, levels } = getQuantizerParams(params);
      SignalData.levels = levels;
      SignalData.quantized_indices = [];
      SignalData.quantized_v = SignalData.sampled_x_values.map((val) => {
        let closestIdx = 0, minDiff = Infinity;
        for (let j = 0; j < levels.length; j++) {
          const diff = Math.abs(levels[j] - val);
          if (diff < minDiff) { minDiff = diff; closestIdx = j; }
        }
        SignalData.quantized_indices.push(closestIdx);
        return levels[closestIdx];
      });

      const err = SignalData.sampled_x_values.reduce((acc, value, index) => acc + Math.pow(value - SignalData.quantized_v[index], 2), 0);
      SignalData.quantization_error_sq = SignalData.sampled_x_values.length ? err / SignalData.sampled_x_values.length : 0;
      SignalData.level_probabilities_empirical = new Array(L).fill(0);
      SignalData.quantized_indices.forEach((index) => { SignalData.level_probabilities_empirical[index] += 1; });
      SignalData.level_probabilities_empirical = SignalData.level_probabilities_empirical.map((count) => count / Math.max(1, SignalData.quantized_indices.length));
      SignalData.level_probabilities = window.VisualMath.getLevelProbabilitiesAnalytic(params, levels, dU);
      SignalData.quantized_power_analytic = SignalData.level_probabilities.reduce((acc, p, index) => acc + p * Math.pow(levels[index], 2), 0);
      SignalData.quantization_eta = window.VisualMath.getEta(params);
      SignalData.quantization_error_analytic_sq = Math.pow(dU, 2) / 12;
      SignalData.quantization_step = dU;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawStemsSVG } = helpers;
      const { sigmaG, L, Dg, dU, levels } = getQuantizerParams(params);

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += window.VisualMath.axes(W, H, yZero, "t", "u");
      levels.forEach((lvl) => {
        const y = getY(lvl);
        const isBorder = Math.abs(lvl) >= 2.99 * sigmaG;
        const color = isBorder ? 'rgba(231, 76, 60, 0.45)' : 'rgba(213, 221, 216, 0.9)';
        timeSvg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="1.4" stroke-dasharray="${isBorder ? '8,8' : '4,8'}" />`;
      });
      timeSvg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.sampled_x_values, '#0c6b4f', 0.14);
      for (let i = 0; i < SignalData.sampled_x_indices.length; i++) {
        const x = getX(SignalData.sampled_x_indices[i]);
        const yOrig = getY(SignalData.sampled_x_values[i]);
        const yQuant = getY(SignalData.quantized_v[i]);
        const yTop = Math.min(yOrig, yQuant);
        const h = Math.max(2, Math.abs(yOrig - yQuant));
        timeSvg += `<rect x="${x - 3}" y="${yTop}" width="6" height="${h}" fill="rgba(231, 76, 60, 0.32)" />
          <line x1="${x}" y1="${yOrig}" x2="${x}" y2="${yQuant}" stroke="#e74c3c" stroke-width="2.2" />
          <path d="M ${x - 4} ${yQuant + (yOrig > yQuant ? 6 : -6)} L ${x} ${yQuant} L ${x + 4} ${yQuant + (yOrig > yQuant ? 6 : -6)}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />`;
      }
      timeSvg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.quantized_v, '#0c6b4f');
      timeSvg += `</svg>`;

      const stairH = 260;
      const xMin = -3.4 * sigmaG, xMax = 3.4 * sigmaG;
      const yMin = -3.4 * sigmaG, yMax = 3.4 * sigmaG;
      const sx = (v) => ((v - xMin) / (xMax - xMin)) * W;
      const sy = (v) => stairH - ((v - yMin) / (yMax - yMin)) * stairH;
      let stairSvg = `<svg viewBox="0 0 ${W} ${stairH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      stairSvg += window.VisualMath.axes(W, stairH, sy(0), "uвх", "vкв");
      for (let j = 0; j < L; j++) {
        const left = j === 0 ? xMin : (levels[j - 1] + levels[j]) / 2;
        const right = j === L - 1 ? xMax : (levels[j] + levels[j + 1]) / 2;
        const y = sy(levels[j]);
        stairSvg += `<line x1="${sx(left)}" y1="${y}" x2="${sx(right)}" y2="${y}" stroke="#0c6b4f" stroke-width="3" />`;
        if (j < L - 1) stairSvg += `<line x1="${sx(right)}" y1="${y}" x2="${sx(right)}" y2="${sy(levels[j + 1])}" stroke="#0c6b4f" stroke-width="3" />`;
        if (j > 0) stairSvg += `<line x1="${sx(left)}" y1="18" x2="${sx(left)}" y2="${stairH - 18}" stroke="rgba(98,113,107,0.22)" stroke-dasharray="4,7" />`;
      }
      stairSvg += `<text x="${W - 18}" y="26" fill="#62716b" font-family="monospace" font-size="14" text-anchor="end">ΔU = ${dU.toFixed(3)} В</text>`;
      stairSvg += `</svg>`;

      const histH = 240;
      const maxP = Math.max(0.05, ...SignalData.level_probabilities);
      const barGap = 5;
      const barW = (W - barGap * (L + 1)) / L;
      let histSvg = `<svg viewBox="0 0 ${W} ${histH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      histSvg += window.VisualMath.axes(W, histH, histH - 22, "j", "p_j");
      for (let j = 0; j < L; j++) {
        const p = SignalData.level_probabilities[j] || 0;
        const x = barGap + j * (barW + barGap);
        const h = (p / maxP) * (histH - 52);
        const y = histH - 22 - h;
        histSvg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#287c9f" fill-opacity="0.78" />
          <text x="${x + barW / 2}" y="${histH - 6}" fill="#62716b" font-family="monospace" font-size="11" text-anchor="middle">${j}</text>`;
      }
      histSvg += `<path d="M ${W * 0.15} ${histH - 38} C ${W * 0.34} ${histH * 0.18}, ${W * 0.66} ${histH * 0.18}, ${W * 0.85} ${histH - 38}" stroke="#7554aa" stroke-width="2.2" fill="none" stroke-dasharray="6,6" stroke-opacity="0.75" />
        <text x="${W / 2}" y="24" fill="#7554aa" font-family="monospace" font-size="14" text-anchor="middle">гауссовская форма распределения уровней</text>`;
      histSvg += `</svg>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Процесс квантования и шум ξк</p>${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Амплитудная характеристика квантователя</p>${stairSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Гистограмма вероятностей уровней p_j</p>${histSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const { sigmaG, Dg, dU } = getQuantizerParams(params);
      const eta = SignalData.quantization_eta || window.VisualMath.getEta(params);
      const eps = SignalData.quantization_error_analytic_sq || Math.pow(dU, 2) / 12;
      const Py = SignalData.quantized_power_analytic || 0;
      const meta = window.VisualMath.getCorrelationMeta(params);
      let theory = "Квантователь заменяет каждый амплитудный отсчёт ближайшим разрешённым уровнем. Красные отрезки показывают шум квантования, а гистограмма показывает, какие уровни выбираются чаще.";
      let formulas = `<div class="formula-preview"><span>Динамический диапазон</span>\\[ D_g = 6\\sigma_g = 6 \\cdot ${toLatexNumber(sigmaG.toFixed(3))} = ${toLatexNumber(Dg.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Шаг квантования</span>\\[ \\Delta U = \\frac{D_g}{L-1} = \\frac{${toLatexNumber(Dg.toFixed(3))}}{15} \\approx ${toLatexNumber(dU.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Поправочный коэффициент по виду корреляции</span>\\[ ${meta.etaLatex}, \\quad \\alpha=${toLatexNumber((parseFloat(params.samplingIncrease) || 2).toFixed(2))}, \\quad \\eta\\approx ${toLatexNumber(eta.toFixed(3))} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Вероятности уровней через функцию Лапласа</span>\\[ p_j = \\Phi\\left(\\frac{u_{j+1}-m_x}{\\sigma_g}\\right)-\\Phi\\left(\\frac{u_j-m_x}{\\sigma_g}\\right), \\quad P_y=\\sum_{j=0}^{15}v_j^2p_j\\approx ${toLatexNumber(Py.toFixed(4))} \\text{ В}^2 \\]</div>`;
      formulas += `<div class="formula-preview"><span>Аналитическая мощность шума квантования</span>\\[ \\varepsilon_{кв}^2 \\approx \\frac{\\Delta U^2}{12} = \\frac{${toLatexNumber(dU.toFixed(3))}^2}{12} \\approx ${toLatexNumber(eps.toFixed(4))} \\text{ В}^2 \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Столбцы гистограммы рассчитаны из гауссовского закона по \\(p_j\\), поэтому они остаются колоколообразными и меняют масштаб при изменении \\(P_g\\), а не зависят от случайного числа отсчётов в текущем запуске.</div>`;
      return { theory, formulas };
    }
  };
})();
