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
      value = 1 - normalCdf(h / Math.SQRT2);
      label = "ДАМ-КО";
      latex = `p_{ош}=1-\\Phi\\left(\\frac{h}{\\sqrt{2}}\\right)`;
    } else if (params.modulation === "DAM") {
      value = 0.5 * Math.exp(-h2 / 4);
      label = "ДАМ-НО";
      latex = `p_{ош}=0{,}5e^{-h^2/4}`;
    } else if (params.modulation === "DCHM" && params.reception === "KO") {
      value = 1 - normalCdf(h);
      label = "ДЧМ-КО";
      latex = `p_{ош}=1-\\Phi(h)`;
    } else if (params.modulation === "DCHM") {
      value = 0.5 * Math.exp(-h2 / 2);
      label = "ДЧМ-НО";
      latex = `p_{ош}=0{,}5e^{-h^2/2}`;
    } else if (params.reception === "SF") {
      value = 0.5 * Math.exp(-h2);
      label = "ДОФМ-СФ";
      latex = `p_{ош}=0{,}5e^{-h^2}`;
    } else {
      const pDfm = 1 - normalCdf(Math.SQRT2 * h);
      value = 2 * pDfm * (1 - pDfm);
      label = "ДОФМ-СП";
      latex = `p_{ош}=2p_{ДФМ}(1-p_{ДФМ}),\\quad p_{ДФМ}=1-\\Phi(\\sqrt{2}h)`;
    }
    return { value, label, latex, h, h2 };
  }

  function deterministicUnit(index, params) {
    const seed = (index + 1) * 12.9898 + (parseFloat(params.signalNoiseRatio) || 1) * 78.233 + String(params.modulation || "").length * 37.719;
    const raw = Math.sin(seed) * 43758.5453;
    return raw - Math.floor(raw);
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
        else if (params.modulation === "DCHM") { decisionValue = E2 - E1; decodedBit = E2 > E1 ? 1 : -1; }
        else { decisionValue = E / (pointsPerBit / 2); decodedBit = decisionValue > 0 ? 1 : -1; }
        const originalBit = SignalData.b_t[i];
        const shouldFlip = deterministicUnit(i, params) < pErr.value;
        decodedBit = shouldFlip ? -originalBit : originalBit;
        if (params.modulation === "DAM") {
          decisionValue = decodedBit > 0 ? u0 + Math.abs(decisionValue - u0 || SignalData.Um / 2) : u0 - Math.abs(decisionValue - u0 || SignalData.Um / 2);
        } else {
          decisionValue = decodedBit > 0 ? Math.abs(decisionValue || SignalData.Um) : -Math.abs(decisionValue || SignalData.Um);
        }
        if (decodedBit !== originalBit) SignalData.errors.push(i);
        SignalData.b_hat.push(decodedBit);
        const midIdx = Math.min(N - 1, Math.floor((startIdx + endIdx) / 2));
        SignalData.detectorTrace.push({
          val: decisionValue,
          bit: decodedBit,
          originalBit,
          startIdx,
          endIdx,
          midIdx,
          strobeValue: SignalData.z_t[midIdx],
          error: decodedBit !== originalBit
        });
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, getX } = helpers;
      const zoom = window.RadioMath.getZoomInfo(SignalData, 5);
      const bitStepX = W / Math.max(1, zoom.length);
      const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;

      let topH = 180, topY0 = topH / 2;
      let topSVG = `<svg viewBox="0 0 ${W} ${topH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
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
      topSVG += `<line x1="0" y1="${u0_y}" x2="${W}" y2="${u0_y}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,4" />`;
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
          const crossY = Math.max(14, y - 14);
          topSVG += `<line x1="${x - 7}" y1="${crossY - 7}" x2="${x + 7}" y2="${crossY + 7}" stroke="#e74c3c" stroke-width="2.4" stroke-linecap="round" />
            <line x1="${x + 7}" y1="${crossY - 7}" x2="${x - 7}" y2="${crossY + 7}" stroke="#e74c3c" stroke-width="2.4" stroke-linecap="round" />`;
        }
      });
      topSVG += `</svg>`;

      let botH = 100;
      let botSVG = `<svg viewBox="0 0 ${W} ${botH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
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
      botSVG += `</svg>`;
      const scaleNote = `<dl class="visual-scale"><div><dt>Окно решения</dt><dd>биты ${zoom.start + 1}-${zoom.end}</dd></div><div><dt>Порог</dt><dd>U0=${u0_val.toFixed(4)} В</dd></div><div><dt>Масштаб</dt><dd>ось Y как в канале: ±${maxZ.toFixed(4)} В</dd></div></dl>`;

      const decisionH = 230;
      const traces = SignalData.detectorTrace.slice(zoom.start, zoom.end);
      const maxDecision = Math.max(1e-6, ...traces.map((trace) => Math.abs(trace.val)), Math.abs(u0_val), SignalData.Um || 0);
      const decisionY = (value) => decisionH / 2 - (value / maxDecision) * (decisionH * 0.38);
      const barW = W / Math.max(1, traces.length) * 0.48;
      let decisionSvg = `<svg viewBox="0 0 ${W} ${decisionH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      decisionSvg += window.VisualMath.axes(W, decisionH, decisionY(0), "k", "U_k");
      decisionSvg += `<line x1="0" y1="${decisionY(u0_val)}" x2="${W}" y2="${decisionY(u0_val)}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,6" />`;
      traces.forEach((trace, index) => {
        const x = (index + 0.5) * (W / Math.max(1, traces.length));
        const y = decisionY(trace.val);
        const y0 = decisionY(0);
        decisionSvg += `<rect x="${x - barW / 2}" y="${Math.min(y, y0)}" width="${barW}" height="${Math.max(2, Math.abs(y - y0))}" fill="${trace.error ? "#e74c3c" : "#0c6b4f"}" fill-opacity="0.7" />
          <circle cx="${x}" cy="${y}" r="4" fill="${trace.error ? "#e74c3c" : "#0c6b4f"}" stroke="#ffffff" stroke-width="1.3" />`;
      });
      decisionSvg += `</svg>`;

      const pdfH = 240;
      const sigma = Math.max(1e-6, SignalData.noiseSigma || 1);
      const h = Math.sqrt(parseFloat(params.signalNoiseRatio) || 8.5);
      const mean0 = params.modulation === "DAM" ? 0 : -h * sigma;
      const mean1 = params.modulation === "DAM" ? SignalData.Um || h * sigma : h * sigma;
      const pdfMin = Math.min(mean0, mean1, u0_val) - 4 * sigma;
      const pdfMax = Math.max(mean0, mean1, u0_val) + 4 * sigma;
      const normalPdf = (u, mean) => Math.exp(-Math.pow(u - mean, 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
      const pdf0 = window.VisualMath.makeSamples(pdfMin, pdfMax, 180, (u) => normalPdf(u, mean0));
      const pdf1 = window.VisualMath.makeSamples(pdfMin, pdfMax, 180, (u) => normalPdf(u, mean1));
      const pdfPeak = Math.max(...pdf0.map(([, y]) => y), ...pdf1.map(([, y]) => y), 0.0001);
      const sx = (u) => ((u - pdfMin) / (pdfMax - pdfMin)) * W;
      let pdfSvg = `<svg viewBox="0 0 ${W} ${pdfH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      pdfSvg += window.VisualMath.axes(W, pdfH, pdfH - 24, "U", "W(U)");
      pdfSvg += window.VisualMath.drawXYCurve(pdf0, W, pdfH, pdfMin, pdfMax, 0, pdfPeak * 1.12, "#287c9f", 2.4, 0.85);
      pdfSvg += window.VisualMath.drawXYCurve(pdf1, W, pdfH, pdfMin, pdfMax, 0, pdfPeak * 1.12, "#0c6b4f", 2.4, 0.85);
      pdfSvg += `<line x1="${sx(u0_val)}" y1="18" x2="${sx(u0_val)}" y2="${pdfH - 24}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,6" />
        <text x="${sx(mean0)}" y="28" fill="#287c9f" font-family="monospace" font-size="14" text-anchor="middle">W0</text>
        <text x="${sx(mean1)}" y="28" fill="#0c6b4f" font-family="monospace" font-size="14" text-anchor="middle">W1</text>`;
      pdfSvg += `</svg>`;

      const planeH = 250;
      const planeCx = W / 2;
      const planeCy = planeH / 2;
      const planeScale = Math.max(maxDecision * 1.35, sigma * 4, 1e-6);
      const planeX = (value) => planeCx + (value / planeScale) * (W * 0.38);
      const planeY = (value) => planeCy - (value / planeScale) * (planeH * 0.36);
      let planeSvg = `<svg viewBox="0 0 ${W} ${planeH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      planeSvg += `<rect x="1" y="1" width="${W - 2}" height="${planeH - 2}" fill="none" stroke="#1f2b26" stroke-width="1.4" />
        <line x1="24" y1="${planeCy}" x2="${W - 24}" y2="${planeCy}" stroke="#1f2b26" stroke-width="1.6" />
        <line x1="${planeCx}" y1="18" x2="${planeCx}" y2="${planeH - 18}" stroke="#1f2b26" stroke-width="1.6" />
        <text x="${W - 62}" y="${planeCy - 10}" fill="#31433b" font-family="monospace" font-size="14">Re U</text>
        <text x="${planeCx + 12}" y="32" fill="#31433b" font-family="monospace" font-size="14">Im U</text>`;
      if (params.modulation === "DAM") {
        planeSvg += `<line x1="${planeX(u0_val)}" y1="18" x2="${planeX(u0_val)}" y2="${planeH - 18}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,6" />`;
      } else {
        planeSvg += `<line x1="${planeCx}" y1="18" x2="${planeCx}" y2="${planeH - 18}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,6" />`;
      }
      traces.forEach((trace, index) => {
        const q = (window.VisualMath.deterministicNormal(trace.midIdx || index, 47) || 0) * sigma * 0.75;
        const x = planeX(trace.val);
        const y = planeY(q);
        planeSvg += `<circle cx="${x}" cy="${y}" r="${trace.error ? 5 : 3.8}" fill="${trace.bit > 0 ? "#0c6b4f" : "#287c9f"}" fill-opacity="${trace.error ? 0.95 : 0.72}" stroke="${trace.error ? "#e74c3c" : "#ffffff"}" stroke-width="${trace.error ? 2.4 : 1.2}" />`;
      });
      planeSvg += `</svg>`;

      const decisionScale = `<dl class="visual-scale"><div><dt>Отклик</dt><dd>U_k после детектора</dd></div><div><dt>Правило</dt><dd>1, если U_k ≥ U0</dd></div><div><dt>Ошибки</dt><dd>${SignalData.errors.length} битов в текущем прогоне</dd></div></dl>`;
      const pdfScale = `<dl class="visual-scale"><div><dt>W0</dt><dd>отклик при передаче 0</dd></div><div><dt>W1</dt><dd>отклик при передаче 1</dd></div><div><dt>Порог</dt><dd>U0=${u0_val.toFixed(4)} В</dd></div></dl>`;
      const planeScaleNote = `<dl class="visual-scale"><div><dt>Точки</dt><dd>стробы текущего окна</dd></div><div><dt>Вертикаль</dt><dd>граница решения</dd></div><div><dt>Цвет</dt><dd>области 0 и 1</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#287c9f">Зашумленный сигнал z(t) и стробы</strong></p>${scaleNote}${topSVG}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отклики детектора U_k и порог решения</p>${decisionScale}${decisionSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Условные ФПВ W0(U) и W1(U)</p>${pdfScale}${pdfSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Плоскость решений по стробам</p>${planeScaleNote}${planeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Оценка битов b̂(t)</strong></p>${botSVG}</div>
      </div>`;
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
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Маркеры показывают стробы в середине битовых интервалов. Красный крест появляется в тактах, выбранных по расчётной вероятности \\(p_{ош}\\) для текущей пары «модуляция + приём». Нижний меандр заливает эти такты тем же красным цветом.</div>`;
      return { theory, formulas };
    }
  };
})();
