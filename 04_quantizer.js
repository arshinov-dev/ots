// 04_quantizer.js - Квантователь АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function getQuantizerParams(params) {
    const calculation = window.SignalData?.calculation || window.SystemCalculations.calculate(params);
    return { ...calculation.source, ...calculation.quantizer };
  }

  function quantizeValue(value, thresholds, levels) {
    let index = thresholds.findIndex((threshold) => value <= threshold);
    if (index === -1) index = levels.length - 1;
    return { index, value: levels[index] };
  }

  window.StageHandlers.quantizer = {
    process: function(params, SignalData) {
      const { dU, thresholds, levels, mu, thresholdCount, levelCount, deltaU1, conditionalStep } = getQuantizerParams(params);
      SignalData.levels = levels;
      SignalData.thresholds = thresholds;
      SignalData.quantization_mu = mu;
      SignalData.quantization_threshold_count = thresholdCount;
      SignalData.quantization_level_count = levelCount;
      SignalData.quantization_delta_u1 = deltaU1;
      SignalData.quantization_conditional_step = conditionalStep;
      SignalData.quantized_indices = [];
      SignalData.quantized_v = SignalData.sampled_x_values.map((val) => {
        const quantized = quantizeValue(val, thresholds, levels);
        SignalData.quantized_indices.push(quantized.index);
        return quantized.value;
      });

      const err = SignalData.sampled_x_values.reduce((acc, value, index) => acc + Math.pow(value - SignalData.quantized_v[index], 2), 0);
      SignalData.quantization_error_sq = SignalData.sampled_x_values.length ? err / SignalData.sampled_x_values.length : 0;
      SignalData.quantization_errors = SignalData.sampled_x_values.map((value, index) => SignalData.quantized_v[index] - value);
      SignalData.level_probabilities_empirical = new Array(levels.length).fill(0);
      SignalData.quantized_indices.forEach((index) => { SignalData.level_probabilities_empirical[index] += 1; });
      SignalData.level_probabilities_empirical = SignalData.level_probabilities_empirical.map((count) => count / Math.max(1, SignalData.quantized_indices.length));
      SignalData.level_probabilities = window.VisualMath.getLevelProbabilitiesAnalytic(params, thresholds, levels);
      SignalData.level_cumulative = SignalData.level_probabilities.reduce((acc, p, index) => {
        acc.push((acc[index - 1] || 0) + p);
        return acc;
      }, []);
      SignalData.quantized_power_analytic = SignalData.level_probabilities.reduce((acc, p, index) => acc + p * Math.pow(levels[index], 2), 0);
      SignalData.quantization_eta = window.VisualMath.getEta(params);
      // === Шум квантования по методичке (формулы 7-10) ===
      // Формула 10: ξ_кв² = P_x(1 - 2γ) + P_y
      // где P_x = P_g (мощность входного сигнала),
      //   P_y = P_v = Σ v_i² p_i (мощность квантованного сигнала),
      //   γ = Δu · Σ W_g(u_i) для i=1..L (формула 9),
      //   W_g(x) — ФПВ гауссовского распределения.
      const Px = parseFloat(params.signalPower) || 1.5;
      const Py = SignalData.quantized_power_analytic;
      const sigmaG = Math.sqrt(Px);
      // γ = ΔU · Σ W_g(u_i), i=1..L (по порогам)
      const wg = (x) => Math.exp(-x * x / (2 * sigmaG * sigmaG)) / (sigmaG * Math.sqrt(2 * Math.PI));
      let gamma = 0;
      for (let i = 0; i < thresholdCount; i++) gamma += wg(thresholds[i]);
      gamma *= dU;
      SignalData.quantization_gamma = gamma;
      SignalData.quantization_Px = Px;
      SignalData.quantization_Py = Py;
      SignalData.quantization_Bxv = gamma * Px;
      // Основной расчёт по методичке (формула 10)
      SignalData.quantization_error_analytic_sq = Px * (1 - 2 * gamma) + Py;
      // Приближённая оценка ΔU²/12 (для сравнения)
      SignalData.quantization_error_approx_sq = Math.pow(dU, 2) / 12;
      SignalData.quantization_step = dU;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, yZero } = helpers;
      const { sigmaG, thresholdCount, levelCount, mu, Dg, dU, thresholds, levels } = getQuantizerParams(params);
      const vm = window.VisualMath;
      const visibleCount = Math.min(16, SignalData.quantized_indices.length);
      const dynamicWindow = vm.chooseDynamicWindow(SignalData.quantized_indices, {
        minLength: Math.min(10, visibleCount),
        length: visibleCount
      });
      const visibleOriginal = SignalData.sampled_x_values.slice(dynamicWindow.start, dynamicWindow.end);
      const visibleQuantized = SignalData.quantized_v.slice(dynamicWindow.start, dynamicWindow.end);
      const visibleIndices = SignalData.quantized_indices.slice(dynamicWindow.start, dynamicWindow.end);
      const xAt = (index) => visibleOriginal.length > 1 ? (index / (visibleOriginal.length - 1)) * W : W / 2;
      const yAt = (value) => H - ((value - SignalData.yMin) / (SignalData.yMax - SignalData.yMin)) * H;

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "k", "u, В", {
        xMin: dynamicWindow.start + 1,
        xMax: dynamicWindow.end,
        yMin: SignalData.yMin,
        yMax: SignalData.yMax
      });
      thresholds.forEach((threshold) => {
        const y = yAt(threshold);
        timeSvg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(98,113,107,0.22)" stroke-width="1" stroke-dasharray="4,8" />`;
      });
      levels.forEach((lvl) => {
        const y = yAt(lvl);
        timeSvg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(12,107,79,0.20)" stroke-width="1.1" />`;
      });
      visibleOriginal.forEach((value, index) => {
        const x = xAt(index);
        const yOrig = yAt(value);
        const yQuant = yAt(visibleQuantized[index]);
        const halfSegment = Math.max(7, W / Math.max(1, visibleOriginal.length) * 0.28);
        timeSvg += `<line x1="${x}" y1="${yZero}" x2="${x}" y2="${yOrig}" stroke="#287c9f" stroke-width="1.6" stroke-opacity="0.65" />
          <circle cx="${x}" cy="${yOrig}" r="3.4" fill="#287c9f" />
          <line x1="${x - halfSegment}" y1="${yQuant}" x2="${x + halfSegment}" y2="${yQuant}" stroke="#0c6b4f" stroke-width="3.4" />
          <circle cx="${x}" cy="${yQuant}" r="3.1" fill="#0c6b4f" />
          <line x1="${x}" y1="${yOrig}" x2="${x}" y2="${yQuant}" stroke="#e74c3c" stroke-width="2" />`;
      });
      const nearestZeroLevel = levels.reduce((best, value, index) => Math.abs(value) < Math.abs(levels[best]) ? index : best, 0);
      const nextLevelIndex = Math.min(levels.length - 1, nearestZeroLevel + 1);
      if (nextLevelIndex !== nearestZeroLevel) {
        const bracketX = W - 70;
        const y1 = yAt(levels[nearestZeroLevel]);
        const y2 = yAt(levels[nextLevelIndex]);
        timeSvg += `<line x1="${bracketX}" y1="${y1}" x2="${bracketX}" y2="${y2}" stroke="#e74c3c" stroke-width="1.6" />
          <line x1="${bracketX - 5}" y1="${y1}" x2="${bracketX + 5}" y2="${y1}" stroke="#e74c3c" stroke-width="1.6" />
          <line x1="${bracketX - 5}" y1="${y2}" x2="${bracketX + 5}" y2="${y2}" stroke="#e74c3c" stroke-width="1.6" />
          <text class="plot-note" x="${bracketX + 8}" y="${(y1 + y2) / 2 + 4}">ΔU</text>`;
      }
      timeSvg += `<text class="plot-note" x="${W - 10}" y="${yAt(3 * sigmaG) - 5}" text-anchor="end">+3σ</text>
        <text class="plot-note" x="${W - 10}" y="${yZero - 5}" text-anchor="end">0</text>
        <text class="plot-note" x="${W - 10}" y="${yAt(-3 * sigmaG) - 5}" text-anchor="end">−3σ</text>`;
      timeSvg += `</svg>`;

      const stairH = 260;
      const xMin = -3.4 * sigmaG, xMax = 3.4 * sigmaG;
      const yMin = -3.4 * sigmaG, yMax = 3.4 * sigmaG;
      const sx = (v) => ((v - xMin) / (xMax - xMin)) * W;
      const sy = (v) => stairH - ((v - yMin) / (yMax - yMin)) * stairH;
      let stairSvg = `<svg viewBox="0 0 ${W} ${stairH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      stairSvg += window.VisualMath.axes(W, stairH, sy(0), "uвх", "vкв");
      thresholds.forEach((threshold) => {
        stairSvg += `<line x1="${sx(threshold)}" y1="18" x2="${sx(threshold)}" y2="${stairH - 18}" stroke="rgba(98,113,107,0.22)" stroke-dasharray="4,7" />`;
      });
      for (let j = 0; j < levels.length; j++) {
        const left = j === 0 ? xMin : thresholds[j - 1];
        const right = j === levels.length - 1 ? xMax : thresholds[j];
        const y = sy(levels[j]);
        stairSvg += `<line x1="${sx(left)}" y1="${y}" x2="${sx(right)}" y2="${y}" stroke="#0c6b4f" stroke-width="3" />`;
        if (j < levels.length - 1) stairSvg += `<line x1="${sx(right)}" y1="${y}" x2="${sx(right)}" y2="${sy(levels[j + 1])}" stroke="#0c6b4f" stroke-width="3" />`;
      }
      stairSvg += `</svg>`;

      const histH = 240;
      const maxP = Math.max(0.05, ...SignalData.level_probabilities);
      const barGap = 5;
      const barW = (W - barGap * (levels.length + 1)) / levels.length;
      let histSvg = `<svg viewBox="0 0 ${W} ${histH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      histSvg += window.VisualMath.axes(W, histH, histH - 22, "j", "p_j");
      const cumulativePoints = [];
      for (let j = 0; j < levels.length; j++) {
        const p = SignalData.level_probabilities[j] || 0;
        const x = barGap + j * (barW + barGap);
        const h = (p / maxP) * (histH - 52);
        const y = histH - 22 - h;
        histSvg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#287c9f" fill-opacity="0.78" />`;
        const F = SignalData.level_cumulative[j] || 0;
        cumulativePoints.push([x + barW / 2, histH - 22 - F * (histH - 52)]);
      }
      histSvg += `<path d="${cumulativePoints.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ")}" stroke="#e74c3c" stroke-width="2.5" fill="none" />
        <text x="${W - 58}" y="28" fill="#e74c3c" font-family="monospace" font-size="14">F_j</text>`;
      histSvg += `<path d="M ${W * 0.15} ${histH - 38} C ${W * 0.34} ${histH * 0.18}, ${W * 0.66} ${histH * 0.18}, ${W * 0.85} ${histH - 38}" stroke="#7554aa" stroke-width="2.2" fill="none" stroke-dasharray="6,6" stroke-opacity="0.75" />`;
      histSvg += `</svg>`;

      const errH = 210;
      const errorBins = new Array(12).fill(0);
      const errorMin = -dU / 2;
      const errorMax = dU / 2;
      (SignalData.quantization_errors || []).forEach((error) => {
        const idx = Math.max(0, Math.min(errorBins.length - 1, Math.floor(((error - errorMin) / (errorMax - errorMin)) * errorBins.length)));
        errorBins[idx] += 1;
      });
      const maxErrCount = Math.max(1, ...errorBins);
      const errBarW = (W - 70) / errorBins.length;
      let errSvg = `<svg viewBox="0 0 ${W} ${errH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      errSvg += window.VisualMath.axes(W, errH, errH - 24, "ξк", "N");
      errorBins.forEach((count, index) => {
        const x = 35 + index * errBarW;
        const h = (count / maxErrCount) * (errH - 60);
        errSvg += `<rect x="${x}" y="${errH - 24 - h}" width="${Math.max(4, errBarW - 5)}" height="${h}" fill="#e74c3c" fill-opacity="0.62" />`;
      });
      errSvg += `<line x1="${W / 2}" y1="18" x2="${W / 2}" y2="${errH - 24}" stroke="#62716b" stroke-width="1.4" stroke-dasharray="4,7" />`;
      errSvg += `</svg>`;

      const levelRows = levels.map((level, index) => {
        const left = index === 0 ? "-∞" : thresholds[index - 1].toFixed(3);
        const right = index === levels.length - 1 ? "+∞" : thresholds[index].toFixed(3);
        const p = SignalData.level_probabilities[index] || 0;
        const F = SignalData.level_cumulative[index] || 0;
        return `<tr><td>${index + 1}</td><td>${left} ... ${right}</td><td>${level.toFixed(3)}</td><td>${p.toFixed(4)}</td><td>${F.toFixed(4)}</td></tr>`;
      }).join("");
      const table = `<div class="quant-table-wrap"><table class="quant-table"><thead><tr><th>\\(j\\)</th><th>интервал \\(x(k\\Delta t)\\)</th><th>\\(v_j\\), В</th><th>\\(p_j\\)</th><th>\\(F_j\\)</th></tr></thead><tbody>${levelRows}</tbody></table></div>`;

      const usedLevelCount = new Set(visibleIndices).size;
      const scaleNote = `<dl class="visual-scale"><div><dt>Фрагмент</dt><dd>${visibleOriginal.length} отсчётов</dd></div><div><dt>Шаг</dt><dd>\\(\\Delta U=${dU.toFixed(3)}\\) В</dd></div><div><dt>Уровни</dt><dd>${usedLevelCount} разных из \\(L=${levelCount}\\)</dd></div></dl>`;
      const histScale = `<dl class="visual-scale"><div><dt>Столбцы</dt><dd>\\(p_j\\)</dd></div><div><dt>Красная линия</dt><dd>\\(F_j\\)</dd></div><div><dt>Пунктир</dt><dd>форма \\(W_g(u)\\)</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отсчёт \\(x(k\\Delta t)\\) → квантованный уровень \\(v_k^j\\)</p>${scaleNote}${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Амплитудная характеристика квантователя</p>${scaleNote}${stairSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Вероятности \\(p_j\\) и интегральное распределение \\(F_j\\)</p>${histScale}${histSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Распределение ошибки квантования \\(\\xi_\\text{к}=v_j-x_k\\)</p>${scaleNote}${errSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Полная таблица интервалов, уровней и вероятностей</p>${table}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const { sigmaG, thresholdCount, levelCount, mu, Dg, dU, deltaU1, conditionalStep } = getQuantizerParams(params);
      const eta = SignalData.quantization_eta || window.VisualMath.getEta(params);
      const eps = SignalData.quantization_error_analytic_sq || 0;
      const epsApprox = SignalData.quantization_error_approx_sq || Math.pow(dU, 2) / 12;
      const Py = SignalData.quantized_power_analytic || 0;
      const gamma = SignalData.quantization_gamma || 0;
      const Px = SignalData.quantization_Px || (parseFloat(params.signalPower) || 1.5);
      const Bxv = SignalData.quantization_Bxv || 0;
      const meta = window.VisualMath.getCorrelationMeta(params);
      let theory = "Квантователь заменяет каждый амплитудный отсчёт ближайшим разрешённым уровнем. Красные отрезки показывают шум квантования, а гистограмма показывает, какие уровни выбираются чаще.";
      let formulas = `<div class="formula-preview"><span>Динамический диапазон</span>\\[ D_g = u_L-u_1=6\\sigma_g = 6 \\cdot ${toLatexNumber(sigmaG.toFixed(3))} = ${toLatexNumber(Dg.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Поправочный коэффициент по виду корреляции</span>\\[ ${meta.etaLatex}, \\quad \\alpha=${toLatexNumber((parseFloat(params.samplingIncrease) || 2).toFixed(2))}, \\quad \\eta\\approx ${toLatexNumber(eta.toFixed(3))} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Допустимый условный шаг</span>\\[ \\Delta u_1=\\sqrt{\\frac{P_g}{2}}=${toLatexNumber(deltaU1.toFixed(3))}\\text{ В},\\quad \\Delta u_{усл}=\\frac{\\Delta u_1}{\\eta}=\\frac{${toLatexNumber(deltaU1.toFixed(3))}}{${toLatexNumber(eta.toFixed(3))}}=${toLatexNumber(conditionalStep.toFixed(3))}\\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Разрядность, пороги и выходные уровни</span>\\[ \\mu=\\left\\lceil\\log_2\\left(\\frac{6\\sigma_g}{\\Delta u_{усл}}+2\\right)\\right\\rceil=${mu} \\]\\[ L=2^\\mu-1=${thresholdCount},\\quad L+1=${levelCount} \\]\\[ \\Delta U = \\frac{6\\sigma_g}{L-1}=\\frac{${toLatexNumber(Dg.toFixed(3))}}{${thresholdCount - 1}}=${toLatexNumber(dU.toFixed(3))}\\text{ В} \\]\\[ u_i=-3\\sigma_g+(i-1)\\Delta U,\\quad v_j=-3\\sigma_g+(j-1{,}5)\\Delta U \\]</div>`;
      formulas += `<div class="formula-preview"><span>Вероятности уровней и интегральное распределение</span>\\[ p_j = \\Phi\\left(\\frac{u_j}{\\sigma_g}\\right)-\\Phi\\left(\\frac{u_{j-1}}{\\sigma_g}\\right),\\quad F_j=\\sum_{i=1}^{j}p_i \\]\\[ P_y=\\sum_{j=1}^{${levelCount}}v_j^2p_j\\approx ${toLatexNumber(Py.toFixed(4))} \\text{ В}^2 \\]</div>`;
      // Основной расчёт шума квантования по методичке (формулы 7-10)
      formulas += `<div class="formula-preview"><span>Шум квантования по методичке (формулы 7–10)</span>\\[ \\varepsilon_{кв}^2=P_x-2B_{xv}+P_v=P_x(1-2\\gamma)+P_y \\]</div>`;
      formulas += `<div class="formula-preview"><span>Коэффициент взаимной корреляции (формулы 8–9)</span>\\[ B_{xv}=\\gamma\\sigma_x^2=\\gamma P_x,\\quad \\gamma=\\Delta U\\sum_{i=1}^{L}W_g(u_i)\\approx ${toLatexNumber(gamma.toFixed(4))} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Подстановка чисел варианта</span>\\[ \\varepsilon_{кв}^2=${toLatexNumber(Px.toFixed(4))}(1-2\\cdot${toLatexNumber(gamma.toFixed(4))})+${toLatexNumber(Py.toFixed(4))}=${toLatexNumber(eps.toFixed(4))}\\text{ В}^2 \\]</div>`;
      formulas += `<div class="formula-preview"><span>Приближённая оценка (для сравнения)</span>\\[ \\varepsilon_{кв,\\text{прибл}}^2\\approx\\frac{\\Delta U^2}{12}=\\frac{${toLatexNumber(dU.toFixed(3))}^2}{12}\\approx ${toLatexNumber(epsApprox.toFixed(4))}\\text{ В}^2 \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Серые пунктирные линии — пороги \\(u_i\\), зеленые горизонтали — выходные уровни \\(v_j\\). Столбцы \\(p_j\\) и линия \\(F_j\\) пересчитываются из гауссовского закона при каждом изменении \\(P_g\\). Основной расчёт \\(\\varepsilon_{кв}^2\\) использует \\(P_x\\), \\(P_y\\) и \\(\\gamma\\) по формулам 7–10 методички.</div>`;
      return { theory, formulas };
    }
  };
})();
