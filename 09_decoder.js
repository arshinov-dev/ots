// 09_decoder.js - Декодер и интерполятор ЦАП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.decoder = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const L = 16;
      const Dg = 6 * sigmaG;
      const dU = Dg / (L - 1);
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));

      SignalData.v_hat = [];
      SignalData.chunkErrors = [];
      for (let i = 0; i < SignalData.b_hat.length; i += 4) {
        let chunk = SignalData.b_hat.slice(i, i + 4);
        let binStr = chunk.map(b => b > 0 ? "1" : "0").join("").padEnd(4, "0");
        let dec = parseInt(binStr, 2);
        if (dec >= L) dec = L - 1;
        let recoveredLevel = -3 * sigmaG + dec * dU;
        SignalData.v_hat.push(recoveredLevel);
        let origChunk = SignalData.b_t.slice(i, i + 4).map(b => b > 0 ? "1" : "0").join("").padEnd(4, "0");
        if (binStr !== origChunk) {
          SignalData.chunkErrors.push({ orig: origChunk, err: binStr, expected: -3 * sigmaG + parseInt(origChunk, 2) * dU, decoded: recoveredLevel });
        }
      }

      SignalData.x_hat_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let vIdx = Math.floor(i / stepSize);
        if (vIdx >= SignalData.v_hat.length) vIdx = SignalData.v_hat.length - 1;
        SignalData.x_hat_t[i] = SignalData.v_hat[vIdx];
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getLocalY, yZero, drawStemsSVG } = helpers;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      let decH = 200, decY0 = getLocalY(0, decH);
      let decSVG = `<svg viewBox="0 0 ${W} ${decH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      decSVG += `<line x1="0" y1="${decY0}" x2="${W}" y2="${decY0}" stroke="#d5ddd8" stroke-width="2" />`;

      let errorRects = "";
      for (let i = 0; i < SignalData.v_hat.length; i++) {
        if (SignalData.v_hat[i] !== SignalData.quantized_v[i]) {
          let x1 = getX(i * stepSize);
          let x2 = getX(Math.min((i + 1) * stepSize, SignalData.N - 1));
          let y1 = getLocalY(SignalData.v_hat[i], decH);
          let y2 = getLocalY(SignalData.quantized_v[i], decH);
          errorRects += `<rect x="${x1}" y="${Math.min(y1, y2)}" width="${x2 - x1}" height="${Math.abs(y1 - y2)}" fill="rgba(231, 76, 60, 0.35)" />`;
        }
      }
      decSVG += errorRects;
      decSVG += drawStemsSVG(SignalData.sampled_x_indices, SignalData.quantized_v, '#0c6b4f', 0.2);

      let stepD = `M 0 ${getLocalY(SignalData.x_hat_t[0], decH)}`;
      for (let i = 0; i < SignalData.N; i += stepSize) {
        let x1 = getX(i); let x2 = getX(Math.min(i + stepSize, SignalData.N - 1));
        let y = getLocalY(SignalData.x_hat_t[i], decH);
        if (i === 0) stepD = `M ${x1} ${y}`; else stepD += ` L ${x1} ${y}`;
        stepD += ` L ${x2} ${y}`;
      }
      decSVG += `<path d="${stepD}" stroke="#0c6b4f" stroke-width="3" fill="none" stroke-linejoin="round" />`;
      decSVG += `</svg>`;
      return `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Восстановленные уровни x̂(t)</strong></p>${decSVG}</div>`;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const Dg = 6 * sigmaG;
      const dU = Dg / 15;
      let theory = "Пачки из μ битов снова группируются и переводятся в десятичный номер уровня. Если хотя бы один бит был искажён, декодер восстановит неправильный уровень.";
      let formulas = `<div class="formula-preview"><span>Формула обратного пересчета</span>\\[ \\hat{v}_j = -3\\sigma_g + j \\cdot \\Delta U \\]</div>`;
      const chunkErrors = SignalData.chunkErrors || [];
      if (chunkErrors.length > 0) {
        let ce = chunkErrors[0];
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--error"><strong>Последствия ошибки:</strong><br>Отправлен код <strong>${ce.orig}</strong>, принят код <strong>${ce.err}</strong>. Шум передачи: <strong style="color: #e74c3c;">\\( \\xi_p = ${toLatexNumber((ce.decoded - ce.expected).toFixed(2))} \\) В.</strong></div>`;
      } else {
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--ok">Ошибок в битах не обнаружено.</div>`;
      }
      return { theory, formulas };
    }
  };
})();
