// 09_decoder.js - Декодер и интерполятор ЦАП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function getQuantizerParams(params) {
    const calculation = window.SignalData?.calculation || window.SystemCalculations.calculate(params);
    return { ...calculation.source, ...calculation.quantizer, codebook: calculation.coding.codebook };
  }

  function indexFromCode(word, levelCount) {
    const value = parseInt(word, 2);
    return value === 0 ? levelCount - 1 : Math.max(0, Math.min(levelCount - 1, value - 1));
  }

  function getTransitionDistanceFactor(probabilities, codebook, levelCount, mu) {
    let sum = 0;
    for (let i = 0; i < levelCount; i++) {
      const pi = probabilities?.[i] ?? (1 / levelCount);
      for (let bit = 0; bit < mu; bit++) {
        const flipped = [...codebook[i]];
        flipped[bit] = flipped[bit] === "1" ? "0" : "1";
        const j = indexFromCode(flipped.join(""), levelCount);
        sum += pi * (1 / mu) * Math.pow(j - i, 2);
      }
    }
    return sum;
  }

  window.StageHandlers.decoder = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const { dU, levels, levelCount, mu, codebook } = getQuantizerParams(params);
      const stepSize = window.VisualMath.getSampleStep(params);

      SignalData.v_hat = [];
      SignalData.chunkErrors = [];
      SignalData.received_code_words = [];
      SignalData.original_code_words = [];
      SignalData.error_code_words = [];
      SignalData.decoded_indices = [];
      for (let i = 0; i < SignalData.b_hat.length; i += mu) {
        let chunk = SignalData.b_hat.slice(i, i + mu);
        let binStr = chunk.map(b => b > 0 ? "1" : "0").join("").padEnd(mu, "0");
        let dec = indexFromCode(binStr, levelCount);
        let recoveredLevel = levels[dec];
        SignalData.received_code_words.push(binStr);
        SignalData.decoded_indices.push(dec);
        SignalData.v_hat.push(recoveredLevel);
        let origChunk = SignalData.b_t.slice(i, i + mu).map(b => b > 0 ? "1" : "0").join("").padEnd(mu, "0");
        SignalData.original_code_words.push(origChunk);
        const errorWord = [...binStr].map((bit, bitIndex) => bit === (origChunk[bitIndex] || "0") ? "0" : "1").join("");
        SignalData.error_code_words.push(errorWord);
        if (binStr !== origChunk) {
          SignalData.chunkErrors.push({ orig: origChunk, err: binStr, errorWord, expected: levels[indexFromCode(origChunk, levelCount)], decoded: recoveredLevel });
        }
      }
      const transmissionErr = SignalData.v_hat.reduce((acc, value, index) => {
        const expected = SignalData.quantized_v[index] ?? value;
        return acc + Math.pow(value - expected, 2);
      }, 0);
      SignalData.transmission_noise_sq = SignalData.v_hat.length ? transmissionErr / SignalData.v_hat.length : 0;
      // Шум передачи по методичке (формулы 39-42):
      // ξп² = ((2/π)·Si(π) - 1) · ΔU² · p̄ош · Σᵢ pᵢ Σⱼ (j-i)²
      // где Σⱼ — по всем уровням, не только однократные битовые ошибки.
      SignalData.transition_distance_factor = getTransitionDistanceFactor(SignalData.level_probabilities, codebook, levelCount, mu);
      const tnResult = (window.Calculations && window.Calculations.computeTransmissionNoise)
        ? window.Calculations.computeTransmissionNoise({
            stepSize: dU,
            levelCount,
            probabilities: SignalData.level_probabilities,
            pError: SignalData.p_err_val || 0,
            mu,
          })
        : null;
      if (tnResult) {
        SignalData.transmission_noise_analytic_sq = tnResult.value;
        SignalData.transmission_noise_meta = tnResult;
      } else {
        SignalData.transmission_noise_analytic_sq = 0.1777 * Math.pow(dU, 2) * (SignalData.p_err_val || 0) * SignalData.transition_distance_factor;
      }

      SignalData.x_hat_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let vIdx = Math.floor(i / stepSize);
        if (vIdx >= SignalData.v_hat.length) vIdx = SignalData.v_hat.length - 1;
        SignalData.x_hat_t[i] = SignalData.v_hat[vIdx];
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, getLocalY } = helpers;
      const { mu } = (SignalData.calculation || window.SystemCalculations.calculate(params)).coding;
      const vm = window.VisualMath;
      const shownWordCount = Math.min(10, SignalData.received_code_words.length);
      const wordWindow = vm.chooseDynamicWindow(SignalData.decoded_indices, {
        minLength: Math.min(6, shownWordCount),
        length: shownWordCount
      });
      const wordStart = wordWindow.start;
      const wordEnd = wordWindow.end;
      const codeRows = SignalData.received_code_words.slice(wordStart, wordEnd).map((word, offset) => {
        const index = wordStart + offset;
        const original = SignalData.original_code_words[index] || "0".repeat(mu);
        const error = SignalData.error_code_words[index] || "0".repeat(mu);
        const decodedLevel = SignalData.v_hat[index] ?? 0;
        const expectedLevel = SignalData.quantized_v[index] ?? decodedLevel;
        const changed = word !== original;
        return `<tr class="${changed ? "is-error-row" : ""}"><td>${index + 1}</td><td>${original}</td><td>${error}</td><td>${word}</td><td>${decodedLevel.toFixed(3)}</td><td>${(decodedLevel - expectedLevel).toFixed(3)}</td></tr>`;
      }).join("");
      const codeTable = `<div class="quant-table-wrap"><table class="quant-table code-table"><thead><tr><th>k</th><th>b_k</th><th>E_k</th><th>b̂_k</th><th>v̂, В</th><th>ξп, В</th></tr></thead><tbody>${codeRows}</tbody></table></div>`;

      const errH = 130;
      const bits = SignalData.error_code_words.slice(wordStart, wordEnd).join("");
      const bitW = W / Math.max(1, bits.length);
      let errSvg = `<svg viewBox="0 0 ${W} ${errH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      errSvg += window.VisualMath.axes(W, errH, errH - 28, "i", "E_i");
      [...bits].forEach((bit, index) => {
        const x = index * bitW;
        const h = bit === "1" ? errH - 54 : 10;
        errSvg += `<rect x="${x + 2}" y="${errH - 28 - h}" width="${Math.max(3, bitW - 4)}" height="${h}" fill="${bit === "1" ? "#e74c3c" : "#d5ddd8"}" fill-opacity="${bit === "1" ? 0.78 : 0.65}" />`;
      });
      errSvg += `</svg>`;

      let decH = 200, decY0 = getLocalY(0, decH);
      let decSVG = `<svg viewBox="0 0 ${W} ${decH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      decSVG += vm.axes(W, decH, decY0, "kΔt", "x̂(t), В", {
        xMin: wordStart + 1,
        xMax: wordEnd,
        yMin: SignalData.yMin,
        yMax: SignalData.yMax
      });

      let originalStepD = "";
      let recoveredStepD = "";
      let errorMarks = "";
      const visibleWords = Math.max(1, wordEnd - wordStart);
      const wordWidth = W / visibleWords;
      for (let offset = 0; offset < visibleWords; offset++) {
        const i = wordStart + offset;
        const x1 = offset * wordWidth;
        const x2 = (offset + 1) * wordWidth;
        const yOriginal = getLocalY(SignalData.quantized_v[i] ?? SignalData.v_hat[i] ?? 0, decH);
        const yRecovered = getLocalY(SignalData.v_hat[i] ?? 0, decH);
        if (offset === 0) {
          originalStepD = `M ${x1} ${yOriginal}`;
          recoveredStepD = `M ${x1} ${yRecovered}`;
        } else {
          originalStepD += ` L ${x1} ${yOriginal}`;
          recoveredStepD += ` L ${x1} ${yRecovered}`;
        }
        originalStepD += ` L ${x2} ${yOriginal}`;
        recoveredStepD += ` L ${x2} ${yRecovered}`;
        if (SignalData.v_hat[i] !== SignalData.quantized_v[i]) {
          const errorX = (x1 + x2) / 2;
          errorMarks += `<line x1="${errorX}" y1="${yOriginal}" x2="${errorX}" y2="${yRecovered}" stroke="#e74c3c" stroke-width="2.4" />
            <circle cx="${errorX}" cy="${yOriginal}" r="3.2" fill="#287c9f" />
            <circle cx="${errorX}" cy="${yRecovered}" r="3.2" fill="#0c6b4f" />`;
        }
      }
      decSVG += `<path d="${originalStepD}" stroke="#287c9f" stroke-width="2.2" fill="none" stroke-opacity="0.24" stroke-linejoin="round" />`;
      decSVG += `<path d="${recoveredStepD}" stroke="#0c6b4f" stroke-width="3" fill="none" stroke-linejoin="round" />`;
      decSVG += errorMarks;
      decSVG += `</svg>`;
      const errorsInWindow = SignalData.received_code_words.slice(wordStart, wordEnd)
        .filter((word, offset) => word !== SignalData.original_code_words[wordStart + offset]).length;
      const scaleNote = `<dl class="visual-scale"><div><dt>Фрагмент</dt><dd>${visibleWords} уровней</dd></div><div><dt>Передано / восстановлено</dt><dd>синий / зелёный</dd></div><div><dt>Ошибки</dt><dd>${errorsInWindow} в окне</dd></div></dl>`;
      const codeScale = `<dl class="visual-scale"><div><dt>Цепочка</dt><dd>b̂_k^μ → v̂_k^j → x̂(t)</dd></div><div><dt>Разрядность</dt><dd>μ=${mu}</dd></div><div><dt>Слова</dt><dd>${wordStart + 1}–${wordEnd}</dd></div></dl>`;
      const errorDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Ошибки</span><strong>Показать вектор битовых ошибок E_i</strong></summary><div class="visual-step__body">${codeScale}${errSvg}</div></details>`;
      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">b̂_k^μ → v̂_k^j: декодирование принятых слов</p>${codeScale}${codeTable}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">v̂_k^j → x̂(t): ступенчатая интерполяция ЦАП</p>${scaleNote}${decSVG}<div class="stage-panel__info-box">Ступени появляются после декодирования и интерполяции ЦАП.</div></div>
        <div class="stage-panel__visuals-layer">${errorDetails}</div>
      </div>`;
    },
    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const { dU, levelCount, thresholdCount, mu, codebook } = getQuantizerParams(params);
      const pErr = SignalData.p_err_val || 0;
      const transitionFactor = SignalData.transition_distance_factor || getTransitionDistanceFactor(SignalData.level_probabilities, codebook, levelCount, mu);
      const tnMeta = SignalData.transmission_noise_meta;
      const xiAnalytic = SignalData.transmission_noise_analytic_sq || 0;
      const tnCoeff = tnMeta?.coefficient || 0.1777;
      const tnSumTransitions = tnMeta?.sumTransitions || transitionFactor;
      let theory = "Пачки из μ битов снова группируются и переводятся в десятичный номер уровня. Если хотя бы один бит был искажён, декодер восстановит неправильный уровень.";
      let formulas = `<div class="formula-preview"><span>Битовый канал и обратное кодирование</span>\\[ \\hat{b}_i=b_i\\oplus_2E_i,\\quad ${codebook[0]}\\to v_1,\\ldots,${codebook[thresholdCount - 1]}\\to v_{${thresholdCount}},\\quad ${codebook[levelCount - 1]}\\to v_{${levelCount}} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Формула обратного пересчета уровня</span>\\[ \\hat{v}_j = -3\\sigma_g + (j-1{,}5)\\Delta U \\]</div>`;
      const chunkErrors = SignalData.chunkErrors || [];
      if (chunkErrors.length > 0) {
        let ce = chunkErrors[0];
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--error"><strong>Пример ошибки декодирования:</strong><br>Отправлен код <strong>${ce.orig}</strong>, принят код <strong>${ce.err}</strong>. Уровень изменился с \\(${toLatexNumber(ce.expected.toFixed(3))}\\) В на \\(${toLatexNumber(ce.decoded.toFixed(3))}\\) В.</div>`;
      } else {
        formulas += `<div class="stage-panel__info-box stage-panel__info-box--ok">Ошибок в битах не обнаружено.</div>`;
      }
      const tnCoeffText = tnCoeff.toFixed(4).replace(".", "{,}");
      const pAvgError = tnMeta?.pAvgError || 0;
      const pAvgErrorText = pAvgError.toExponential(4).replace(".", "{,}");
      formulas += `<div class="formula-preview"><span>Усреднённая вероятность ошибки (формула 42)</span>\\[ \\overline{p}_{ош}=\\frac{1}{L+1}\\left(1-(1-p_{ош})^{\\mu}\\right)=\\frac{1}{${levelCount}}\\left(1-(1-${pErr.toExponential(3).replace(".", "{,}")})^{${mu}}\\right)\\approx ${pAvgErrorText} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Аналитический шум передачи (по методичке, формулы 39-42)</span>\\[ \\xi_p^2=\\left(\\frac{2}{\\pi}\\text{Si}(\\pi)-1\\right)\\Delta U^2\\overline{p}_{ош}\\sum_{i=1}^{L+1}p_i\\sum_{j=1}^{L+1}(j-i)^2 \\]</div>`;
      formulas += `<div class="formula-preview"><span>Подстановка чисел варианта</span>\\[ \\xi_p^2=${tnCoeffText}\\cdot ${toLatexNumber(dU.toFixed(3))}^2\\cdot ${pAvgErrorText}\\cdot ${toLatexNumber(tnSumTransitions.toFixed(3))}\\approx ${toLatexNumber(xiAnalytic.toFixed(6))}\\text{ В}^2 \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Бледная ступенька показывает исходные уровни из квантователя, зелёный контур — восстановленные уровни. Красная заливка показывает конкретные отклонения на этом прогоне. Коэффициент \\((2/\\pi)\\text{Si}(\\pi)-1\\approx${tnCoeffText}\\) учитывает фильтрацию шума идеальным ФНЧ на выходе ЦАП; сумма \\(\\sum p_i\\sum(j-i)^2\\) берётся по всем уровням, как в методичке.</div>`;
      return { theory, formulas };
    }
  };
})();
