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

  // === Функциональная схема приёмника для каждой пары модуляция + способ приёма ===
  function buildReceiverSchemeSVG(params, W) {
    const H = 110;
    const mod = params.modulation;
    const rx = params.reception;
    const boxW = 72, boxH = 28, gap = 14;
    const yMid = H / 2 - 4;
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg receiver-scheme">`;

    const box = (x, label, fill, sub) => {
      const cy = yMid;
      svg += `<rect x="${x}" y="${cy - boxH/2}" width="${boxW}" height="${boxH}" rx="6" fill="${fill}" stroke="#1f2b26" stroke-width="1.2" />`;
      svg += `<text x="${x + boxW/2}" y="${cy + (sub ? -2 : 4)}" fill="#ffffff" font-family="monospace" font-size="10" text-anchor="middle" font-weight="bold">${label}</text>`;
      if (sub) svg += `<text x="${x + boxW/2}" y="${cy + 10}" fill="#e8f0ed" font-family="monospace" font-size="8" text-anchor="middle">${sub}</text>`;
    };
    const arrow = (x1, x2, y = yMid) => {
      svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#31433b" stroke-width="1.4" />`;
      svg += `<path d="M ${x2 - 5} ${y - 3} L ${x2} ${y} L ${x2 - 5} ${y + 3}" fill="none" stroke="#31433b" stroke-width="1.4" />`;
    };
    const label = (x, text, y = yMid + 4, color = "#287c9f", size = 11) => {
      svg += `<text x="${x}" y="${y}" fill="${color}" font-family="monospace" font-size="${size}" text-anchor="middle">${text}</text>`;
    };

    if (mod === "DAM") {
      let x = 50;
      label(x - 18, "z(t)", yMid, "#287c9f", 12);
      arrow(x - 8, x);
      box(x, "ППФ", "#287c9f");
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;
      const detFill = rx === "KO" ? "#0c6b4f" : "#7554aa";
      const detSub = rx === "KO" ? "когерентн." : "огибающей";
      box(x, "Детектор", detFill, detSub);
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;
      box(x, "Дискрет.", "#62716b");
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;
      box(x, "РУ", "#e74c3c");
      arrow(x + boxW, x + boxW + gap + 4);
      x += boxW + gap;
      label(x + 4, "b̂ₖᵘ", yMid, "#0c6b4f", 12);
      if (rx === "KO") {
        const detX = 50 + boxW + gap;
        svg += `<text x="${detX + boxW/2}" y="${yMid + boxH/2 + 22}" fill="#0c6b4f" font-family="monospace" font-size="10" text-anchor="middle">u_г(t)</text>`;
        svg += `<line x1="${detX + boxW/2}" y1="${yMid + boxH/2 + 10}" x2="${detX + boxW/2}" y2="${yMid + boxH/2}" stroke="#0c6b4f" stroke-width="1.4" />`;
        svg += `<path d="M ${detX + boxW/2 - 3} ${yMid + boxH/2 + 5} L ${detX + boxW/2} ${yMid + boxH/2} L ${detX + boxW/2 + 3} ${yMid + boxH/2 + 5}" fill="none" stroke="#0c6b4f" stroke-width="1.4" />`;
      }
      svg += `<text x="${x - boxW - gap + 12}" y="${yMid + boxH/2 + 18}" fill="#62716b" font-family="monospace" font-size="9">U₀ = Um/2</text>`;
    }
    else if (mod === "DCHM") {
      const y1 = yMid - 22, y2 = yMid + 22;
      let x = 50;
      label(x - 18, "z(t)", yMid, "#287c9f", 12);
      arrow(x - 8, x, y1);
      arrow(x - 8, x, y2);
      box(x, "ППФ₂", "#287c9f", "f₂");
      const x2 = x + boxW + gap;
      box(x2, "ППФ₁", "#287c9f", "f₁");
      arrow(x + boxW, x + boxW + gap, y1);
      arrow(x2 + boxW, x2 + boxW + gap, y2);
      const detFill = rx === "KO" ? "#0c6b4f" : "#7554aa";
      const detSub = rx === "KO" ? "когерентн." : "огибающей";
      const d1X = x + boxW + gap;
      box(d1X, "Дет.₂", detFill, detSub);
      const d2X = x2 + boxW + gap;
      box(d2X, "Дет.₁", detFill, detSub);
      const vuX = Math.max(d1X, d2X) + boxW + gap;
      arrow(d1X + boxW, vuX, y1);
      arrow(d2X + boxW, vuX, y2);
      box(vuX, "ВУ", "#e8943a");
      arrow(vuX + boxW, vuX + boxW + gap, yMid);
      const discX = vuX + boxW + gap;
      box(discX, "Дискрет.", "#62716b");
      arrow(discX + boxW, discX + boxW + gap, yMid);
      const ruX = discX + boxW + gap;
      box(ruX, "РУ", "#e74c3c");
      arrow(ruX + boxW, ruX + boxW + gap + 4, yMid);
      label(ruX + boxW + gap + 4, "b̂ₖᵘ", yMid, "#0c6b4f", 12);
      svg += `<text x="${ruX - boxW - gap + 12}" y="${yMid + boxH/2 + 18}" fill="#62716b" font-family="monospace" font-size="9">U₀ = 0</text>`;
    }
    else { // DOFM
      let x = 50;
      label(x - 18, "z(t)", yMid, "#287c9f", 12);
      arrow(x - 8, x);
      box(x, "ППФ", "#287c9f");
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;

      if (rx === "SF") {
        box(x, "Фазовый", "#0c6b4f", "детектор");
        const lzX = x;
        svg += `<rect x="${x + boxW + 4}" y="${yMid + boxH/2 + 4}" width="52" height="22" rx="4" fill="#62716b" stroke="#1f2b26" stroke-width="1" />`;
        svg += `<text x="${x + boxW + 30}" y="${yMid + boxH/2 + 18}" fill="#ffffff" font-family="monospace" font-size="9" text-anchor="middle">ЛЗ τ_и</text>`;
        svg += `<line x1="${x + boxW/2}" y1="${yMid + boxH/2}" x2="${x + boxW/2}" y2="${yMid + boxH/2 + 16}" stroke="#62716b" stroke-width="1.4" />`;
        svg += `<line x1="${x + boxW/2}" y1="${yMid + boxH/2 + 16}" x2="${x + boxW + 4}" y2="${yMid + boxH/2 + 16}" stroke="#62716b" stroke-width="1.4" />`;
        svg += `<line x1="${x + boxW + 4}" y1="${yMid + boxH/2 + 16}" x2="${x + boxW + 4}" y2="${yMid + boxH/2}" stroke="#62716b" stroke-width="1.4" />`;
        svg += `<path d="M ${x + boxW + 1} ${yMid + boxH/2 - 3} L ${x + boxW + 4} ${yMid + boxH/2} L ${x + boxW + 7} ${yMid + boxH/2 - 3}" fill="none" stroke="#62716b" stroke-width="1.4" />`;
      } else {
        box(x, "Фазовый", "#0c6b4f", "детектор");
        const fonX = x + boxW/2;
        svg += `<text x="${fonX}" y="${yMid + boxH/2 + 22}" fill="#0c6b4f" font-family="monospace" font-size="9" text-anchor="middle">u_г(t) (ФОН)</text>`;
        svg += `<line x1="${fonX}" y1="${yMid + boxH/2 + 10}" x2="${fonX}" y2="${yMid + boxH/2}" stroke="#0c6b4f" stroke-width="1.4" />`;
        svg += `<path d="M ${fonX - 3} ${yMid + boxH/2 + 5} L ${fonX} ${yMid + boxH/2} L ${fonX + 3} ${yMid + boxH/2 + 5}" fill="none" stroke="#0c6b4f" stroke-width="1.4" />`;
      }
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;

      if (rx === "SP") {
        box(x, "ЛЗ τ_и", "#62716b");
        arrow(x + boxW, x + boxW + gap);
        x += boxW + gap;
        box(x, "Сравн.", "#e8943a", "полярн.");
        arrow(x + boxW, x + boxW + gap);
        x += boxW + gap;
      }

      box(x, "Дискрет.", "#62716b");
      arrow(x + boxW, x + boxW + gap);
      x += boxW + gap;
      box(x, "РУ", "#e74c3c");
      arrow(x + boxW, x + boxW + gap + 4);
      x += boxW + gap;
      label(x + 4, "b̂ₖᵘ", yMid, "#0c6b4f", 12);
      svg += `<text x="${x - boxW - gap + 12}" y="${yMid + boxH/2 + 18}" fill="#62716b" font-family="monospace" font-size="9">U₀ = 0</text>`;
    }

    svg += `</svg>`;
    return svg;
  }

  function getReceiverDescription(params) {
    const mod = params.modulation, rx = params.reception;
    if (mod === "DAM" && rx === "KO")
      return "z(t) → ППФ → когерентный детектор (перемножитель с опорным колебанием u_г(t) + ФНЧ) → дискретизатор → РУ (порог U₀ = U_m/2)";
    if (mod === "DAM")
      return "z(t) → ППФ → амплитудный детектор огибающей + ФНЧ → дискретизатор → РУ (порог U₀ = U_m/2)";
    if (mod === "DCHM" && rx === "KO")
      return "z(t) → ППФ₁(f₁) → когерентный детектор₁ ─┐ → ВУ → дискретизатор → РУ (порог U₀ = 0). Аналогично ППФ₂(f₂) → детектор₂";
    if (mod === "DCHM")
      return "z(t) → ППФ₁(f₁) → амплитудный детектор₁ огибающей ─┐ → ВУ → дискретизатор → РУ (порог U₀ = 0). Аналогично ППФ₂(f₂) → детектор₂";
    if (rx === "SF")
      return "z(t) → ППФ → фазовый детектор с линией задержки τ_и (сравнение фаз текущей и предыдущей посылок) → дискретизатор → РУ (порог U₀ = 0)";
    return "z(t) → ППФ → фазовый детектор с ФОН → ЛЗ τ_и → сравнение полярностей → дискретизатор → РУ (порог U₀ = 0)";
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
      const { W, getX } = helpers;
      const zoom = window.RadioMath.getZoomInfo(SignalData, 5);
      const bitStepX = W / Math.max(1, zoom.length);
      const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;

      // --- Функциональная схема приёмника ---
      const schemeSvg = buildReceiverSchemeSVG(params, W);
      const schemeDesc = SignalData.receiver_desc || getReceiverDescription(params);
      const schemeLayer = `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#1f2b26">Функциональная схема демодулятора (${params.modulation}-${params.reception})</strong></p><div class="receiver-scheme-note">${schemeDesc}</div>${schemeSvg}</div>`;

      // --- z(t) с стробами ---
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

      // --- b̂(t) ---
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

      // --- Отклики детектора U_k ---
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

      // --- Промежуточный график для ДОФМ-СП: когерентные отклики d_k ---
      let intermediateLayer = "";
      if (params.modulation === "DOFM" && params.reception === "SP" && SignalData.coherent_detects) {
        const intH = 180;
        const detects = SignalData.coherent_detects.slice(zoom.start, zoom.end);
        const maxD = Math.max(1e-6, ...detects.map(Math.abs), SignalData.Um || 0);
        const intY = (value) => intH / 2 - (value / maxD) * (intH * 0.38);
        let intSvg = `<svg viewBox="0 0 ${W} ${intH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
        intSvg += window.VisualMath.axes(W, intH, intY(0), "k", "d_k");
        const dBarW = W / Math.max(1, detects.length) * 0.48;
        detects.forEach((d, index) => {
          const x = (index + 0.5) * (W / Math.max(1, detects.length));
          const y = intY(d);
          const y0 = intY(0);
          intSvg += `<rect x="${x - dBarW / 2}" y="${Math.min(y, y0)}" width="${dBarW}" height="${Math.max(2, Math.abs(y - y0))}" fill="#287c9f" fill-opacity="0.6" />
            <circle cx="${x}" cy="${y}" r="3.5" fill="#287c9f" stroke="#ffffff" stroke-width="1.2" />`;
        });
        intSvg += `</svg>`;
        const intScale = `<dl class="visual-scale"><div><dt>Шаг 1</dt><dd>когерентное детектирование</dd></div><div><dt>d_k</dt><dd>∝ cos(φ_k)</dd></div><div><dt>Шаг 2</dt><dd>U_k = d_k · d_{k-1}</dd></div></dl>`;
        intermediateLayer = `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Шаг 1: когерентные отклики d_k (до сравнения полярностей)</p>${intScale}${intSvg}</div>`;
      }

      // --- Промежуточный график для ДЧМ: отклики двух каналов ---
      if (params.modulation === "DCHM" && SignalData.detector_channel1.length > 0) {
        const intH = 180;
        const ch1 = SignalData.detector_channel1.slice(zoom.start, zoom.end);
        const ch2 = SignalData.detector_channel2.slice(zoom.start, zoom.end);
        const maxCh = Math.max(1e-6, ...ch1.map(Math.abs), ...ch2.map(Math.abs), SignalData.Um || 0);
        const intY = (value) => intH / 2 - (value / maxCh) * (intH * 0.38);
        let intSvg = `<svg viewBox="0 0 ${W} ${intH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
        intSvg += window.VisualMath.axes(W, intH, intY(0), "k", "U");
        const dBarW = W / Math.max(1, ch1.length) * 0.36;
        ch1.forEach((v, index) => {
          const x = (index + 0.5) * (W / Math.max(1, ch1.length)) - dBarW * 0.55;
          const y = intY(v); const y0 = intY(0);
          intSvg += `<rect x="${x}" y="${Math.min(y, y0)}" width="${dBarW}" height="${Math.max(2, Math.abs(y - y0))}" fill="#287c9f" fill-opacity="0.6" />`;
        });
        ch2.forEach((v, index) => {
          const x = (index + 0.5) * (W / Math.max(1, ch2.length)) + dBarW * 0.55;
          const y = intY(v); const y0 = intY(0);
          intSvg += `<rect x="${x - dBarW}" y="${Math.min(y, y0)}" width="${dBarW}" height="${Math.max(2, Math.abs(y - y0))}" fill="#0c6b4f" fill-opacity="0.6" />`;
        });
        intSvg += `</svg>`;
        const detTypeName = params.reception === "KO" ? "когерентные отклики" : "огибающие";
        const intScale = `<dl class="visual-scale"><div><dt>Синий</dt><dd>U₁ (ППФ₂, f₂)</dd></div><div><dt>Зелёный</dt><dd>U₂ (ППФ₁, f₁)</dd></div><div><dt>Тип</dt><dd>${detTypeName}</dd></div></dl>`;
        intermediateLayer = `<div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отклики двух каналов детектора (до вычитающего устройства)</p>${intScale}${intSvg}</div>`;
      }

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

      const decisionScale = `<dl class="visual-scale"><div><dt>Отклик</dt><dd>U_k после детектора</dd></div><div><dt>Правило</dt><dd>1, если U_k ≥ U0</dd></div><div><dt>Ошибки</dt><dd>${SignalData.errors.length} битов в текущем прогоне</dd></div></dl>`;
      const pdfScale = `<dl class="visual-scale"><div><dt>W0</dt><dd>отклик при передаче 0</dd></div><div><dt>W1</dt><dd>отклик при передаче 1</dd></div><div><dt>Порог</dt><dd>U0=${u0_val.toFixed(4)} В</dd></div></dl>`;
      const planeScaleNote = `<dl class="visual-scale"><div><dt>Точки</dt><dd>стробы текущего окна</dd></div><div><dt>Вертикаль</dt><dd>граница решения</dd></div><div><dt>Цвет</dt><dd>области 0 и 1</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        ${schemeLayer}
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#287c9f">Зашумленный сигнал z(t) и стробы</strong></p>${scaleNote}${topSVG}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отклики детектора U_k и порог решения</p>${decisionScale}${decisionSvg}</div>
        ${intermediateLayer}
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Условные ФПВ W0(U) и W1(U)</p>${pdfScale}${pdfSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Плоскость решений по стробам</p>${planeScaleNote}${planeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Оценка битов b̂(t)</strong></p>${botSVG}</div>
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

      const branchReason = `Так как в варианте выбрана ${mod} и режим приёма ${rx}, используется тракт: ${schemeDesc}.`;
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

      formulas += `<div class="formula-preview"><span>Вероятность ошибки (${pErr.label})</span>\\[ ${pErr.latex}, \\quad h=\\sqrt{${toLatexNumber(pErr.h2)}}=${toLatexNumber(pErr.h.toFixed(4))}, \\quad p_{ош}\\approx ${pErrText} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ошибки показанной реализации</span>\\[ N_{ош}=${SignalData.errors.length},\\quad N_b=${bitCount},\\quad BER_{эмп}=\\frac{N_{ош}}{N_b}=${empiricalText} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему этот тракт:</strong><br>${branchReason}</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Каждый \\(U_k\\) вычислен непосредственно из показанного \\(z(t)\\) по алгоритму выбранного тракта. Красный крест появляется только тогда, когда реальное пороговое решение не совпало с переданным битом. Теоретическое \\(p_{ош}\\) не назначает ошибки, а служит ориентиром; на короткой реализации \\(BER_{эмп}\\) может отличаться.</div>`;
      return { theory, formulas };
    }
  };
})();
