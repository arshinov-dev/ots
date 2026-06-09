// 09_decoder.js - Декодер и интерполятор ЦАП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function getTransitionDistanceFactor(probabilities) {
    const L = 16;
    let sum = 0;
    for (let i = 0; i < L; i++) {
      const pi = probabilities?.[i] ?? (1 / L);
      for (let bit = 0; bit < 4; bit++) {
        const j = i ^ (1 << bit);
        sum += pi * 0.25 * Math.pow(j - i, 2);
      }
    }
    return sum;
  }

  window.StageHandlers.decoder = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const L = 16;
      const Dg = 6 * sigmaG;
      const dU = Dg / (L - 1);
      const stepSize = window.VisualMath.getSampleStep(params);

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
      const transmissionErr = SignalData.v_hat.reduce((acc, value, index) => {
        const expected = SignalData.quantized_v[index] ?? value;
        return acc + Math.pow(value - expected, 2);
      }, 0);
      SignalData.transmission_noise_sq = SignalData.v_hat.length ? transmissionErr / SignalData.v_hat.length : 0;
      SignalData.transition_distance_factor = getTransitionDistanceFactor(SignalData.level_probabilities);
      SignalData.transmission_noise_analytic_sq = 0.1777 * Math.pow(dU, 2) * (SignalData.p_err_val || 0) * SignalData.transition_distance_factor;

      SignalData.x_hat_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let vIdx = Math.floor(i / stepSize);
        if (vIdx >= SignalData.v_hat.length) vIdx = SignalData.v_hat.length - 1;
        SignalData.x_hat_t[i] = SignalData.v_hat[vIdx];
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getLocalY, yZero, drawStemsSVG } = helpers;
      const stepSize = window.VisualMath.getSampleStep(params);
      let decH = 200, decY0 = getLocalY(0, decH);
      let decSVG = `<svg viewBox="0 0 ${W} ${decH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      decSVG += `<line x1="0" y1="${decY0}" x2="${W}" y2="${decY0}" stroke="#d5ddd8" stroke-width="2" />`;

      let errorRects = "";
      let originalStepD = "";
      let recoveredStepD = "";
      for (let i = 0; i < SignalData.v_hat.length; i++) {
        const x1 = getX(i * stepSize);
        const x2 = getX(Math.min((i + 1) * stepSize, SignalData.N - 1));
        const yOriginal = getLocalY(SignalData.quantized_v[i] ?? 0, decH);
        const yRecovered = getLocalY(SignalData.v_hat[i], decH);
        if (i === 0) {
          originalStepD = `M ${x1} ${yOriginal}`;
          recoveredStepD = `M ${x1} ${yRecovered}`;
        } else {
          originalStepD += ` L ${x1} ${yOriginal}`;
          recoveredStepD += ` L ${x1} ${yRecovered}`;
        }
        originalStepD += ` L ${x2} ${yOriginal}`;
        recoveredStepD += ` L ${x2} ${yRecovered}`;
        if (SignalData.v_hat[i] !== SignalData.quantized_v[i]) {
          errorRects += `<rect x="${x1}" y="${Math.min(yOriginal, yRecovered)}" width="${x2 - x1}" height="${Math.abs(yOriginal - yRecovered)}" fill="rgba(231, 76, 60, 0.38)" />`;
        }
      }
      decSVG += errorRects;
      decSVG += `<path d="${originalStepD}" stroke="#287c9f" stroke-width="2.2" fill="none" stroke-opacity="0.24" stroke-linejoin="round" />`;
      decSVG += `<path d="${recoveredStepD}" stroke="#0c6b4f" stroke-width="3" fill="none" stroke-linejoin="round" />`;
      decSVG += `<text x="${W - 18}" y="24" fill="#e74c3c" font-family="monospace" font-size="14" text-anchor="end">ξп² ≈ ${(SignalData.transmission_noise_analytic_sq || 0).toFixed(4)}</text>`;
      decSVG += `</svg>`;
      return `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Восстановленные уровни x̂(t)</strong></p>${decSVG}</div>`;
    },
    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      const Dg = 6 * sigmaG;
      const dU = Dg / 15;
      const pErr = SignalData.p_err_val || 0;
      const transitionFactor = SignalData.transition_distance_factor || getTransitionDistanceFactor(SignalData.level_probabilities);
      const xiAnalytic = SignalData.transmission_noise_analytic_sq || (0.1777 * dU * dU * pErr * transitionFactor);
      let theory = "Пачки из μ битов снова группируются и переводятся в десятичный номер уровня. Если хотя бы один бит был искажён, декодер восстановит неправильный уровень.";
      let formulas = `<div class="formula-preview"><span>Формула обратного пересчета</span>\\[ \\hat{v}_j = -3\\sigma_g + j \\cdot \\Delta U \\]</div>`;
      const chunkErrors = SignalData.chunkErrors || [];
      if (chunkErrors.length > 0) {
        let ce = chunkErrors[0];
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--error"><strong>Пример ошибки декодирования:</strong><br>Отправлен код <strong>${ce.orig}</strong>, принят код <strong>${ce.err}</strong>. Уровень изменился с \\(${toLatexNumber(ce.expected.toFixed(3))}\\) В на \\(${toLatexNumber(ce.decoded.toFixed(3))}\\) В.</div>`;
      } else {
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--ok">Ошибок в битах не обнаружено.</div>`;
      }
      formulas += `<div class="formula-preview"><span>Аналитический шум передачи</span>\\[ \\xi_p^2 \\approx 0{,}1777\\Delta U^2p_{ош}\\sum p_{ij}(j-i)^2 = 0{,}1777\\cdot ${toLatexNumber(dU.toFixed(3))}^2\\cdot ${toLatexNumber(pErr.toExponential(3).replace(".", "{,}"))}\\cdot ${toLatexNumber(transitionFactor.toFixed(3))} \\approx ${toLatexNumber(xiAnalytic.toFixed(6))} \\text{ В}^2 \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Бледная ступенька показывает исходные уровни из квантователя, зелёный контур — восстановленные уровни. Красная заливка показывает конкретные отклонения на этом прогоне, а численная \\(\\xi_p^2\\) выше считается по вероятности ошибки и матрице переходов 4-битного кода.</div>`;
      return { theory, formulas };
    }
  };
})();
