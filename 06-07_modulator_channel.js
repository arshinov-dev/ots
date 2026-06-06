// 06-07_modulator_channel.js - Модулятор и канал связи
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  // Модулятор
  window.StageHandlers.modulator = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const numBits = SignalData.b_t.length;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      const pointsPerBit = stepSize / 4;
      const fd_khz = 2 * alpha * dfg;
      const dt_ms = 1 / fd_khz;
      const tau_sim = dt_ms / 4;
      const df_c = 1 / tau_sim;
      const f0 = parseFloat(params.primaryFrequency) || 60;
      const f_upper = parseFloat(params.secondaryFrequency) || 62.5;
      const f_lower = parseFloat(params.primaryFrequency) || 61;
      const df_s = 2 * df_c + (params.modulation === 'DCHM' ? Math.abs(f_upper - f_lower) : 0);
      const noiseDensity = parseFloat(params.noiseDensity) || 0.0001;
      const P_sh = noiseDensity * df_s;
      const signalNoiseRatio = parseFloat(params.signalNoiseRatio) || 8.5;
      const P_c = signalNoiseRatio * P_sh;
      const Um = params.modulation === "DAM" ? Math.sqrt(P_c) : Math.sqrt(2 * P_c);
      SignalData.Um = Um;

      let currentPhase = 0;
      const dofm_phases = [];
      for (let i = 0; i < numBits; i++) {
        if (SignalData.b_t[i] < 0) currentPhase = (currentPhase + Math.PI) % (2 * Math.PI);
        dofm_phases.push(currentPhase);
      }

      SignalData.S_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let bitIdx = Math.floor(i / pointsPerBit);
        if (bitIdx >= numBits) bitIdx = numBits - 1;
        let bit = SignalData.b_t[bitIdx];
        let t_norm = i / N;
        if (params.modulation === "DAM") {
          SignalData.S_t[i] = (bit > 0 ? Um : 0) * Math.sin(2 * Math.PI * f0 * t_norm);
        } else if (params.modulation === "DCHM") {
          let freq = bit > 0 ? f_upper : f_lower;
          SignalData.S_t[i] = Um * Math.sin(2 * Math.PI * freq * t_norm);
        } else {
          let phaseOffset = dofm_phases[bitIdx] || 0;
          SignalData.S_t[i] = Um * Math.sin(2 * Math.PI * f0 * t_norm + phaseOffset);
        }
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getY } = helpers;
      const numBits = SignalData.b_t ? SignalData.b_t.length : 0;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      const bitStepX = (stepSize / (SignalData.N - 1)) * W / 4;

      let modTopH = 60;
      let modTopSVG = `<svg viewBox="0 0 ${W} ${modTopH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      let paleMeanderD = "";
      for (let i = 0; i < numBits; i++) {
        let x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
        let y = SignalData.b_t[i] > 0 ? modTopH * 0.2 : modTopH * 0.8;
        if (i === 0) paleMeanderD += `M ${x1} ${y} `;
        else {
          let prevY = SignalData.b_t[i - 1] > 0 ? modTopH * 0.2 : modTopH * 0.8;
          if (prevY !== y) paleMeanderD += `L ${x1} ${prevY} L ${x1} ${y} `;
        }
        paleMeanderD += `L ${x2} ${y} `;
      }
      modTopSVG += `<path d="${paleMeanderD}" stroke="#0c6b4f" stroke-width="2" fill="none" stroke-opacity="0.3" stroke-linejoin="round" />`;
      modTopSVG += `</svg>`;

      let modBotH = 160, modBotY0 = modBotH / 2;
      let modBotSVG = `<svg viewBox="0 0 ${W} ${modBotH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      modBotSVG += `<line x1="0" y1="${modBotY0}" x2="${W}" y2="${modBotY0}" stroke="#d5ddd8" stroke-width="2" />`;
      let sD = `M 0 ${modBotY0}`;
      let maxS = Math.max(...SignalData.S_t.map(Math.abs)); if (maxS === 0) maxS = 1;
      for (let i = 0; i < SignalData.N; i++) sD += ` L ${getX(i)} ${modBotY0 - (SignalData.S_t[i] / maxS) * (modBotH * 0.4)}`;
      modBotSVG += `<path d="${sD}" stroke="#287c9f" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
      modBotSVG += `</svg>`;
      return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Цифровой сигнал b(t)</p>${modTopSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Радиосигнал S(t)</p>${modBotSVG}</div></div>`;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      let theory = "Модулятор «закладывает» цифровую последовательность в параметры высокочастотной несущей.";
      let formulas = `<div class="formula-preview"><span>Способ передачи</span>\\[ \\text{${params.modulation}} \\]</div>`;
      const Um = SignalData.Um || 0;
      formulas += `<div class="formula-preview"><span>Амплитуда сигнала</span>\\[ U_m = ${toLatexNumber(Um.toFixed(2))} \\text{ В} \\]</div>`;
      return { theory, formulas };
    }
  };

  // Канал связи
  window.StageHandlers.channel = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const numBits = SignalData.b_t.length;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      const pointsPerBit = stepSize / 4;
      const fd_khz = 2 * alpha * dfg;
      const dt_ms = 1 / fd_khz;
      const tau_sim = dt_ms / 4;
      const df_c = 1 / tau_sim;
      const f0 = parseFloat(params.primaryFrequency) || 60;
      const f_upper = parseFloat(params.secondaryFrequency) || 62.5;
      const f_lower = parseFloat(params.primaryFrequency) || 61;
      const df_s = 2 * df_c + (params.modulation === 'DCHM' ? Math.abs(f_upper - f_lower) : 0);
      const noiseDensity = parseFloat(params.noiseDensity) || 0.0001;
      const P_sh = noiseDensity * df_s;
      const noiseSigma = Math.sqrt(P_sh);

      SignalData.n_t = new Array(N).fill(0);
      SignalData.z_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
        SignalData.n_t[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * noiseSigma;
        SignalData.z_t[i] = SignalData.S_t[i] + SignalData.n_t[i];
      }
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getY } = helpers;
      let chanH = 120, chanY0 = chanH / 2;
      let chanSVG = `<svg viewBox="0 0 ${W} ${chanH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      chanSVG += `<line x1="0" y1="${chanY0}" x2="${W}" y2="${chanY0}" stroke="#d5ddd8" stroke-width="2" />`;
      let maxZ = Math.max(...SignalData.z_t.map(Math.abs));
      if (maxZ < SignalData.Um) maxZ = SignalData.Um * 1.5; if (maxZ === 0) maxZ = 1;
      let createChanPlot = (data, color, opacity) => {
        let d = `M 0 ${chanY0}`;
        for (let i = 0; i < SignalData.N; i++) {
          let y = chanY0 - (data[i] / maxZ) * (chanH * 0.4);
          if (y < -10) y = -10; if (y > chanH + 10) y = chanH + 10;
          d += ` L ${getX(i)} ${y}`;
        }
        return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-opacity="${opacity}" stroke-linejoin="round" />`;
      };
      chanSVG += createChanPlot(SignalData.S_t, '#287c9f', 0.5);
      chanSVG += createChanPlot(SignalData.n_t, '#e74c3c', 1);
      chanSVG += createChanPlot(SignalData.z_t, '#0c6b4f', 1);
      chanSVG += `</svg>`;
      return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#287c9f">Идеальный сигнал S(t)</strong></p>${chanSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#e74c3c">Гауссовский шум n(t)</strong></p>${chanSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Принятая смесь z(t)</strong></p>${chanSVG}</div></div>`;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      let theory = "На вход приёмника поступает смесь полезного сигнала и гауссовского шума.";
      let formulas = `<div class="formula-preview"><span>Модель принимаемого сигнала</span>\\[ z(t) = S(t) + n(t) \\]</div>`;
      formulas += `<div class="formula-preview"><span>Отношение сигнал/шум</span>\\[ h^2 = ${toLatexNumber(params.signalNoiseRatio)} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
