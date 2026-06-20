// 05_encoder.js - Кодер АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function buildQuantizerParams(params) {
    const calculation = window.SignalData?.calculation || window.SystemCalculations.calculate(params);
    return { ...calculation.source, ...calculation.quantizer };
  }

  function codeForLevelIndex(index, levelCount, mu) {
    const decimal = index + 1;
    return decimal === levelCount ? "0".repeat(mu) : decimal.toString(2).padStart(mu, "0");
  }

  function indexFromCode(word, levelCount) {
    const value = parseInt(word, 2);
    return value === 0 ? levelCount - 1 : Math.max(0, Math.min(levelCount - 1, value - 1));
  }

  function hammingDistance(left, right) {
    let distance = 0;
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if ((left[i] || "0") !== (right[i] || "0")) distance++;
    }
    return distance;
  }

  function buildCodebook(levelCount, mu) {
    const words = [];
    for (let i = 0; i < levelCount; i++) words.push(codeForLevelIndex(i, levelCount, mu));
    return words;
  }

  function buildDistanceMatrix(words) {
    return words.map((left) => words.map((right) => hammingDistance(left, right)));
  }

  function quantizeIndex(value, thresholds, levelCount) {
    const index = thresholds.findIndex((threshold) => value <= threshold);
    return index === -1 ? levelCount - 1 : index;
  }

  window.StageHandlers.encoder = {
    process: function(params, SignalData) {
      const { thresholds, levels, levelCount, mu } = buildQuantizerParams(params);
      const codebook = buildCodebook(levelCount, mu);
      SignalData.digital_b = [];
      SignalData.b_t = [];
      SignalData.code_words = [];
      SignalData.codebook = codebook;
      SignalData.code_distance_matrix = buildDistanceMatrix(codebook);
      SignalData.code_level_indices = [];
      SignalData.code_decimal_numbers = [];
      SignalData.quantized_v.forEach((val) => {
        const closestIdx = Number.isInteger(SignalData.quantized_indices?.[SignalData.code_words.length])
          ? SignalData.quantized_indices[SignalData.code_words.length]
          : quantizeIndex(val, thresholds, levelCount);
        const binStr = codebook[closestIdx];
        SignalData.code_level_indices.push(closestIdx);
        SignalData.code_decimal_numbers.push(closestIdx + 1);
        SignalData.code_words.push(binStr);
        for (const bit of binStr) {
          SignalData.digital_b.push(bit);
          SignalData.b_t.push(bit === '1' ? 1 : -1);
        }
      });
      const probabilities = SignalData.level_probabilities || new Array(levelCount).fill(1 / levelCount);
      let ones = 0;
      let zeros = 0;
      codebook.forEach((word, index) => {
        const p = probabilities[index] || 0;
        ones += [...word].filter((bit) => bit === "1").length * p;
        zeros += [...word].filter((bit) => bit === "0").length * p;
      });
      SignalData.bit_probabilities = {
        one: ones / mu,
        zero: zeros / mu,
      };
      SignalData.indexFromCode = (word) => indexFromCode(word, levelCount);
      SignalData.code_mu = mu;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W } = helpers;
      const calculation = SignalData.calculation || window.SystemCalculations.calculate(params);
      const { mu, tauSim } = calculation.coding;
      const { levelCount } = calculation.quantizer;
      const numBits = SignalData.b_t ? SignalData.b_t.length : 0;
      const dt = calculation.sampling.dt;

      const codeItems = SignalData.code_words.slice(0, 10).map((word, index) => {
        const level = SignalData.quantized_v[index] ?? 0;
        const levelIndex = SignalData.quantized_indices?.[index] ?? 0;
        return `<div class="code-strip__item">
          <span>k=${index + 1}</span>
          <strong>${word}</strong>
          <em>v${levelIndex + 1}=${level.toFixed(2)} В</em>
        </div>`;
      }).join("");
      const codeStrip = `<div class="code-strip">${codeItems}</div>`;

      const codeRows = (SignalData.codebook || buildCodebook(levelCount, mu)).map((word, index) => {
        const level = SignalData.levels?.[index] ?? buildQuantizerParams(params).levels[index];
        const p = SignalData.level_probabilities?.[index] ?? 0;
        return `<tr><td>${index + 1}</td><td>v${index + 1}</td><td>${level.toFixed(3)}</td><td>${word}</td><td>${p.toFixed(4)}</td></tr>`;
      }).join("");
      const codeTable = `<div class="quant-table-wrap"><table class="quant-table code-table"><thead><tr><th>№</th><th>уровень</th><th>В</th><th>код</th><th>p_j</th></tr></thead><tbody>${codeRows}</tbody></table></div>`;

      const matrixRows = (SignalData.code_distance_matrix || []).map((row, i) => {
        return `<tr><th>${i + 1}</th>${row.map((value, j) => `<td class="${i === j ? "is-diagonal" : ""}">${value}</td>`).join("")}</tr>`;
      }).join("");
      const matrixHead = `<tr><th>d</th>${Array.from({ length: levelCount }, (_, i) => `<th>${i + 1}</th>`).join("")}</tr>`;
      const distanceTable = `<div class="distance-table-wrap"><table class="distance-table"><thead>${matrixHead}</thead><tbody>${matrixRows}</tbody></table></div>`;

      const botH = 150;
      const bitStepX = W / Math.max(1, numBits);
      let botSvg = `<svg viewBox="0 0 ${W} ${botH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      botSvg += `<line x1="0" y1="${botH * 0.5}" x2="${W}" y2="${botH * 0.5}" stroke="#d5ddd8" stroke-width="2" />`;
      let meanderD = "";
      for (let i = 0; i < numBits; i++) {
        const x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
        const y = SignalData.b_t[i] > 0 ? botH * 0.22 : botH * 0.72;
        if (i === 0) meanderD += `M ${x1} ${y} `;
        else {
          const prevY = SignalData.b_t[i - 1] > 0 ? botH * 0.22 : botH * 0.72;
          if (prevY !== y) meanderD += `L ${x1} ${prevY} L ${x1} ${y} `;
        }
        meanderD += `L ${x2} ${y} `;
      }
      botSvg += `<path d="${meanderD}" stroke="#0c6b4f" stroke-width="2.8" fill="none" stroke-linejoin="miter" />`;

      if (numBits >= mu) {
        const sampleWidth = bitStepX * mu;
        botSvg += `<line x1="0" y1="${botH - 28}" x2="${sampleWidth}" y2="${botH - 28}" stroke="#e74c3c" stroke-width="2" />
          <path d="M 7 ${botH - 33} L 0 ${botH - 28} L 7 ${botH - 23}" fill="none" stroke="#e74c3c" stroke-width="2" />
          <path d="M ${sampleWidth - 7} ${botH - 33} L ${sampleWidth} ${botH - 28} L ${sampleWidth - 7} ${botH - 23}" fill="none" stroke="#e74c3c" stroke-width="2" />`;
        for (let i = 1; i < mu; i++) {
          const x = i * bitStepX;
          botSvg += `<line x1="${x}" y1="10" x2="${x}" y2="${botH - 16}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />`;
        }
      }
      botSvg += `</svg>`;

      const zoom = window.VisualMath.getZoomWindow(SignalData, 5);
      const zoomH = 150;
      const zoomBitW = W / Math.max(1, zoom.length);
      let zoomSvg = `<svg viewBox="0 0 ${W} ${zoomH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      zoomSvg += `<rect x="0" y="0" width="${W}" height="${zoomH}" fill="rgba(40,124,159,0.04)" />`;
      zoomSvg += `<line x1="0" y1="${zoomH * 0.5}" x2="${W}" y2="${zoomH * 0.5}" stroke="#d5ddd8" stroke-width="2" />`;
      let zoomD = "";
      for (let i = 0; i < zoom.length; i++) {
        const bit = zoom.bits[i];
        const x1 = i * zoomBitW, x2 = (i + 1) * zoomBitW;
        const y = bit > 0 ? zoomH * 0.22 : zoomH * 0.74;
        if (i === 0) zoomD += `M ${x1} ${y} `;
        else {
          const prevY = zoom.bits[i - 1] > 0 ? zoomH * 0.22 : zoomH * 0.74;
          if (prevY !== y) zoomD += `L ${x1} ${prevY} L ${x1} ${y} `;
        }
        zoomD += `L ${x2} ${y} `;
        zoomSvg += `<line x1="${x1}" y1="0" x2="${x1}" y2="${zoomH}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />`;
      }
      zoomSvg += `<line x1="${W}" y1="0" x2="${W}" y2="${zoomH}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />`;
      zoomSvg += `<path d="${zoomD}" stroke="#0c6b4f" stroke-width="3.2" fill="none" stroke-linejoin="miter" />`;
      zoomSvg += `</svg>`;

      const specH = 260;
      const xUnitMax = Math.max(10, 2 * mu + 2);
      const xSpec = (unit) => (unit / xUnitMax) * W;
      const ySpec = (value) => specH - 24 - value * (specH - 54);
      const sinc = (unit) => {
        const x = Math.PI * unit / mu;
        return Math.abs(x) < 1e-6 ? 1 : Math.abs(Math.sin(x) / x);
      };
      const envelope = window.VisualMath.makeSamples(0, xUnitMax, 360, (unit) => sinc(unit));
      let specSvg = `<svg viewBox="0 0 ${W} ${specH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      specSvg += window.VisualMath.axes(W, specH, specH - 24, "f", "|Sп(f)|/U0");
      specSvg += window.VisualMath.drawXYCurve(envelope, W, specH, 0, xUnitMax, 0, 1.08, "#7554aa", 2.4, 0.82);
      for (let unit = 1; unit <= xUnitMax; unit++) {
        const amp = sinc(unit) * (0.86 + 0.1 * Math.cos(unit * Math.PI / 2));
        const x = xSpec(unit);
        specSvg += `<line x1="${x}" y1="${specH - 24}" x2="${x}" y2="${ySpec(amp)}" stroke="#1f2b26" stroke-width="${unit % 4 === 0 ? 2.6 : 1.8}" />
          <circle cx="${x}" cy="${ySpec(amp)}" r="2.6" fill="#1f2b26" />`;
      }
      [...new Set([1, 2, 3, mu, 2 * mu])].filter((unit) => unit <= xUnitMax).forEach((unit) => {
        const label = unit === mu ? "1/τсим" : unit === 2 * mu ? "2/τсим" : `${unit}/Δt`;
        specSvg += `<line x1="${xSpec(unit)}" y1="${specH - 24}" x2="${xSpec(unit)}" y2="${specH - 12}" stroke="#1f2b26" stroke-width="1.3" />
          <text x="${xSpec(unit)}" y="${specH - 4}" fill="#31433b" font-family="monospace" font-size="12" text-anchor="middle">${label}</text>`;
      });
      specSvg += `<line x1="${xSpec(mu)}" y1="20" x2="${xSpec(mu)}" y2="${specH - 24}" stroke="#e74c3c" stroke-width="1.8" stroke-dasharray="6,6" />`;
      specSvg += `</svg>`;
      const p0 = SignalData.bit_probabilities?.zero ?? 0.5;
      const p1 = SignalData.bit_probabilities?.one ?? 0.5;
      const probH = 170;
      const barW = W * 0.24;
      const p0H = p0 * (probH - 46);
      const p1H = p1 * (probH - 46);
      let probSvg = `<svg viewBox="0 0 ${W} ${probH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      probSvg += window.VisualMath.axes(W, probH, probH - 24, "b", "p");
      probSvg += `<rect x="${W * 0.22}" y="${probH - 24 - p0H}" width="${barW}" height="${p0H}" fill="#287c9f" fill-opacity="0.75" />
        <rect x="${W * 0.56}" y="${probH - 24 - p1H}" width="${barW}" height="${p1H}" fill="#0c6b4f" fill-opacity="0.75" />
        <text x="${W * 0.22 + barW / 2}" y="${probH - 8}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="middle">0</text>
        <text x="${W * 0.56 + barW / 2}" y="${probH - 8}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="middle">1</text>
        <line x1="${W * 0.16}" y1="${probH - 24 - 0.5 * (probH - 46)}" x2="${W * 0.86}" y2="${probH - 24 - 0.5 * (probH - 46)}" stroke="#e74c3c" stroke-width="1.6" stroke-dasharray="6,6" />`;
      probSvg += `</svg>`;
      const timingScale = `<dl class="visual-scale"><div><dt>Отсчёт</dt><dd>Δt=${dt.toFixed(4)} мс</dd></div><div><dt>Символ</dt><dd>τсим=${tauSim.toFixed(4)} мс</dd></div><div><dt>Код</dt><dd>${mu} бит на один уровень</dd></div></dl>`;
      const zoomScale = `<dl class="visual-scale"><div><dt>Окно</dt><dd>биты ${zoom.start + 1}-${zoom.end}</dd></div><div><dt>Назначение</dt><dd>это же окно используется в блоках 06-08</dd></div></dl>`;
      const spectrumScale = `<dl class="visual-scale"><div><dt>Огибающая</dt><dd>sin x / x</dd></div><div><dt>Первый ноль</dt><dd>1/τсим=${(1 / tauSim).toFixed(2)} кГц</dd></div><div><dt>Расчетная полоса</dt><dd>Δfц=${(2 / tauSim).toFixed(2)} кГц</dd></div></dl>`;
      const probScale = `<dl class="visual-scale"><div><dt>p(0)</dt><dd>${p0.toFixed(4)}</dd></div><div><dt>p(1)</dt><dd>${p1.toFixed(4)}</dd></div><div><dt>Ожидание</dt><dd>для симметричного гауссовского входа близко к 0.5</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Маппинг квантованных уровней в ${mu}-битные коды</p>${codeStrip}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Полная таблица безызбыточного блочного кода</p>${codeTable}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Матрица кодовых расстояний d_lm</p>${distanceTable}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Априорные вероятности битов p(0) и p(1)</p>${probScale}${probSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Цифровой меандр b(t): ${mu} символов τсим на один Δt</p>${timingScale}${botSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Синхронная лупа: этот же фрагмент используют блоки 06–08</p>${zoomScale}${zoomSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Амплитудный спектр прямоугольного цифрового сигнала</p>${spectrumScale}${specSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const calculation = SignalData.calculation || window.SystemCalculations.calculate(params);
      const { dt } = calculation.sampling;
      const { mu, tauSim, k1, dfPcm: digitalBandwidth } = calculation.coding;
      const { thresholdCount, levelCount } = calculation.quantizer;
      const probabilities = SignalData.level_probabilities || [];
      const entropy = probabilities.reduce((acc, p) => p > 0 ? acc - p * Math.log2(p) : acc, 0);
      const productivity = entropy / dt;
      const redundancy = Math.max(0, 1 - entropy / mu);
      const p0 = SignalData.bit_probabilities?.zero ?? 0.5;
      const p1 = SignalData.bit_probabilities?.one ?? 0.5;
      let theory = `Кодер превращает номер уровня в безызбыточную ${mu}-битную комбинацию. Один отсчёт Δt распадается на ${mu} прямоугольных символов, поэтому изменение разрядности меняет битовую скорость и спектр.`;
      let formulas = `<div class="formula-preview"><span>Разрядность кодера</span>\\[ L+1=${levelCount}=2^{${mu}} \\implies \\mu=\\log_2(L+1)=${mu}\\text{ бит},\\quad L=${thresholdCount} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Длительность символа</span>\\[ \\tau_{сим} = \\frac{\\Delta t}{\\mu} = \\frac{${toLatexNumber(dt.toFixed(4))}}{${mu}} \\approx ${toLatexNumber(tauSim.toFixed(4))} \\text{ мс} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Оценка ширины спектра цифрового сигнала</span>\\[ \\Delta f_ц = \\frac{k_1}{\\tau_{сим}},\\quad k_1=${k1},\\quad \\Delta f_ц \\approx ${toLatexNumber(digitalBandwidth.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Энтропия квантованных сообщений</span>\\[ H_y=-\\sum_{j=1}^{${levelCount}}p_j\\log_2p_j\\approx ${toLatexNumber(entropy.toFixed(3))}\\text{ бит/отсчёт} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Кодовые расстояния</span>\\[ d_{lm}=\\sum_{r=1}^{\\mu} b_l^r\\oplus_2 b_m^r \\]</div>`;
      formulas += `<div class="formula-preview"><span>Априорные вероятности битов</span>\\[ p(0)=\\frac{1}{\\mu}\\sum_{j=1}^{${levelCount}}n_j(0)p_j\\approx ${toLatexNumber(p0.toFixed(4))},\\quad p(1)=\\frac{1}{\\mu}\\sum_{j=1}^{${levelCount}}n_j(1)p_j\\approx ${toLatexNumber(p1.toFixed(4))} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Производительность и избыточность</span>\\[ R_y=\\frac{H_y}{\\Delta t}\\approx ${toLatexNumber(productivity.toFixed(2))}\\text{ кбит/с}, \\quad \\zeta=1-\\frac{H_y}{\\mu}\\approx ${toLatexNumber(redundancy.toFixed(3))} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Синхронная лупа:</strong><br>Нижний фрагмент показывает несколько соседних битов с теми же границами, которые используются в блоках 06–08. Поэтому радиоволна, шум, смесь и стробы детектора дальше сравниваются в одном и том же временном окне.</div>`;
      return { theory, formulas };
    }
  };
})();
