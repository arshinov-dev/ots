// 08_detector.js - Детектор и решающее устройство
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  const MOD_LABELS = { DAM: "ДАМ", DCHM: "ДЧМ", DOFM: "ДОФМ" };
  const RX_LABELS = { KO: "КО", NO: "НО", SF: "СФ", SP: "СП" };

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
      latex = `p_{\\text{ош}}=1-\\Phi\\left(\\frac{h}{\\sqrt{2}}\\right)`;
    } else if (params.modulation === "DAM") {
      value = 0.5 * Math.exp(-h2 / 4);
      label = "ДАМ-НО";
      latex = `p_{\\text{ош}}=0{,}5e^{-h^2/4}`;
    } else if (params.modulation === "DCHM" && params.reception === "KO") {
      value = 1 - normalCdf(h);
      label = "ДЧМ-КО";
      latex = `p_{\\text{ош}}=1-\\Phi(h)`;
    } else if (params.modulation === "DCHM") {
      value = 0.5 * Math.exp(-h2 / 2);
      label = "ДЧМ-НО";
      latex = `p_{\\text{ош}}=0{,}5e^{-h^2/2}`;
    } else if (params.reception === "SF") {
      value = 0.5 * Math.exp(-h2);
      label = "ДОФМ-СФ";
      latex = `p_{\\text{ош}}=0{,}5e^{-h^2}`;
    } else {
      const pDfm = 1 - normalCdf(Math.SQRT2 * h);
      value = 2 * pDfm * (1 - pDfm);
      label = "ДОФМ-СП";
      latex = `p_{\\text{ош}}=2p_{ДФМ}(1-p_{ДФМ}),\\quad p_{ДФМ}=1-\\Phi(\\sqrt{2}h)`;
    }
    return { value, label, latex, h, h2 };
  }

  // === Функциональная схема приёмника (одна строка, ≤5 блоков) ===
  function buildReceiverSchemeSVG(params, W) {
    const H = 160;
    const mod = params.modulation;
    const rx = params.reception;
    const boxW = 100, boxH = 48, gap = 20;
    const yMid = H / 2;
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg receiver-scheme">`;

    const box = (x, label, fill, sub = "") => {
      svg += `<rect x="${x}" y="${yMid - boxH/2}" width="${boxW}" height="${boxH}" rx="8" fill="${fill}" stroke="#1f2b26" stroke-width="1.4" />`;
      svg += `<text x="${x + boxW/2}" y="${yMid + (sub ? -3 : 4)}" fill="#ffffff" font-family="monospace" font-size="13" text-anchor="middle" font-weight="bold">${label}</text>`;
      if (sub) svg += `<text x="${x + boxW/2}" y="${yMid + 14}" fill="#e8f0ed" font-family="monospace" font-size="10" text-anchor="middle">${sub}</text>`;
    };
    const arrow = (x1, x2) => {
      svg += `<line x1="${x1}" y1="${yMid}" x2="${x2}" y2="${yMid}" stroke="#31433b" stroke-width="2" />`;
      svg += `<path d="M ${x2 - 6} ${yMid - 4} L ${x2} ${yMid} L ${x2 - 6} ${yMid + 4}" fill="none" stroke="#31433b" stroke-width="2" />`;
    };
    const ioLabel = (x, text, anchor = "middle") => {
      svg += `<text x="${x}" y="${yMid + 5}" fill="#287c9f" font-family="monospace" font-size="15" text-anchor="${anchor}" font-weight="bold">${text}</text>`;
    };

    let blocks = [];
    if (mod === "DAM") {
      blocks = [
        { label: "ППФ", fill: "#287c9f" },
        { label: rx === "KO" ? "Дет." : "АД", fill: rx === "KO" ? "#0c6b4f" : "#7554aa", sub: rx === "KO" ? "когер." : "огиб." },
        { label: "Строб", fill: "#62716b" },
        { label: "РУ", fill: "#e74c3c" },
      ];
    } else if (mod === "DCHM") {
      blocks = [
        { label: "ППФ₁,₂", fill: "#287c9f", sub: "f₁ и f₂" },
        { label: rx === "KO" ? "Дет.₁,₂" : "АД₁,₂", fill: rx === "KO" ? "#0c6b4f" : "#7554aa", sub: rx === "KO" ? "когер." : "огиб." },
        { label: "ВУ", fill: "#e8943a" },
        { label: "РУ", fill: "#e74c3c" },
      ];
    } else if (rx === "SF") {
      blocks = [
        { label: "ППФ", fill: "#287c9f" },
        { label: "ФД + ЛЗ", fill: "#0c6b4f", sub: "сравн. фаз" },
        { label: "Строб", fill: "#62716b" },
        { label: "РУ", fill: "#e74c3c" },
      ];
    } else {
      blocks = [
        { label: "ППФ", fill: "#287c9f" },
        { label: "ФД", fill: "#0c6b4f", sub: "когер." },
        { label: "ЛЗ", fill: "#62716b" },
        { label: "Сравн.", fill: "#e8943a", sub: "полярн." },
        { label: "РУ", fill: "#e74c3c" },
      ];
    }

    const totalWidth = blocks.length * boxW + (blocks.length - 1) * gap;
    let x = (W - totalWidth) / 2 - 40;
    ioLabel(x, "z(t)", "end");
    x += 36;
    arrow(x - 10, x);
    blocks.forEach((b, i) => {
      box(x, b.label, b.fill, b.sub);
      if (i < blocks.length - 1) {
        arrow(x + boxW, x + boxW + gap);
        x += boxW + gap;
      }
    });
    x += boxW;
    arrow(x, x + 10);
    ioLabel(x + 20, "b[k]", "start");

    // Опорное колебание для когерентных режимов
    if ((mod === "DAM" && rx === "KO") || (mod === "DOFM" && rx === "SP")) {
      const detX = (W - totalWidth) / 2 - 40 + 36 + boxW + gap / 2;
      svg += `<text x="${detX}" y="${yMid + boxH/2 + 26}" fill="#0c6b4f" font-family="monospace" font-size="12" text-anchor="middle">u_г(t)</text>`;
      svg += `<line x1="${detX}" y1="${yMid + boxH/2 + 12}" x2="${detX}" y2="${yMid + boxH/2}" stroke="#0c6b4f" stroke-width="1.6" />`;
      svg += `<path d="M ${detX - 4} ${yMid + boxH/2 + 6} L ${detX} ${yMid + boxH/2} L ${detX + 4} ${yMid + boxH/2 + 6}" fill="none" stroke="#0c6b4f" stroke-width="1.6" />`;
    }

    svg += `</svg>`;
    return svg;
  }

  function getReceiverSchemeNote(params) {
    const mod = params.modulation, rx = params.reception;
    const modeName = `${MOD_LABELS[mod] || mod}-${RX_LABELS[rx] || rx}`;
    const tract = {
      "DAM-KO": "z(t) \\to \\text{ППФ} \\to \\text{когерентный детектор} \\to \\text{РУ} \\to \\hat b_k^\\mu",
      "DAM-NO": "z(t) \\to \\text{ППФ} \\to \\text{детектор огибающей} \\to \\text{РУ} \\to \\hat b_k^\\mu",
      "DCHM-KO": "z(t) \\to \\text{ППФ}_{1,2} \\to \\text{когерентные детекторы} \\to \\text{ВУ} \\to \\text{РУ} \\to \\hat b_k^\\mu",
      "DCHM-NO": "z(t) \\to \\text{ППФ}_{1,2} \\to \\text{детекторы огибающей} \\to \\text{ВУ} \\to \\text{РУ} \\to \\hat b_k^\\mu",
      "DOFM-SF": "z(t) \\to \\text{ППФ} \\to \\text{фазовый детектор с ЛЗ} \\to \\text{РУ} \\to \\hat b_k^\\mu",
      "DOFM-SP": "z(t) \\to \\text{ППФ} \\to \\text{фазовый детектор} \\to \\text{ЛЗ} \\to \\text{сравнение полярностей} \\to \\hat b_k^\\mu",
    }[modeName] || "z(t) \\to \\text{ППФ} \\to \\text{демодулятор} \\to \\text{РУ} \\to \\hat b_k^\\mu";
    return `<div class="receiver-scheme-note">
      <p><strong>Используется эта схема, потому что выбран режим: ${modeName}.</strong></p>
      <p>\\( ${tract} \\)</p>
    </div>`;
  }

  function getReceiverDescription(params) {
    const mod = params.modulation, rx = params.reception;
    if (mod === "DAM" && rx === "KO")
      return "\\( z(t) \\to \\text{ППФ} \\to \\text{когерентный детектор} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), где \\(u_\\text{д}(t)=z(t)\\cdot u_\\text{г}(t)\\), \\(U_0=U_m/2\\)";
    if (mod === "DAM")
      return "\\( z(t) \\to \\text{ППФ} \\to \\text{детектор огибающей} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), \\(U_0=U_m/2\\)";
    if (mod === "DCHM" && rx === "KO")
      return "\\( z(t) \\to \\text{ППФ}_1(f_1) \\to \\text{ког. дет.}_1 \\to \\text{ВУ} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), аналогично \\(\\text{ППФ}_2(f_2)\\), \\(U_0=0\\)";
    if (mod === "DCHM")
      return "\\( z(t) \\to \\text{ППФ}_1(f_1) \\to \\text{дет. огиб.}_1 \\to \\text{ВУ} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), аналогично \\(\\text{ППФ}_2(f_2)\\), \\(U_0=0\\)";
    if (rx === "SF")
      return "\\( z(t) \\to \\text{ППФ} \\to \\text{фазовый детектор с ЛЗ} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), \\(U_0=0\\)";
    return "\\( z(t) \\to \\text{ППФ} \\to \\text{фазовый детектор с ФОН} \\to \\text{ЛЗ} \\to \\text{сравнение полярностей} \\to \\text{РУ} \\to \\hat b_k^\\mu \\), \\(U_0=0\\)";
  }

  function buildDecisionRuleBlock(params, u0_val) {
    const mod = params.modulation, rx = params.reception;
    const node = (label) => `<span class="decision-rule-node">${label}</span>`;
    const arrow = `<span class="decision-rule-arrow">→</span>`;
    if (mod === "DAM") {
      return `<div class="stage-panel__info-box decision-rule-box">
        <strong>Правило РУ (ДАМ):</strong>
        <span>РУ сравнивает \\(U_k\\) с порогом \\(U_0=${u0_val.toFixed(4)}\\) В. Если \\(U_k > U_0\\), принимается 1, иначе 0.</span>
        <span class="decision-rule-formula">\\( \\hat b_k = \\begin{cases} 1, & U_k > U_0 \\\\ 0, & U_k \\le U_0 \\end{cases} \\)</span>
      </div>`;
    }
    if (mod === "DCHM") {
      return `<div class="stage-panel__info-box decision-rule-box">
        <strong>Правило РУ (ДЧМ):</strong>
        <span>РУ сравнивает два отклика \\(U_{1,k}\\) и \\(U_{2,k}\\). Принимается тот символ, чей канал дал больший отклик.</span>
        <span class="decision-rule-formula">\\( \\hat b_k = \\begin{cases} 1, & U_{2,k} > U_{1,k} \\\\ 0, & U_{2,k} \\le U_{1,k} \\end{cases} \\)</span>
      </div>`;
    }
    if (rx === "SF") {
      return `<div class="stage-panel__info-box decision-rule-box">
        <strong>Правило РУ (ДОФМ-СФ):</strong>
        <span>Решение получается через сравнение фазы текущей и предыдущей посылки:</span>
        <span class="decision-rule-formula">\\( U_k = z_k \\cdot z_{k-1}, \\quad \\hat b_k = \\operatorname{sign}(U_k) \\)</span>
      </div>`;
    }
    return `<div class="stage-panel__info-box decision-rule-box">
      <strong>Правило РУ (ДОФМ-СП):</strong>
      <span>Решение получается через сравнение полярностей текущей и предыдущей посылки:</span>
      <div class="decision-rule-chain">${node("\\(d_k\\)")}${arrow}${node("\\(d_k \\cdot d_{k-1}\\)")}${arrow}${node("\\(\\operatorname{sign}\\)")}${arrow}${node("\\(\\hat b_k\\)")}</div>
    </div>`;
  }

  window.StageHandlers.detector = {
    process: function(params, SignalData) {
      const N = SignalData.z_t.length;
      const numBits = SignalData.b_t.length;
      const pointsPerBit = SignalData.radio_points_per_bit || (N / numBits);
      const carrierCycles = window.RadioMath.getCarrierCycles(params);

      const pErr = (window.Calculations && window.Calculations.computeErrorProbability)
        ? window.Calculations.computeErrorProbability({
            modulation: params.modulation,
            reception: params.reception,
            hSquared: parseFloat(params.signalNoiseRatio) || 8.5,
          })
        : getErrorProbability(params);
      SignalData.p_err_val = pErr.value;
      SignalData.p_err_formula = pErr;

      const u0 = params.modulation === "DAM" ? SignalData.Um / 2 : 0;
      SignalData.u0 = u0;
      SignalData.detectorTrace = [];
      SignalData.b_hat = [];
      SignalData.errors = [];
      SignalData.receiver_type = params.modulation + "-" + params.reception;
      SignalData.receiver_desc = getReceiverDescription(params);

      const mod = params.modulation;
      const rx = params.reception;

      // Промежуточные сигналы для визуализации
      const coherentDetects = [];   // d_k для ДОФМ-СП
      const channel1Values = [];    // E1 или env1 для ДЧМ
      const channel2Values = [];    // E2 или env2 для ДЧМ

      for (let i = 0; i < numBits; i++) {
        const startIdx = Math.floor(i * pointsPerBit);
        const endIdx = Math.floor((i + 1) * pointsPerBit);
        const intervalLength = Math.max(1, endIdx - startIdx);
        let decisionValue = 0;
        let decodedBit = 1;

        if (mod === "DAM") {
          if (rx === "KO") {
            // === ДАМ-КО: когерентный детектор (перемножитель + ФНЧ) ===
            // u_д = z(t) * u_г(t), где u_г(t) = sin(ω₀t) — опорное колебание
            let E = 0;
            for (let k = startIdx; k < endIdx; k++) {
              const tSymbol = (k - startIdx) / intervalLength;
              E += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.base * tSymbol);
            }
            decisionValue = (2 * E) / intervalLength;
          } else {
            // === ДАМ-НО: амплитудный детектор огибающей + ФНЧ ===
            // u_д = |z(t)| — выделение огибающей
            let envelope = 0;
            for (let k = startIdx; k < endIdx; k++) {
              envelope += Math.abs(SignalData.z_t[k]);
            }
            decisionValue = envelope / intervalLength;
          }
          decodedBit = decisionValue > u0 ? 1 : -1;
        }
        else if (mod === "DCHM") {
          if (rx === "KO") {
            // === ДЧМ-КО: два ППФ + два когерентных детектора + ВУ ===
            let E1 = 0, E2 = 0;
            for (let k = startIdx; k < endIdx; k++) {
              const tSymbol = (k - startIdx) / intervalLength;
              E1 += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.low * tSymbol);
              E2 += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.high * tSymbol);
            }
            const U1 = (2 * E1) / intervalLength;
            const U2 = (2 * E2) / intervalLength;
            channel1Values.push(U1);
            channel2Values.push(U2);
            decisionValue = U2 - U1;
          } else {
            // === ДЧМ-НО: два ППФ + два некогерентных детектора огибающей + ВУ ===
            // В каждом канале: I/Q-детектирование → |I+jQ| = огибающая
            let I1 = 0, Q1 = 0, I2 = 0, Q2 = 0;
            for (let k = startIdx; k < endIdx; k++) {
              const tSymbol = (k - startIdx) / intervalLength;
              const wLow = 2 * Math.PI * carrierCycles.low * tSymbol;
              const wHigh = 2 * Math.PI * carrierCycles.high * tSymbol;
              I1 += SignalData.z_t[k] * Math.sin(wLow);
              Q1 += SignalData.z_t[k] * Math.cos(wLow);
              I2 += SignalData.z_t[k] * Math.sin(wHigh);
              Q2 += SignalData.z_t[k] * Math.cos(wHigh);
            }
            const env1 = Math.sqrt(I1 * I1 + Q1 * Q1) / intervalLength;
            const env2 = Math.sqrt(I2 * I2 + Q2 * Q2) / intervalLength;
            channel1Values.push(env1);
            channel2Values.push(env2);
            decisionValue = env2 - env1;
          }
          decodedBit = decisionValue > 0 ? 1 : -1;
        }
        else { // DOFM
          if (rx === "SF") {
            // === ДОФМ-СФ: фазовый детектор с линией задержки τ_и ===
            // Сравнение фаз: U_k = (2/N) * Σ z_n * z_{n-N}
            // Для первого символа опорным считается синусоидальное колебание
            // с начальной фазой 0 (когерентное опорное колебание)
            let E = 0;
            if (i === 0) {
              for (let k = startIdx; k < endIdx; k++) {
                const tSymbol = (k - startIdx) / intervalLength;
                E += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.base * tSymbol);
              }
            } else {
              const prevStart = Math.floor((i - 1) * pointsPerBit);
              const prevEnd = Math.floor(i * pointsPerBit);
              const prevLength = Math.max(1, prevEnd - prevStart);
              for (let k = startIdx; k < endIdx; k++) {
                const prevIdx = prevStart + Math.min(prevLength - 1, k - startIdx);
                E += SignalData.z_t[k] * SignalData.z_t[prevIdx];
              }
            }
            decisionValue = (2 * E) / intervalLength;
            decodedBit = decisionValue > 0 ? 1 : -1;
          } else {
            // === ДОФМ-СП: фазовый детектор + ЛЗ + сравнение полярностей ===
            // Шаг 1: когерентное детектирование каждого бита
            // d_k = (2/N) * Σ z_n * sin(ω₀t_n) ∝ cos(phase_k)
            let E = 0;
            for (let k = startIdx; k < endIdx; k++) {
              const tSymbol = (k - startIdx) / intervalLength;
              E += SignalData.z_t[k] * Math.sin(2 * Math.PI * carrierCycles.base * tSymbol);
            }
            const d_k = (2 * E) / intervalLength;
            coherentDetects.push(d_k);
            // Шаг 2: сравнение полярностей текущей и предыдущей посылок
            // d_{-1} = +Um (начальная фаза 0 → cos(0) = 1)
            const d_prev = i === 0 ? SignalData.Um : coherentDetects[i - 1];
            decisionValue = d_k * d_prev;
            decodedBit = decisionValue > 0 ? 1 : -1;
          }
        }

        const originalBit = SignalData.b_t[i];
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

      SignalData.empirical_ber = numBits ? SignalData.errors.length / numBits : 0;
      SignalData.coherent_detects = coherentDetects;
      SignalData.detector_channel1 = channel1Values;
      SignalData.detector_channel2 = channel2Values;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W } = helpers;
      const zoom = window.RadioMath.getZoomInfo(SignalData, 10);
      const u0_val = params.modulation === "DAM" ? SignalData.Um / 2 : 0;

      // --- Функциональная схема приёмника ---
      const schemeSvg = buildReceiverSchemeSVG(params, W);
      const schemeNote = getReceiverSchemeNote(params);
      const schemeLayer = `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Функциональная схема приёмника</p>${schemeNote}${schemeSvg}</div>`;

      // --- Правило РУ ---
      const decisionRuleBlock = buildDecisionRuleBlock(params, u0_val);

      // --- Главный график решения: отклики / порог / стробы / биты ---
      const decisionH = 260;
      const traces = SignalData.detectorTrace.slice(zoom.start, zoom.end);
      const maxDecision = Math.max(1e-6, ...traces.map((trace) => Math.abs(trace.val)), Math.abs(u0_val), SignalData.Um || 0);
      const decisionY = (value) => decisionH / 2 - (value / maxDecision) * (decisionH * 0.32);
      const stepX = W / Math.max(1, traces.length);
      const barW = stepX * 0.5;
      let decisionSvg = `<svg viewBox="0 0 ${W} ${decisionH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      decisionSvg += window.VisualMath.axes(W, decisionH, decisionY(0), "k", "U_k");
      decisionSvg += `<line x1="0" y1="${decisionY(u0_val)}" x2="${W}" y2="${decisionY(u0_val)}" stroke="#e74c3c" stroke-width="2.2" stroke-dasharray="6,6" />`;
      decisionSvg += `<text x="${W - 10}" y="${decisionY(u0_val) - 6}" fill="#e74c3c" font-family="monospace" font-size="12" text-anchor="end">U0=${u0_val.toFixed(4)} В</text>`;
      traces.forEach((trace, index) => {
        const x = (index + 0.5) * stepX;
        const y = decisionY(trace.val);
        const y0 = decisionY(0);
        const bitLabel = trace.bit > 0 ? "1" : "0";
        const originalLabel = trace.originalBit > 0 ? "1" : "0";
        // строб — вертикальная линия
        decisionSvg += `<line x1="${x}" y1="18" x2="${x}" y2="${decisionH - 34}" stroke="rgba(98,113,107,0.22)" stroke-dasharray="3,6" />`;
        // столбец отклика
        decisionSvg += `<rect x="${x - barW / 2}" y="${Math.min(y, y0)}" width="${barW}" height="${Math.max(2, Math.abs(y - y0))}" fill="${trace.error ? "#e74c3c" : "#0c6b4f"}" fill-opacity="0.72" />`;
        decisionSvg += `<circle cx="${x}" cy="${y}" r="4.2" fill="${trace.error ? "#e74c3c" : "#0c6b4f"}" stroke="#ffffff" stroke-width="1.4" />`;
        // принятый бит
        decisionSvg += `<text x="${x}" y="${decisionH - 14}" fill="${trace.error ? "#e74c3c" : "#0c6b4f"}" font-family="monospace" font-size="14" text-anchor="middle" font-weight="bold">b̂=${bitLabel}${trace.error ? ` (${originalLabel})` : ""}</text>`;
        if (trace.error) {
          decisionSvg += `<line x1="${x - 7}" y1="${y - 12}" x2="${x + 7}" y2="${y + 2}" stroke="#e74c3c" stroke-width="2.4" stroke-linecap="round" />
            <line x1="${x + 7}" y1="${y - 12}" x2="${x - 7}" y2="${y + 2}" stroke="#e74c3c" stroke-width="2.4" stroke-linecap="round" />`;
        }
      });
      decisionSvg += `</svg>`;

      const errorsInWindow = traces.filter((trace) => trace.error).length;
      const responseMargin = params.modulation === "DCHM" && SignalData.detector_channel1.length
        ? Math.min(...SignalData.detector_channel1.slice(zoom.start, zoom.end).map((value, index) => Math.abs((SignalData.detector_channel2[zoom.start + index] || 0) - value)))
        : Math.min(...traces.map((trace) => Math.abs(trace.val - u0_val)));
      const decisionScale = `<dl class="visual-scale"><div><dt>Окно</dt><dd>биты ${zoom.start + 1}-${zoom.end}</dd></div><div><dt>${errorsInWindow ? "Ошибки" : "Запас"}</dt><dd>${errorsInWindow ? `${errorsInWindow} в окне` : `min=${Number.isFinite(responseMargin) ? responseMargin.toFixed(4) : "0.0000"}`}</dd></div><div><dt>Стробы</dt><dd>в середине символа</dd></div></dl>`;

      // --- ФПВ ---
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

      // --- Плоскость решений ---
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

      const pdfScale = `<dl class="visual-scale"><div><dt>\\(W_0\\)</dt><dd>отклик при передаче 0</dd></div><div><dt>\\(W_1\\)</dt><dd>отклик при передаче 1</dd></div><div><dt>Порог</dt><dd>\\(U_0=${u0_val.toFixed(4)}\\) В</dd></div></dl>`;
      const planeScaleNote = `<dl class="visual-scale"><div><dt>Точки</dt><dd>стробы текущего окна</dd></div><div><dt>Вертикаль</dt><dd>граница решения</dd></div><div><dt>Цвет</dt><dd>области 0 и 1</dd></div></dl>`;
      const pdfDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Статистика</span><strong>Дополнительно: распределения откликов W0(U), W1(U)</strong></summary><div class="visual-step__body">${pdfScale}${pdfSvg}</div></details>`;
      const planeDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Плоскость</span><strong>Показать плоскость решений по стробам</strong></summary><div class="visual-step__body">${planeScaleNote}${planeSvg}</div></details>`;

      return `<div class="stage-panel__visuals-stack">
        ${schemeLayer}
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">\\(z(t)\\) → отклик → строб → сравнение → \\(\\hat b_k^\\mu\\)</p>${decisionRuleBlock}${decisionScale}${decisionSvg}<p class="stage-panel__info-box">Приёмник не угадывает бит: решение получается из отсчёта отклика в момент стробирования.</p></div>
        <div class="stage-panel__visuals-layer">${pdfDetails}</div>
        <div class="stage-panel__visuals-layer">${planeDetails}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const pErr = SignalData.p_err_formula || getErrorProbability(params);
      const u0 = SignalData.u0 || 0;
      const pErrText = pErr.value > 0 ? pErr.value.toExponential(3).replace(".", "{,}") : "0";
      const empiricalBer = SignalData.empirical_ber || 0;
      const empiricalText = empiricalBer > 0 ? empiricalBer.toExponential(3).replace(".", "{,}") : "0";
      const bitCount = SignalData.b_t?.length || 0;
      const mod = params.modulation, rx = params.reception;
      const schemeDesc = SignalData.receiver_desc || getReceiverDescription(params);

      const branchReason = `Так как в варианте выбрана ${MOD_LABELS[mod] || mod} и режим приёма ${RX_LABELS[rx] || rx}, используется тракт: ${schemeDesc}.`;
      let theory = `Детектор принимает решение по стробам внутри битовых интервалов. Функциональная схема вверху карточки показывает физический тракт приёмника для выбранной пары «модуляция + способ приёма». Ошибочный такт подсвечивается, когда восстановленный бит не совпал с переданным.`;
      let formulas = `<div class="formula-preview"><span>Порог решающего устройства</span>\\[ ${mod === "DAM" ? `U_0=\\frac{U_m}{2}=\\frac{${toLatexNumber((SignalData.Um || 0).toFixed(4))}}{2}=${toLatexNumber(u0.toFixed(4))}\\text{ В}` : `U_0=0\\text{ В}`} \\]</div>`;

      if (mod === "DAM") {
        if (rx === "KO") {
          formulas += `<div class="formula-preview"><span>Когерентный детектор (перемножитель + ФНЧ)</span>\\[ u_\\text{д}(t)=z(t)\\cdot u_\\text{г}(t),\\quad u_\\text{г}(t)=\\sin(\\omega_0 t) \\]\\[ U_k=\\frac{2}{N_k}\\sum_{n\\in k}z_n\\sin(\\omega_0 t_n),\\quad \\hat b_k=\\begin{cases}1,&U_k\\ge U_0\\\\0,&U_k<U_0\\end{cases} \\]</div>`;
        } else {
          formulas += `<div class="formula-preview"><span>Амплитудный детектор огибающей + ФНЧ</span>\\[ u_\\text{д}(t)=|z(t)|,\\quad U_k=\\frac{1}{N_k}\\sum_{n\\in k}|z_n| \\]\\[ \\hat b_k=\\begin{cases}1,&U_k\\ge U_0\\\\0,&U_k<U_0\\end{cases} \\]</div>`;
        }
      } else if (mod === "DCHM") {
        if (rx === "KO") {
          formulas += `<div class="formula-preview"><span>Два ППФ + два когерентных детектора + ВУ</span>\\[ U_{1k}=\\frac{2}{N_k}\\sum_{n\\in k}z_n\\sin(\\omega_1 t_n),\\quad U_{2k}=\\frac{2}{N_k}\\sum_{n\\in k}z_n\\sin(\\omega_2 t_n) \\]\\[ U_k=U_{2k}-U_{1k},\\quad \\hat b_k=\\operatorname{sign}(U_k) \\]</div>`;
        } else {
          formulas += `<div class="formula-preview"><span>Два ППФ + два некогерентных детектора огибающей + ВУ</span>\\[ I_r=\\sum z_n\\sin(\\omega_r t_n),\\quad Q_r=\\sum z_n\\cos(\\omega_r t_n),\\quad U_{rk}=\\frac{\\sqrt{I_r^2+Q_r^2}}{N_k} \\]\\[ U_k=U_{2k}-U_{1k},\\quad \\hat b_k=\\operatorname{sign}(U_k) \\]</div>`;
        }
      } else { // DOFM
        if (rx === "SF") {
          formulas += `<div class="formula-preview"><span>Метод сравнения фаз (фазовый детектор с ЛЗ)</span>\\[ U_k=\\frac{2}{N_k}\\sum_{n\\in k}z_n\\cdot z_{n-N_k},\\quad \\hat b_k=\\operatorname{sign}(U_k) \\]</div>`;
        } else {
          formulas += `<div class="formula-preview"><span>Шаг 1: когерентное детектирование (фазовый детектор + ФОН)</span>\\[ d_k=\\frac{2}{N_k}\\sum_{n\\in k}z_n\\sin(\\omega_0 t_n)\\propto\\cos(\\varphi_k) \\]</div>`;
          formulas += `<div class="formula-preview"><span>Шаг 2: сравнение полярностей</span>\\[ U_k=d_k\\cdot d_{k-1},\\quad \\hat b_k=\\begin{cases}1,&U_k\\ge 0\\\\0,&U_k<0\\end{cases} \\]</div>`;
        }
      }

      formulas += `<div class="formula-preview"><span>Вероятность ошибки (${pErr.label})</span>\\[ ${pErr.latex}, \\quad h=\\sqrt{${toLatexNumber(pErr.h2)}}=${toLatexNumber(pErr.h.toFixed(4))}, \\quad p_{\\text{ош}}\\approx ${pErrText} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ошибки показанной реализации</span>\\[ N_{ош}=${SignalData.errors.length},\\quad N_b=${bitCount},\\quad BER_{эмп}=\\frac{N_{ош}}{N_b}=${empiricalText} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему этот тракт:</strong><br>${branchReason}</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Каждый \\(U_k\\) вычислен непосредственно из показанного \\(z(t)\\) по алгоритму выбранного тракта. Красный крест появляется только тогда, когда реальное пороговое решение не совпало с переданным битом. Теоретическое \\(p_{\\text{ош}}\\) не назначает ошибки, а служит ориентиром; на короткой реализации \\(BER_{эмп}\\) может отличаться.</div>`;
      return { theory, formulas };
    }
  };
})();
