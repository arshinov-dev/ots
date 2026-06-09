// 08_detector.js - Детектор и решающее устройство
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function erfApprox(x) {
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * absX);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
    return sign * y;
  }

  function normalCdf(x) {
    return 0.5 * (1 + erfApprox(x / Math.SQRT2));
  }

  function getErrorProbability(params) {
    const h2 = parseFloat(params.signalNoiseRatio) || 8.5;
    const h = Math.sqrt(h2);
    let label = "";
    let latex = "";
    let value = 0;

    if (params.modulation === "DAM" && params.reception === "KO") {
      value = 0.5 * (1 - normalCdf(h / 2));
      label = "ДАМ-КО";
      latex = `p_{ош}=0{,}5\\left[1-\\Phi\\left(\\frac{h}{2}\\right)\\right]`;
    } else if (params.modulation === "DAM") {
      value = 0.5 * Math.exp(-h2 / 4);
      label = "ДАМ-НО";
      latex = `p_{ош}=0{,}5e^{-h^2/4}`;
    } else if (params.modulation === "DCHM" && params.reception === "KO") {
      value = 0.5 * (1 - normalCdf(h / Math.SQRT2));
      label = "ДЧМ-КО";
      latex = `p_{ош}=0{,}5\\left[1-\\Phi\\left(\\frac{h}{\\sqrt{2}}\\right)\\right]`;
    } else if (params.modulation === "DCHM") {
      value = 0.5 * Math.exp(-h2 / 2);
      label = "ДЧМ-НО";
      latex = `p_{ош}=0{,}5e^{-h^2/2}`;
    } else if (params.reception === "SF") {
      value = 0.5 * Math.exp(-h2);
      label = "ДОФМ-СФ";
      latex = `p_{ош}=0{,}5e^{-h^2}`;
    } else {
      value = 0.5 * (1 - normalCdf(h));
      label = "ДОФМ-СП";
      latex = `p_{ош}=0{,}5\\left[1-\\Phi(h)\\right]`;
    }
    return { value, label, latex, h, h2 };
  }

  window.StageHandlers.detector = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const numBits = SignalData.b_t.length;
      const pointsPerBit = N / numBits;

      // Частоты должны совпадать с модулятором, иначе приёмник решает задачу для другого сигнала.
      const carrierCycles = window.RadioMath.getCarrierCycles(params);

      let currentPhase = 0;
      const dofm_phases = [];
      for (let i = 0; i < numBits; i++) {
        if (SignalData.b_t[i] < 0) currentPhase = (currentPhase + Math.PI) % (2 * Math.PI);
        dofm_phases.push(currentPhase);
      }

      const pErr = getErrorProbability(params);
      SignalData.p_err_val = pErr.value;
      SignalData.p_err_formula = pErr;

      const u0 = params.modulation === "DAM" ? SignalData.Um / 2 : 0;
      SignalData.u0 = u0;
      SignalData.detectorTrace = [];
      SignalData.b_hat = [];
      SignalData.errors = [];

      for (let i = 0; i < numBits; i++) {
        let startIdx = Math.floor(i * pointsPerBit);
        let endIdx = Math.floor((i + 1) * pointsPerBit);
        let E1 = 0, E2 = 0, E = 0, envelope = 0;
        for (let k = startIdx; k < endIdx; k++) {
          let tSymbol = (k - startIdx) / (endIdx - startIdx);
          if (params.modulation === "DAM") { E += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.base * tSymbol); envelope += Math.abs(SignalData.z_t[k]); }
          else if (params.modulation === "DCHM") { E1 += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.low * tSymbol); E2 += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.high * tSymbol); }
          else { let refPhase = dofm_phases[i] || 0; E += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.base * tSymbol + refPhase); }
        }
        let decodedBit = 1;
        let decisionValue = 0;
        if (params.modulation === "DAM") {
          decisionValue = params.reception === "KO" ? (2 * E) / (endIdx - startIdx) : envelope / (endIdx - startIdx);
          decodedBit = decisionValue > u0 ? 1 : -1;
        }
        else if (params.modulation === "DCHM") { decisionValue = E1 - E2; decodedBit = E1 > E2 ? 1 : -1; }
        else { decisionValue = E / (pointsPerBit / 2); decodedBit = decisionValue > 0 ? 1 : -1; }
        if (decodedBit !== SignalData.b_t[i]) SignalData.errors.push(i);
        SignalData.b_hat.push(decodedBit);
        const midIdx = Math.min(N - 1, Math.floor((startIdx + endIdx) / 2));
        SignalData.detectorTrace.push({
          val: decisionValue,
          bit: decodedBit,
          originalBit: SignalData.b_t[i],
          startIdx,
          endIdx,
          midIdx,
          strobeValue: SignalData.z_t[midIdx],
          error: decodedBit !== SignalData.b_t[i]
        });
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, getX } = helpers;
      const zoom = window.RadioMath.getZoomInfo(SignalData, 5);
      const bitStepX = W / Math.max(1, zoom.length);
      const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;

      let topH = 180, topY0 = topH / 2;
      let topSVG = `<svg viewBox="0 0 ${W} ${topH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      let u0_val = params.modulation === "DAM" ? SignalData.Um / 2 : 0;
      let maxZ = SignalData.zMax || Math.max(...SignalData.z_t.map(Math.abs), 1.5 * SignalData.Um);
      if (maxZ === 0) maxZ = 1;
      const yOf = (value) => topY0 - (value / maxZ) * (topH * 0.4);
      let u0_y = topY0 - (u0_val / maxZ) * (topH * 0.4);
      let zD = `M 0 ${topY0}`;
      for (let i = zoom.startIdx; i <= zoom.endIdx; i++) {
        let y = yOf(SignalData.z_t[i]);
        if (y < -10) y = -10; if (y > topH + 10) y = topH + 10;
        zD += ` L ${xOfIndex(i)} ${y}`;
      }
      topSVG += `<path d="${zD}" stroke="#287c9f" stroke-width="2" fill="none" stroke-opacity="0.8" stroke-linejoin="round" />`;
      topSVG += `<line x1="0" y1="${u0_y}" x2="${W}" y2="${u0_y}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,4" />
        <text x="${W - 16}" y="${u0_y - 7}" fill="#e74c3c" font-family="monospace" font-size="13" text-anchor="end">U0 = ${u0_val.toFixed(4)} В</text>`;
      for (let i = 0; i <= zoom.length; i++) {
        const x = i * bitStepX;
        topSVG += `<line x1="${x}" y1="0" x2="${x}" y2="${topH}" stroke="rgba(98,113,107,0.18)" stroke-dasharray="3,8" />`;
      }
      SignalData.detectorTrace.slice(zoom.start, zoom.end).forEach((trace) => {
        const x = xOfIndex(trace.midIdx);
        const y = yOf(trace.strobeValue);
        topSVG += `<line x1="${x}" y1="0" x2="${x}" y2="${topH}" stroke="rgba(98,113,107,0.28)" stroke-dasharray="3,7" />
          <circle cx="${x}" cy="${y}" r="3.7" fill="${trace.error ? '#e74c3c' : '#0c6b4f'}" stroke="#ffffff" stroke-width="1.3" />`;
        if (trace.error) {
          topSVG += `<text x="${x}" y="${Math.max(18, y - 10)}" fill="#e74c3c" font-family="monospace" font-size="24" font-weight="800" text-anchor="middle">×</text>`;
        }
      });
      topSVG += `</svg>`;

      let botH = 100;
      let botSVG = `<svg viewBox="0 0 ${W} ${botH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      for (let i = 0; i < zoom.length; i++) {
        const bitIndex = zoom.start + i;
        if (SignalData.errors.includes(bitIndex)) botSVG += `<rect x="${i * bitStepX}" y="0" width="${bitStepX}" height="${botH}" fill="rgba(231, 76, 60, 0.25)" />`;
        botSVG += `<line x1="${i * bitStepX}" y1="0" x2="${i * bitStepX}" y2="${botH}" stroke="rgba(98,113,107,0.18)" stroke-dasharray="3,8" />`;
      }
      let mD = "";
      for (let i = 0; i < zoom.length; i++) {
        const bitIndex = zoom.start + i;
        let x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
        let y = SignalData.b_hat[bitIndex] > 0 ? botH * 0.2 : botH * 0.8;
        if (i === 0) mD += `M ${x1} ${y} `;
        else { let prevY = SignalData.b_hat[bitIndex - 1] > 0 ? botH * 0.2 : botH * 0.8; if (prevY !== y) mD += `L ${x1} ${prevY} L ${x1} ${y} `; }
        mD += `L ${x2} ${y} `;
      }
      botSVG += `<line x1="${W}" y1="0" x2="${W}" y2="${botH}" stroke="rgba(98,113,107,0.18)" stroke-dasharray="3,8" />`;
      botSVG += `<path d="${mD}" stroke="#0c6b4f" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
      botSVG += `<text x="${W - 12}" y="18" fill="#62716b" font-family="monospace" font-size="12" text-anchor="end">биты ${zoom.start + 1}–${zoom.end}</text>`;
      botSVG += `</svg>`;
      return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#287c9f">Зашумленный сигнал z(t)</strong></p>${topSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Оценка битов b̂(t)</strong></p>${botSVG}</div></div>`;
    },
    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const pErr = SignalData.p_err_formula || getErrorProbability(params);
      const u0 = SignalData.u0 || 0;
      const pErrText = pErr.value > 0 ? pErr.value.toExponential(3).replace(".", "{,}") : "0";
      const branchReason = `Так как в варианте выбрана ${params.modulation} и режим приёма ${params.reception}, используется ветвь ${pErr.label}.`;
      let theory = "Детектор принимает решение по стробам внутри битовых интервалов. Ошибочный такт подсвечивается, когда восстановленный бит не совпал с переданным.";
      let formulas = `<div class="formula-preview"><span>Порог решающего устройства</span>\\[ ${params.modulation === "DAM" ? `U_0=\\frac{U_m}{2}=\\frac{${toLatexNumber((SignalData.Um || 0).toFixed(4))}}{2}=${toLatexNumber(u0.toFixed(4))}\\text{ В}` : `U_0=0\\text{ В}`} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Вероятность ошибки (${pErr.label})</span>\\[ ${pErr.latex}, \\quad h=\\sqrt{${toLatexNumber(pErr.h2)}}=${toLatexNumber(pErr.h.toFixed(4))}, \\quad p_{ош}\\approx ${pErrText} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему эта формула:</strong><br>${branchReason}</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Маркеры показывают стробы в середине битовых интервалов. Красный крест появляется там, где принятое решение оказалось не по ту сторону физического правила относительно исходного бита. Нижний меандр заливает эти такты тем же красным цветом.</div>`;
      return { theory, formulas };
    }
  };
})();
