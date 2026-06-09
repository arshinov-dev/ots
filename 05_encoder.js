// 05_encoder.js - Кодер АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function buildLevels(params) {
    const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
    const L = 16;
    const Dg = 6 * sigmaG;
    const dU = Dg / (L - 1);
    const levels = [];
    for (let j = 0; j < L; j++) levels.push(-3 * sigmaG + j * dU);
    return levels;
  }

  window.StageHandlers.encoder = {
    process: function(params, SignalData) {
      const levels = buildLevels(params);
      SignalData.digital_b = [];
      SignalData.b_t = [];
      SignalData.code_words = [];
      SignalData.quantized_v.forEach((val) => {
        let closestIdx = 0, minDiff = Infinity;
        for (let j = 0; j < levels.length; j++) {
          const diff = Math.abs(levels[j] - val);
          if (diff < minDiff) { minDiff = diff; closestIdx = j; }
        }
        const binStr = closestIdx.toString(2).padStart(4, '0');
        SignalData.code_words.push(binStr);
        for (const bit of binStr) {
          SignalData.digital_b.push(bit);
          SignalData.b_t.push(bit === '1' ? 1 : -1);
        }
      });
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, getX, getLocalY } = helpers;
      const numBits = SignalData.b_t ? SignalData.b_t.length : 0;
      const stepSize = window.VisualMath.getSampleStep(params);
      const fd = 2 * (parseFloat(params.samplingIncrease) || 2) * (parseFloat(params.signalBandwidth) || 28);
      const dt = 1 / fd;
      const tauSim = dt / 4;

      const topH = 210;
      const topY0 = getLocalY(0, topH);
      let topSvg = `<svg viewBox="0 0 ${W} ${topH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      topSvg += `<line x1="0" y1="${topY0}" x2="${W}" y2="${topY0}" stroke="#d5ddd8" stroke-width="2" />`;
      let stemPaths = "";
      for (let i = 0; i < SignalData.sampled_x_indices.length; i++) {
        const idx = SignalData.sampled_x_indices[i];
        const x = getX(idx);
        const val = SignalData.quantized_v[i];
        const y = getLocalY(val, topH);
        stemPaths += `M ${x} ${topY0} L ${x} ${y} `;
        const binStr = SignalData.code_words?.[i] || SignalData.digital_b.slice(i * 4, i * 4 + 4).join('');
        topSvg += `<circle cx="${x}" cy="${y}" r="4" fill="#0c6b4f" />
          <text x="${x}" y="${val > 0 ? y - 11 : y + 22}" fill="#0c6b4f" fill-opacity="0.95" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">${binStr}</text>`;
      }
      topSvg += `<path d="${stemPaths}" stroke="#0c6b4f" stroke-width="2" fill="none" stroke-opacity="0.35" />`;
      topSvg += `</svg>`;

      const botH = 150;
      const bitStepX = W / Math.max(1, numBits);
      let botSvg = `<svg viewBox="0 0 ${W} ${botH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
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

      if (numBits >= 4) {
        const sampleWidth = bitStepX * 4;
        botSvg += `<line x1="0" y1="${botH - 28}" x2="${sampleWidth}" y2="${botH - 28}" stroke="#e74c3c" stroke-width="2" />
          <path d="M 7 ${botH - 33} L 0 ${botH - 28} L 7 ${botH - 23}" fill="none" stroke="#e74c3c" stroke-width="2" />
          <path d="M ${sampleWidth - 7} ${botH - 33} L ${sampleWidth} ${botH - 28} L ${sampleWidth - 7} ${botH - 23}" fill="none" stroke="#e74c3c" stroke-width="2" />
          <text x="${sampleWidth / 2}" y="${botH - 36}" fill="#e74c3c" font-family="monospace" font-size="14" text-anchor="middle">Δt</text>`;
        for (let i = 1; i < 4; i++) {
          const x = i * bitStepX;
          botSvg += `<line x1="${x}" y1="10" x2="${x}" y2="${botH - 16}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />`;
        }
        botSvg += `<text x="${bitStepX / 2}" y="20" fill="#62716b" font-family="monospace" font-size="13" text-anchor="middle">τсим = ${tauSim.toFixed(4)} мс</text>`;
      }
      botSvg += `</svg>`;

      const zoom = window.VisualMath.getZoomWindow(SignalData, 5);
      const zoomH = 150;
      const zoomBitW = W / Math.max(1, zoom.length);
      let zoomSvg = `<svg viewBox="0 0 ${W} ${zoomH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
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
        zoomSvg += `<line x1="${x1}" y1="0" x2="${x1}" y2="${zoomH}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />
          <text x="${x1 + zoomBitW / 2}" y="${zoomH - 12}" fill="#62716b" font-family="monospace" font-size="13" text-anchor="middle">b${zoom.start + i + 1}</text>`;
      }
      zoomSvg += `<line x1="${W}" y1="0" x2="${W}" y2="${zoomH}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="4,7" />`;
      zoomSvg += `<path d="${zoomD}" stroke="#0c6b4f" stroke-width="3.2" fill="none" stroke-linejoin="miter" />`;
      zoomSvg += `<text x="${W - 18}" y="24" fill="#287c9f" font-family="monospace" font-size="14" text-anchor="end">окно ${zoom.start + 1}–${zoom.end}</text>`;
      zoomSvg += `</svg>`;

      const specH = 240;
      const fMax = 8;
      const samples = window.VisualMath.makeSamples(-fMax, fMax, 360, (f) => {
        if (Math.abs(f) < 0.0001) return 1;
        const x = Math.PI * f;
        return Math.abs(Math.sin(x) / x);
      });
      const extra = `<text x="${W - 18}" y="26" fill="#62716b" font-family="monospace" font-size="14" text-anchor="end">Δfц ≈ 1/τсим</text>`;
      const specSvg = window.VisualMath.chartSvg({
        W, H: specH, xMin: -fMax, xMax: fMax, yMin: 0, yMax: 1.08,
        xLabel: "f", yLabel: "|B(f)|", samples, color: "#7554aa", width: 2.5, extra
      });

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Маппинг квантованных уровней в 4-битные коды</p>${topSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Цифровой меандр b(t): четыре τсим на один Δt</p>${botSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Синхронная лупа: этот же фрагмент используют блоки 06–08</p>${zoomSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Амплитудный спектр прямоугольного цифрового сигнала</p>${specSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      const tauSim = dt / 4;
      const digitalBandwidth = 1 / tauSim;
      const probabilities = SignalData.level_probabilities || [];
      const entropy = probabilities.reduce((acc, p) => p > 0 ? acc - p * Math.log2(p) : acc, 0);
      const productivity = entropy / tauSim;
      const redundancy = Math.max(0, 1 - entropy / 4);
      let theory = "Кодер превращает номер уровня в безызбыточную 4-битную комбинацию. Один отсчёт Δt распадается на четыре прямоугольных символа, поэтому цифровой сигнал имеет широкий лепестковый спектр.";
      let formulas = `<div class="formula-preview"><span>Разрядность кодера</span>\\[ L = 16 \\implies \\mu = \\log_2(L) = 4 \\text{ бит} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Длительность символа</span>\\[ \\tau_{сим} = \\frac{\\Delta t}{\\mu} = \\frac{${toLatexNumber(dt.toFixed(4))}}{4} \\approx ${toLatexNumber(tauSim.toFixed(4))} \\text{ мс} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Оценка ширины спектра цифрового сигнала</span>\\[ \\Delta f_ц \\sim \\frac{1}{\\tau_{сим}} \\approx ${toLatexNumber(digitalBandwidth.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Энтропия квантованных сообщений</span>\\[ H_y=-\\sum_{j=0}^{15}p_j\\log_2p_j\\approx ${toLatexNumber(entropy.toFixed(3))}\\text{ бит/отсчёт} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Производительность и избыточность</span>\\[ R_y=\\frac{H_y}{\\tau_{сим}}\\approx ${toLatexNumber(productivity.toFixed(2))}\\text{ кбит/с}, \\quad \\zeta=1-\\frac{H_y}{\\mu}\\approx ${toLatexNumber(redundancy.toFixed(3))} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Синхронная лупа:</strong><br>Нижний фрагмент показывает несколько соседних битов с теми же границами, которые используются в блоках 06–08. Поэтому радиоволна, шум, смесь и стробы детектора дальше сравниваются в одном и том же временном окне.</div>`;
      return { theory, formulas };
    }
  };
})();
