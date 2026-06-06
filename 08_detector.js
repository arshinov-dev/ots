// 08_detector.js - Детектор и решающее устройство
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.detector = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const numBits = SignalData.b_t.length;
      const pointsPerBit = N / numBits;

      // Визуальные частоты синхронизированы с модулятором
      const f_vis = 12;
      const f_low_vis = 8;
      const f_up_vis = 16;

      let currentPhase = 0;
      const dofm_phases = [];
      for (let i = 0; i < numBits; i++) {
        if (SignalData.b_t[i] < 0) currentPhase = (currentPhase + Math.PI) % (2 * Math.PI);
        dofm_phases.push(currentPhase);
      }

      const h2 = parseFloat(params.signalNoiseRatio) || 8.5;
      const erfc_approx = (x) => Math.exp(-x * x) / (x * Math.sqrt(Math.PI) + 1);
      let p_err = 0;
      if (params.modulation === "DAM") { p_err = params.reception === "KO" ? 0.5 * erfc_approx(Math.sqrt(h2) / 2) : 0.5 * Math.exp(-h2 / 4); }
      else if (params.modulation === "DCHM") { p_err = params.reception === "KO" ? 0.5 * erfc_approx(Math.sqrt(h2 / 2)) : 0.5 * Math.exp(-h2 / 2); }
      else { p_err = params.reception === "SF" ? 0.5 * Math.exp(-h2) : 0.5 * erfc_approx(Math.sqrt(h2)); }
      SignalData.p_err_val = p_err;

      const u0 = params.modulation === "DAM" ? SignalData.Um / 2 : 0;
      SignalData.u0 = u0;
      SignalData.detectorTrace = [];
      SignalData.b_hat = [];
      SignalData.errors = [];

      for (let i = 0; i < numBits; i++) {
        let startIdx = Math.floor(i * pointsPerBit);
        let endIdx = Math.floor((i + 1) * pointsPerBit);
        let E1 = 0, E2 = 0, E = 0;
        for (let k = startIdx; k < endIdx; k++) {
          let t_frac = k / N;
          if (params.modulation === "DAM") { E += SignalData.z_t[k] * Math.sin(2 * Math.PI * f_vis * t_frac); }
          else if (params.modulation === "DCHM") { E1 += SignalData.z_t[k] * Math.sin(2 * Math.PI * f_low_vis * t_frac); E2 += SignalData.z_t[k] * Math.sin(2 * Math.PI * f_up_vis * t_frac); }
          else { let refPhase = dofm_phases[i] || 0; E += SignalData.z_t[k] * Math.sin(2 * Math.PI * f_vis * t_frac + refPhase); }
        }
        let decodedBit = 1;
        if (params.modulation === "DAM") { let midIdx = Math.floor((startIdx + endIdx) / 2); decodedBit = SignalData.z_t[midIdx] > u0 ? 1 : -1; }
        else if (params.modulation === "DCHM") { decodedBit = E1 > E2 ? 1 : -1; }
        else { let val = E / (pointsPerBit / 2); decodedBit = val > 0 ? 1 : -1; }
        if (decodedBit !== SignalData.b_t[i]) SignalData.errors.push(i);
        SignalData.b_hat.push(decodedBit);
        SignalData.detectorTrace.push({ val: params.modulation === "DAM" ? SignalData.z_t[Math.floor((startIdx + endIdx) / 2)] : E / (pointsPerBit / 2), bit: decodedBit });
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getY } = helpers;
      const numBits = SignalData.b_t ? SignalData.b_t.length : 0;
      const bitStepX = W / numBits;

      let topH = 140, topY0 = topH / 2;
      let topSVG = `<svg viewBox="0 0 ${W} ${topH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      let u0_val = params.modulation === "DAM" ? SignalData.Um / 2 : 0;
      let maxZ = Math.max(...SignalData.z_t.map(Math.abs));
      if (maxZ < SignalData.Um) maxZ = SignalData.Um * 1.5; if (maxZ === 0) maxZ = 1;
      let u0_y = topY0 - (u0_val / maxZ) * (topH * 0.4);
      let zD = `M 0 ${topY0}`;
      for (let i = 0; i < SignalData.N; i++) { let y = topY0 - (SignalData.z_t[i] / maxZ) * (topH * 0.4); if (y < -10) y = -10; if (y > topH + 10) y = topH + 10; zD += ` L ${getX(i)} ${y}`; }
      topSVG += `<path d="${zD}" stroke="#287c9f" stroke-width="2" fill="none" stroke-opacity="0.8" stroke-linejoin="round" />`;
      topSVG += `<line x1="0" y1="${u0_y}" x2="${W}" y2="${u0_y}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="4,4" />`;
      topSVG += `</svg>`;

      let botH = 100;
      let botSVG = `<svg viewBox="0 0 ${W} ${botH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      for (let i = 0; i < numBits; i++) { if (SignalData.errors.includes(i)) botSVG += `<rect x="${i * bitStepX}" y="0" width="${bitStepX}" height="${botH}" fill="rgba(231, 76, 60, 0.25)" />`; }
      let mD = "";
      for (let i = 0; i < numBits; i++) {
        let x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
        let y = SignalData.b_hat[i] > 0 ? botH * 0.2 : botH * 0.8;
        if (i === 0) mD += `M ${x1} ${y} `;
        else { let prevY = SignalData.b_hat[i - 1] > 0 ? botH * 0.2 : botH * 0.8; if (prevY !== y) mD += `L ${x1} ${prevY} L ${x1} ${y} `; }
        mD += `L ${x2} ${y} `;
      }
      botSVG += `<path d="${mD}" stroke="#0c6b4f" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
      botSVG += `</svg>`;
      return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#287c9f">Зашумленный сигнал z(t)</strong></p>${topSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Оценка битов b̂(t)</strong></p>${botSVG}</div></div>`;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      let p_err_str = "0";
      const p_err_val = SignalData.p_err_val || 0;
      if (p_err_val > 0) {
        let [base, exp] = p_err_val.toExponential(2).split('e');
        p_err_str = `${toLatexNumber(base)} \\cdot 10^{${parseInt(exp, 10)}}`;
      }
      let theory = "Детектор сравнивает принятый сигнал с порогом и принимает решение о переданном бите.";
      let formulas = `<div class="formula-preview"><span>Вероятность ошибки на бит</span>\\[ p_{ош} \\approx ${p_err_str} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
