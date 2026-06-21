(function() {
    'use strict';
    window.StageHandlers = window.StageHandlers || {};

    window.RadioMath = window.RadioMath || (function() {
      function safeNumber(value, fallback) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }

      function getDigitalBandwidth(params) {
        return (window.SignalData?.calculation || window.SystemCalculations.calculate(params)).coding.dfPcm;
      }

      function getBandwidthParams(params) {
        const calculation = window.SignalData?.calculation || window.SystemCalculations.calculate(params);
        return {
          fd: calculation.sampling.fd,
          mu: calculation.coding.mu,
          tauSim: calculation.coding.tauSim,
          k1: calculation.coding.k1,
          df_pcm: calculation.coding.dfPcm,
          df_s: calculation.radio.dfSignal,
          deltaCarrierKhz: calculation.radio.deltaCarrierKhz,
          description: calculation.radio.bandwidthDescription,
          formulaLatex: calculation.radio.bandwidthFormulaLatex,
        };
      }

      function getPowerParams(params) {
        const bandwidth = getBandwidthParams(params);
        const calculation = window.SignalData?.calculation || window.SystemCalculations.calculate(params);
        return {
          ...bandwidth,
          N0: calculation.input.N0,
          h2: calculation.input.h2,
          P_sh: calculation.radio.noisePower,
          P_c: calculation.radio.signalPower,
          symbolPower: calculation.radio.symbolPower,
          Um: calculation.radio.Um,
          sigmaNoise: calculation.radio.sigmaNoise,
          capacity: calculation.radio.capacity,
        };
      }

      function getCarrierMHz(params, bit = 1) {
        const f0 = safeNumber(params.primaryFrequency, 60);
        const f1 = safeNumber(params.secondaryFrequency, f0 + 1.5);
        if (params.modulation === "DCHM") return bit > 0 ? Math.max(f0, f1) : Math.min(f0, f1);
        return f0;
      }

      function getSpectrumPeaks(params) {
        const power = getPowerParams(params);
        const dfMHz = power.df_pcm / 1000;
        const f0 = safeNumber(params.primaryFrequency, 60);
        const f1 = safeNumber(params.secondaryFrequency, f0 + 1.5);
        const sideOrders = [1, 3, 5, 7];
        const peaks = [];
        const pushSidebands = (carrier, scale = 1) => {
          peaks.push({ f: carrier, a: scale, kind: "carrier" });
          sideOrders.forEach((order) => {
            const amp = scale * (1 / order);
            peaks.push({ f: carrier - order * dfMHz, a: amp, kind: "side" });
            peaks.push({ f: carrier + order * dfMHz, a: amp, kind: "side" });
          });
        };
        if (params.modulation === "DCHM") {
          pushSidebands(Math.min(f0, f1), 0.82);
          pushSidebands(Math.max(f0, f1), 0.82);
        } else if (params.modulation === "DAM") {
          pushSidebands(f0, 1);
        } else {
          sideOrders.forEach((order) => {
            const amp = 1 / order;
            peaks.push({ f: f0 - order * dfMHz, a: amp, kind: "side" });
            peaks.push({ f: f0 + order * dfMHz, a: amp, kind: "side" });
          });
          peaks.push({ f: f0, a: 0.35, kind: "carrier" });
        }
        return peaks.sort((a, b) => a.f - b.f);
      }

      function toCarrierCyclesPerBit(frequency, fallback = 60) {
        const value = parseFloat(frequency);
        const frequencyValue = Number.isFinite(value) && value > 0 ? value : fallback;
        return Math.min(3.0, Math.max(1.8, 2.4 * Math.pow(frequencyValue / 60, 0.15)));
      }

      function getCarrierCycles(params) {
        const primary = parseFloat(params.primaryFrequency) || 60;
        const secondary = parseFloat(params.secondaryFrequency) || primary * 1.02;

        if (params.modulation !== "DCHM") {
            const base = toCarrierCyclesPerBit(primary);
            return { base, low: base, high: base };
        }

        const lowFrequency = Math.min(primary, secondary);
        const highFrequency = Math.max(primary, secondary);
        const lowPerBit = toCarrierCyclesPerBit(lowFrequency, primary);
        const highPerBit = Math.min(2.8, Math.max(lowPerBit + 0.35, toCarrierCyclesPerBit(highFrequency, secondary)));
        return { base: lowPerBit, low: lowPerBit, high: highPerBit };
      }

      function getVisualFrequencyNote(params) {
        const cycles = getCarrierCycles(params);
        if (params.modulation === "DCHM") {
          return `Примечание для визуализации: реальные частоты f1/f2 дали бы слишком плотную радиоволну. Поэтому график использует нормализованное время: ${cycles.low.toFixed(2)} и ${cycles.high.toFixed(2)} периода на один битовый символ.`;
        }
        return `Примечание для визуализации: реальная частота f0 вызвала бы сплошную заливку экрана. Поэтому график использует нормализованное время: fvis ≈ ${(cycles.base * 5).toFixed(1)} периодов на экран синхронной лупы.`;
      }

      function toLatexFixed(value, digits = 4) {
        return Number(value).toFixed(digits).replace(".", "{,}");
      }

      function getZoomInfo(SignalData, size = 5) {
        const zoom = window.VisualMath.getZoomWindow(SignalData, size);
        const numBits = Math.max(1, SignalData.b_t?.length || 1);
        const radioN = SignalData.radio_N || SignalData.N;
        const pointsPerBit = SignalData.radio_points_per_bit || (radioN / numBits);
        const startIdx = Math.max(0, Math.floor(zoom.start * pointsPerBit));
        const endIdx = Math.min(radioN - 1, Math.max(startIdx + 1, Math.ceil(zoom.end * pointsPerBit)));
        return { ...zoom, pointsPerBit, startIdx, endIdx };
      }

      return { safeNumber, getDigitalBandwidth, getBandwidthParams, getPowerParams, getCarrierMHz, getSpectrumPeaks, getCarrierCycles, getVisualFrequencyNote, toLatexFixed, getZoomInfo };
    })();

    // ==========================================
    // Блок 06: Модулятор
    // ==========================================
    window.StageHandlers.modulator = {
        process: function(params, SignalData) {
            const numBits = SignalData.b_t.length;
            const pointsPerBit = (SignalData.calculation || window.SystemCalculations.calculate(params)).runtime.radioSamplesPerBit;
            const N = Math.max(1, numBits * pointsPerBit);
            SignalData.radio_N = N;
            SignalData.radio_points_per_bit = pointsPerBit;

            // Визуальные частоты сохраняют физический смысл: выше частота в форме — больше периодов на графике.
            const carrierCycles = window.RadioMath.getCarrierCycles(params);

            const power = window.RadioMath.getPowerParams(params);
            SignalData.df_s = power.df_s;
            SignalData.P_sh = power.P_sh;
            SignalData.P_c = power.P_c;
            SignalData.Um = power.Um;
            SignalData.noiseSigma = power.sigmaNoise;

            SignalData.S_t = new Array(N).fill(0);
            
            // Предрасчет фаз для ДОФМ
            let currentPhase = 0;
            const dofm_phases = [];
            for (let i = 0; i < numBits; i++) {
                if (SignalData.b_t[i] < 0) {
                    currentPhase = (currentPhase + Math.PI) % (2 * Math.PI);
                }
                dofm_phases.push(currentPhase);
            }

            // Генерация радиоволны (нормализованное время)
            SignalData.modulation_symbols = [];
            for (let i = 0; i < N; i++) {
                let bitIdx = Math.floor(i / pointsPerBit);
                if (bitIdx >= numBits) bitIdx = numBits - 1;
                
                let bit = SignalData.b_t[bitIdx];
                let tSymbol = (i - bitIdx * pointsPerBit) / pointsPerBit;
                let w_t = 2 * Math.PI * carrierCycles.base * tSymbol;

                if (params.modulation === "DAM") {
                    SignalData.S_t[i] = bit > 0 ? power.Um * Math.sin(w_t) : 0;
                } else if (params.modulation === "DCHM") {
                    let f_current = bit > 0 ? carrierCycles.high : carrierCycles.low;
                    SignalData.S_t[i] = power.Um * Math.sin(2 * Math.PI * f_current * tSymbol);
                } else if (params.modulation === "DOFM") {
                    let phase = dofm_phases[bitIdx];
                    SignalData.S_t[i] = power.Um * Math.sin(w_t + phase);
                }
            }
            for (let bitIdx = 0; bitIdx < numBits; bitIdx++) {
                const bit = SignalData.b_t[bitIdx];
                SignalData.modulation_symbols.push({
                    bit,
                    amplitude: params.modulation === "DAM" && bit < 0 ? 0 : power.Um,
                    frequencyMHz: window.RadioMath.getCarrierMHz(params, bit),
                    phase: params.modulation === "DOFM" ? dofm_phases[bitIdx] : 0,
                });
            }
        },

        renderSVG: function(id, params, helpers, SignalData) {
            const { W } = helpers;
            const zoom = window.RadioMath.getZoomInfo(SignalData, 10);
            const bitStepX = W / Math.max(1, zoom.length);
            const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;

            let maxS = Math.max(SignalData.Um || 0, ...SignalData.S_t.map(Math.abs));
            if (maxS === 0) maxS = 1;
            const rowH = 72;
            const oscH = rowH * 3 + 18;
            const rowCenter = (row) => 18 + row * rowH + rowH / 2;
            const carrierCycles = window.RadioMath.getCarrierCycles(params);
            const visualSignal = [];
            let fskPhase = 0;
            for (let i = zoom.startIdx; i <= zoom.endIdx; i++) {
              const bitIdx = Math.min(SignalData.b_t.length - 1, Math.max(0, Math.floor(i / zoom.pointsPerBit)));
              const bit = SignalData.b_t[bitIdx] > 0 ? 1 : -1;
              if (params.modulation === "DCHM") {
                const cycles = bit > 0 ? carrierCycles.high : carrierCycles.low;
                fskPhase += 2 * Math.PI * cycles / zoom.pointsPerBit;
                visualSignal.push(SignalData.Um * Math.sin(fskPhase));
              } else {
                const carrierPhase = 2 * Math.PI * carrierCycles.base * (i / zoom.pointsPerBit);
                const symbolPhase = params.modulation === "DOFM" ? (SignalData.modulation_symbols?.[bitIdx]?.phase || 0) : 0;
                const amplitude = params.modulation === "DAM" && bit < 0 ? 0 : SignalData.Um;
                visualSignal.push(amplitude * Math.sin(carrierPhase + symbolPhase));
              }
            }
            const drawRowCurve = (fn, color, width = 2.2) => {
              let d = "";
              for (let i = zoom.startIdx; i <= zoom.endIdx; i++) {
                const x = xOfIndex(i);
                const y = fn(i);
                d += `${d ? "L" : "M"} ${x} ${y} `;
              }
              return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linejoin="round" />`;
            };
            const bitAtIndex = (index) => {
              const bitIdx = Math.min(SignalData.b_t.length - 1, Math.max(0, Math.floor(index / zoom.pointsPerBit)));
              return SignalData.b_t[bitIdx] > 0 ? 1 : -1;
            };
            let oscSvg = `<svg viewBox="0 0 ${W} ${oscH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            oscSvg += `<rect x="1" y="1" width="${W - 2}" height="${oscH - 2}" fill="none" stroke="#1f2b26" stroke-width="1.4" />`;
            for (let row = 0; row < 3; row++) {
              const cy = rowCenter(row);
              oscSvg += `<line x1="0" y1="${cy}" x2="${W}" y2="${cy}" stroke="#1f2b26" stroke-width="1.2" />
                <text x="14" y="${cy - 14}" fill="#31433b" font-family="monospace" font-size="14">${row === 0 ? "b[k]" : row === 1 ? "u_н(t)" : "S(t)"}</text>`;
            }
            for (let i = 0; i <= zoom.length; i++) {
              const x = i * bitStepX;
              oscSvg += `<line x1="${x}" y1="1" x2="${x}" y2="${oscH - 1}" stroke="#b8c0bc" stroke-width="1" stroke-dasharray="4,7" />`;
            }
            let bitD = "";
            for (let i = 0; i < zoom.length; i++) {
              const bit = zoom.bits[i] > 0 ? 1 : -1;
              const x1 = i * bitStepX;
              const x2 = (i + 1) * bitStepX;
              const y = rowCenter(0) - bit * rowH * 0.26;
              if (i === 0) bitD += `M ${x1} ${y} `;
              else {
                const prev = zoom.bits[i - 1] > 0 ? 1 : -1;
                const prevY = rowCenter(0) - prev * rowH * 0.26;
                if (prevY !== y) bitD += `L ${x1} ${prevY} L ${x1} ${y} `;
              }
              bitD += `L ${x2} ${y} `;
            }
            oscSvg += `<path d="${bitD}" stroke="#1f2b26" stroke-width="2.4" fill="none" stroke-linejoin="miter" />`;
            zoom.bits.forEach((bit, index) => {
              oscSvg += `<text class="plot-note" x="${(index + 0.5) * bitStepX}" y="${rowCenter(0) + 4}" text-anchor="middle">${bit > 0 ? "1" : "0"}</text>`;
            });
            oscSvg += drawRowCurve((i) => {
              return rowCenter(1) - Math.sin(2 * Math.PI * carrierCycles.base * (i / zoom.pointsPerBit)) * rowH * 0.28;
            }, "#62716b", 1.9);
            oscSvg += drawRowCurve((i) => rowCenter(2) - (visualSignal[i - zoom.startIdx] / maxS) * rowH * 0.31, "#287c9f", 2.4);
            if (params.modulation === "DAM") {
              for (let i = 0; i < zoom.length; i++) {
                if (zoom.bits[i] < 0) oscSvg += `<rect x="${i * bitStepX}" y="${rowCenter(2) - rowH * 0.32}" width="${bitStepX}" height="${rowH * 0.64}" fill="rgba(231,76,60,0.08)" />`;
              }
            } else if (params.modulation === "DCHM") {
              oscSvg += `<text x="${W - 18}" y="${rowCenter(2) - 18}" fill="#31433b" font-family="monospace" font-size="13" text-anchor="end">0→f1, 1→f2</text>`;
            } else {
              oscSvg += `<text x="${W - 18}" y="${rowCenter(2) - 18}" fill="#31433b" font-family="monospace" font-size="13" text-anchor="end">смена фазы при 0</text>`;
            }
            oscSvg += `</svg>`;
            const bitScale = `<dl class="visual-scale"><div><dt>Окно</dt><dd>${zoom.length} символов</dd></div><div><dt>Меняется</dt><dd>${params.modulation === "DAM" ? "амплитуда" : params.modulation === "DCHM" ? "частота" : "относительная фаза"}</dd></div><div><dt>Амплитуда</dt><dd>\\(U_m=${(SignalData.Um || 0).toFixed(4)}\\,\\text{В}\\)</dd></div></dl>`;
            const visualNote = `<p class="stage-panel__info-box stage-panel__info-box--ok">Осциллограмма показана в учебном масштабе: реальные несущие частоты заданы в МГц, поэтому частота на графике нормирована.</p>`;
            const symbolRows = (SignalData.modulation_symbols || []).slice(zoom.start, zoom.end).map((symbol, index) => {
              const shownBit = symbol.bit > 0 ? "1" : "0";
              const phasePi = symbol.phase / Math.PI;
              const state = params.modulation === "DAM"
                ? `A=${symbol.amplitude.toFixed(3)} В`
                : params.modulation === "DCHM"
                  ? `f=${symbol.frequencyMHz.toFixed(3)} МГц`
                  : `φ=${phasePi.toFixed(1)}π`;
              return `<tr><td>${zoom.start + index + 1}</td><td>${shownBit}</td><td>${state}</td></tr>`;
            }).join("");
            const symbolTable = `<div class="quant-table-wrap"><table class="quant-table"><thead><tr><th>бит</th><th>\\(b\\)</th><th>параметр несущей</th></tr></thead><tbody>${symbolRows}</tbody></table></div>`;
            const symbolDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Параметры</span><strong>Показать закон манипуляции по символам</strong></summary><div class="visual-step__body">${symbolTable}</div></details>`;

            const specH = 240;
            const powerForSpectrum = window.RadioMath.getPowerParams(params);
            const dfMHz = powerForSpectrum.df_pcm / 1000;
            const f0 = window.RadioMath.safeNumber(params.primaryFrequency, 60);
            const f1 = window.RadioMath.safeNumber(params.secondaryFrequency, f0 + 1.5);
            const carriers = params.modulation === "DCHM" ? [Math.min(f0, f1), Math.max(f0, f1)] : [f0];
            const spectrumCenter = (carriers[0] + carriers[carriers.length - 1]) / 2;
            const totalHalfWidth = Math.max(powerForSpectrum.df_s / 2000, dfMHz);
            const bandLeft = spectrumCenter - totalHalfWidth;
            const bandRight = spectrumCenter + totalHalfWidth;
            const lobeHalfWidth = Math.max(dfMHz, 0.0001);
            const pad = Math.max(0.02, (bandRight - bandLeft) * 0.14);
            const specMin = bandLeft - pad;
            const specMax = bandRight + pad;
            const specMinKhz = (specMin - f0) * 1000;
            const specMaxKhz = (specMax - f0) * 1000;
            const sx = (f) => ((((f - f0) * 1000) - specMinKhz) / Math.max(0.001, specMaxKhz - specMinKhz)) * W;
            const baseY = specH - 28;
            const lobeTop = 62;
            let specSvg = `<svg viewBox="0 0 ${W} ${specH}" width="100%" height="auto" class="stage-panel__visuals-svg spectrum-plot spectrum-plot--schematic">`;
            specSvg += window.VisualMath.axes(W, specH, baseY, "f−f0, кГц", "S(f), норм.", {
              xMin: specMinKhz, xMax: specMaxKhz, yMin: 0, yMax: 1, note: "схематически, нормировано"
            });
            carriers.forEach((center, index) => {
              const left = Math.max(bandLeft, center - lobeHalfWidth);
              const right = Math.min(bandRight, center + lobeHalfWidth);
              const color = index === 0 ? "#287c9f" : "#7554aa";
              specSvg += `<path d="M ${sx(left)} ${baseY} Q ${sx(center)} ${lobeTop} ${sx(right)} ${baseY}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="2.2" />
                <line x1="${sx(center)}" y1="${baseY}" x2="${sx(center)}" y2="${lobeTop}" stroke="#0c6b4f" stroke-width="2.6" />
                <text class="plot-note" x="${sx(center)}" y="${baseY - 8}" text-anchor="middle">${params.modulation === "DCHM" ? (index === 0 ? "f1" : "f2") : "f0"}</text>`;
            });
            specSvg += `<line x1="${sx(bandLeft)}" y1="28" x2="${sx(bandLeft)}" y2="${baseY}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
              <line x1="${sx(bandRight)}" y1="28" x2="${sx(bandRight)}" y2="${baseY}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
              <line x1="${sx(bandLeft)}" y1="30" x2="${sx(bandRight)}" y2="30" stroke="#e74c3c" stroke-width="1.5" />
              <text class="plot-note" x="${sx(spectrumCenter)}" y="23" text-anchor="middle">Δfs</text>
              <line x1="${sx(carriers[0])}" y1="82" x2="${sx(Math.min(bandRight, carriers[0] + lobeHalfWidth))}" y2="82" stroke="#62716b" stroke-width="1.4" />
              <text class="plot-note" x="${(sx(carriers[0]) + sx(Math.min(bandRight, carriers[0] + lobeHalfWidth))) / 2}" y="76" text-anchor="middle">Δfц</text>`;
            if (params.modulation === "DAM") {
              specSvg += `<text class="plot-note" x="${sx(f0 - lobeHalfWidth)}" y="${baseY - 8}" text-anchor="middle">f0−Δfц</text>
                <text class="plot-note" x="${sx(f0 + lobeHalfWidth)}" y="${baseY - 8}" text-anchor="middle">f0+Δfц</text>`;
            }
            specSvg += `</svg>`;
            const spectrumScale = `<dl class="visual-scale"><div><dt>Спектр</dt><dd>\\(S(f)\\), нормировано</dd></div><div><dt>Цифровая полоса</dt><dd>\\(\\Delta f_{\\text{ц}}=${window.RadioMath.getDigitalBandwidth(params).toFixed(2)}\\,\\text{кГц}\\)</dd></div><div><dt>Полоса сигнала</dt><dd>\\(\\Delta f_s=${(SignalData.df_s || 0).toFixed(2)}\\,\\text{кГц}\\)</dd></div></dl>`;
            const spectrumExplanation = params.modulation === "DAM"
              ? `<p class="stage-panel__graph-purpose">Одна область около \\(f_0\\) и боковые полосы; \\(\\Delta f_s=2\\Delta f_{\\text{ц}}\\).</p>`
              : params.modulation === "DCHM"
                ? `<p class="stage-panel__graph-purpose">Две области около \\(f_1\\) и \\(f_2\\); общая \\(\\Delta f_s\\) включает разнос несущих и боковые полосы.</p>`
                : `<p class="stage-panel__graph-purpose">Одна область около \\(f_0\\); ширина \\(\\Delta f_s\\) соответствует формуле методички.</p>`;
            return `<div class="stage-panel__visuals-stack">
              <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">\\(b(t)\\) → \\(u_{н}(t)\\) → \\(s(t,b_k^\\mu)\\)</p>${bitScale}${oscSvg}${visualNote}</div>
              <div class="stage-panel__visuals-layer">${symbolDetails}</div>
              <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Схематический нормированный спектр \\(S(f)\\)</p>${spectrumScale}${specSvg}${spectrumExplanation}</div>
            </div>`;
        },

        renderTheory: function(stage, params, toLatexNumber, SignalData) {
            const power = window.RadioMath.getPowerParams(params);
            const ampFormula = params.modulation === "DAM"
              ? `P_{ДАМ}=\\frac{P_c}{2}=${toLatexNumber(power.symbolPower.toFixed(6))},\\quad U_m=\\sqrt{P_{ДАМ}}=${toLatexNumber(power.Um.toFixed(4))}\\text{ В}`
              : `P_{сим}=P_c=${toLatexNumber(power.symbolPower.toFixed(6))},\\quad U_m=\\sqrt{2P_{сим}}=${toLatexNumber(power.Um.toFixed(4))}\\text{ В}`;
            let theory = "Модулятор согласует цифровой поток с аналоговым каналом: переносит биты на гармоническую несущую через амплитуду, частоту или относительную фазу.";
            let formulas = `<div class="formula-preview"><span>Длительность символа и спектр ИКМ</span>\\[ f_{\\text{д}}=2\\alpha\\Delta f_g=${toLatexNumber(power.fd.toFixed(2))}\\text{ кГц},\\quad \\tau_{\\text{сим}}=\\frac{\\Delta t}{\\mu}=\\frac{1}{${toLatexNumber(power.fd.toFixed(2))}\\cdot ${power.mu}}=${toLatexNumber(power.tauSim.toFixed(6))}\\text{ мс} \\]\\[ \\Delta f_{ц}=\\frac{k_1}{\\tau_{\\text{сим}}},\\quad k_1=${power.k1},\\quad \\Delta f_{ц}=${toLatexNumber(power.df_pcm.toFixed(2))}\\text{ кГц} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Полоса выбранной дискретной модуляции</span>\\[ ${power.formulaLatex},\\quad \\Delta f_s=${toLatexNumber(power.df_s.toFixed(2))}\\text{ кГц} \\]</div>`;
            formulas += `<div class="stage-panel__info-box"><strong>По методичке:</strong><br>${power.description}</div>`;
            formulas += `<div class="formula-preview"><span>Мощность шума в полосе</span>\\[ P_{\\text{ш}} = N_0\\Delta f_s = ${toLatexNumber(power.N0)}\\cdot ${toLatexNumber(power.df_s.toFixed(2))} = ${toLatexNumber(power.P_sh.toFixed(6))}\\text{ Вт} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Требуемая мощность сигнала</span>\\[ P_c = h^2P_{\\text{ш}} = ${toLatexNumber(power.h2)}\\cdot ${toLatexNumber(power.P_sh.toFixed(6))} = ${toLatexNumber(power.P_c.toFixed(6))}\\text{ Вт} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Амплитуда сигнала</span>\\[ ${ampFormula} \\]</div>`;
            formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>${window.RadioMath.getVisualFrequencyNote(params)} Амплитуда по оси Y масштабируется по рассчитанному значению \\(U_m\\).</div>`;
            return { theory, formulas };
        }
    };

    // ==========================================
    // Блок 07: Канал связи (Шум)
    // ==========================================
    window.StageHandlers.channel = {
        process: function(params, SignalData) {
            const N = SignalData.S_t.length;
            const power = window.RadioMath.getPowerParams(params);
            const noiseSigma = power.sigmaNoise;
            SignalData.noiseSigma = noiseSigma;
            // Методичка: z(t) = χS(t) + n(t). В индивидуальных вариантах χ не задаётся,
            // поэтому в численной модели принято χ = 1 (линия без дополнительного ослабления).
            const chi = 1;
            SignalData.channel_chi = chi;

            SignalData.n_t = new Array(N).fill(0);
            SignalData.z_t = new Array(N).fill(0);

            for (let i = 0; i < N; i++) {
                let noise = window.VisualMath.deterministicNormal(i, Math.round(power.h2 * 100) + String(params.modulation || "").length);
                SignalData.n_t[i] = noise * noiseSigma;
                SignalData.z_t[i] = chi * SignalData.S_t[i] + SignalData.n_t[i];
            }
            SignalData.zMax = Math.max(...SignalData.z_t.map(Math.abs), 1.5 * SignalData.Um);
            SignalData.noise_quadrature = new Array(N).fill(0).map((_, i) => window.VisualMath.deterministicNormal(i, 91) * noiseSigma);
        },

        renderSVG: function(id, params, helpers, SignalData) {
            const { W } = helpers;
            const zoom = window.RadioMath.getZoomInfo(SignalData, 10);
            const bitStepX = W / Math.max(1, zoom.length);
            const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;
            const power = window.RadioMath.getPowerParams(params);
            let maxZ = SignalData.zMax || Math.max(...SignalData.z_t.map(Math.abs));
            if (maxZ < SignalData.Um) maxZ = SignalData.Um * 1.5;
            if (maxZ === 0) maxZ = 1;
            const rowH = 104;
            const chanH = rowH * 3 + 18;
            const rowCenter = (row) => 12 + row * rowH + rowH / 2;
            const rowPath = (data, row, color) => {
              let d = "";
              for (let i = zoom.startIdx; i <= zoom.endIdx; i++) {
                const y = rowCenter(row) - (data[i] / maxZ) * (rowH * 0.38);
                d += `${d ? "L" : "M"} ${xOfIndex(i)} ${y} `;
              }
              return `<path d="${d}" stroke="${color}" stroke-width="2.1" fill="none" stroke-linejoin="round" />`;
            };
            let channelSvg = `<svg viewBox="0 0 ${W} ${chanH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            channelSvg += `<rect x="1" y="1" width="${W - 2}" height="${chanH - 2}" fill="none" stroke="#1f2b26" stroke-width="1.3" />`;
            ["S(t)", "n(t)", "z(t)=χS(t)+n(t)"].forEach((label, row) => {
              channelSvg += `<line x1="0" y1="${rowCenter(row)}" x2="${W}" y2="${rowCenter(row)}" stroke="#d5ddd8" stroke-width="1.4" />
                <text class="plot-axis-label" x="12" y="${rowCenter(row) - 16}">${label}</text>`;
            });
            for (let i = 0; i <= zoom.length; i++) {
              const x = i * bitStepX;
              channelSvg += `<line x1="${x}" y1="1" x2="${x}" y2="${chanH - 1}" stroke="rgba(98,113,107,0.18)" stroke-dasharray="3,8" />`;
            }
            channelSvg += rowPath(SignalData.S_t, 0, "#287c9f");
            channelSvg += rowPath(SignalData.n_t, 1, "#e74c3c");
            channelSvg += rowPath(SignalData.z_t, 2, "#0c6b4f");
            channelSvg += `</svg>`;

            const pdfH = 190;
            const sigma = SignalData.noiseSigma || 1;
            const pdfSamples = window.VisualMath.makeSamples(-4 * sigma, 4 * sigma, 180, (u) => Math.exp(-u * u / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)));
            const pdfPeak = 1 / (sigma * Math.sqrt(2 * Math.PI));
            const pdfSvg = window.VisualMath.chartSvg({
              W, H: pdfH, xMin: -4 * sigma, xMax: 4 * sigma, yMin: 0, yMax: pdfPeak * 1.12,
              xLabel: "n", yLabel: "W_n(n)", samples: pdfSamples, color: "#e74c3c", width: 2.4
            });

            const cloudH = 280;
            const cloudScale = Math.max(1e-6, 4 * sigma);
            const cx = W / 2;
            const cy = cloudH / 2;
            const point = (x, y) => `${cx + (x / cloudScale) * (W * 0.38)},${cy - (y / cloudScale) * (cloudH * 0.38)}`;
            let cloudSvg = `<svg viewBox="0 0 ${W} ${cloudH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            cloudSvg += `<line x1="20" y1="${cy}" x2="${W - 20}" y2="${cy}" stroke="#d5ddd8" stroke-width="2" />
              <line x1="${cx}" y1="20" x2="${cx}" y2="${cloudH - 20}" stroke="#d5ddd8" stroke-width="2" />
              <text x="${W - 58}" y="${cy - 10}" fill="#62716b" font-family="monospace" font-size="14">Nшc</text>
              <text x="${cx + 12}" y="32" fill="#62716b" font-family="monospace" font-size="14">Nшs</text>`;
            const step = Math.max(1, Math.floor(SignalData.n_t.length / 180));
            for (let i = 0; i < SignalData.n_t.length; i += step) {
              const [px, py] = point(SignalData.n_t[i], SignalData.noise_quadrature?.[i] || 0).split(",");
              cloudSvg += `<circle cx="${px}" cy="${py}" r="2.4" fill="#e74c3c" fill-opacity="0.34" />`;
            }
            const radius = (sigma / cloudScale) * (cloudH * 0.38);
            cloudSvg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#7554aa" stroke-width="2" stroke-dasharray="6,6" />`;
            cloudSvg += `</svg>`;

            const besselI0 = (x) => {
              let sum = 1;
              let term = 1;
              for (let k = 1; k < 12; k++) {
                term *= (x * x) / (4 * k * k);
                sum += term;
              }
              return sum;
            };
            const envH = 240;
            const um = SignalData.Um || 0;
            const envMax = Math.max(4 * sigma, um + 4 * sigma, 1e-6);
            const rayleigh = window.VisualMath.makeSamples(0, envMax, 180, (v) => (v / (sigma * sigma)) * Math.exp(-(v * v) / (2 * sigma * sigma)));
            const rice = window.VisualMath.makeSamples(0, envMax, 180, (v) => {
              const exponent = Math.exp(-(v * v + um * um) / (2 * sigma * sigma));
              return (v / (sigma * sigma)) * exponent * besselI0((v * um) / (sigma * sigma));
            });
            const envPeak = Math.max(...rayleigh.map(([, y]) => y), ...rice.map(([, y]) => y), 0.0001);
            let envelopeSvg = `<svg viewBox="0 0 ${W} ${envH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            envelopeSvg += window.VisualMath.axes(W, envH, envH - 24, "ν", "W(ν)");
            envelopeSvg += window.VisualMath.drawXYCurve(rayleigh, W, envH, 0, envMax, 0, envPeak * 1.12, "#287c9f", 2.4, 0.86);
            envelopeSvg += window.VisualMath.drawXYCurve(rice, W, envH, 0, envMax, 0, envPeak * 1.12, "#0c6b4f", 2.4, 0.86);
            envelopeSvg += `<text x="${W - 22}" y="28" fill="#287c9f" font-family="monospace" font-size="14" text-anchor="end">Рэлей</text>
              <text x="${W - 22}" y="48" fill="#0c6b4f" font-family="monospace" font-size="14" text-anchor="end">Райс</text>`;
            envelopeSvg += `</svg>`;

            const scaleNote = `<dl class="visual-scale"><div><dt>Общий масштаб</dt><dd>±${maxZ.toFixed(4)} В</dd></div><div><dt>Окно</dt><dd>биты ${zoom.start + 1}-${zoom.end}</dd></div><div><dt>\\(\\chi\\)</dt><dd>1 (не задан в варианте)</dd></div></dl>`;
            const noiseScale = `<dl class="visual-scale"><div><dt>\\(\\sigma_{\\text{ш}}\\)</dt><dd>${sigma.toFixed(4)} В</dd></div><div><dt>\\(P_{\\text{ш}}\\)</dt><dd>${(SignalData.P_sh || 0).toFixed(6)} Вт</dd></div><div><dt>Модель</dt><dd>\\(n(t)=N_{\\text{ш}c}\\cos\\omega_ш t + N_{\\text{ш}s}\\sin\\omega_ш t\\)</dd></div></dl>`;
            const powerScale = `<dl class="visual-scale"><div><dt>\\(N_0\\)</dt><dd>${power.N0}</dd></div><div><dt>\\(P_{\\text{ш}}\\)</dt><dd>${power.P_sh.toFixed(6)} Вт</dd></div><div><dt>\\(P_s\\)</dt><dd>${power.P_c.toFixed(6)} Вт</dd></div></dl>`;
            const extraParams = `<dl class="visual-scale"><div><dt>\\(U_m\\)</dt><dd>${(SignalData.Um || 0).toFixed(4)} В</dd></div><div><dt>\\(C\\)</dt><dd>${power.capacity.toFixed(2)} кбит/с</dd></div></dl>`;
            const noiseBandScheme = `<div class="stage-panel__info-box"><svg viewBox="0 0 260 110" width="240" height="100" style="display:block;margin:0 auto;">
              <rect x="50" y="20" width="160" height="50" fill="rgba(231,76,60,0.12)" stroke="#e74c3c" stroke-width="2" />
              <text x="130" y="50" text-anchor="middle" fill="#1f2b26" font-family="monospace" font-size="13">Pш = N₀·Δfs</text>
              <text x="34" y="48" text-anchor="middle" fill="#62716b" font-family="monospace" font-size="11" transform="rotate(-90 34 48)">высота: N₀</text>
              <text x="130" y="92" text-anchor="middle" fill="#62716b" font-family="monospace" font-size="11">ширина: Δfs = ${power.df_s.toFixed(2)} кГц</text>
            </svg></div>`;
            const cloudDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Статистика</span><strong>Показать облако синфазной и квадратурной помехи</strong></summary><div class="visual-step__body">${noiseScale}${cloudSvg}</div></details>`;
            const envelopeDetails = `<details class="visual-step"><summary class="visual-step__summary"><span>Огибающие</span><strong>Показать распределения Рэлея и Райса</strong></summary><div class="visual-step__body">${noiseScale}${envelopeSvg}</div></details>`;
            return `<div class="stage-panel__visuals-stack">
                <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Канал: \\(S(t) \\to n(t) \\to z(t)\\)</p>${noiseBandScheme}${powerScale}${extraParams}${scaleNote}${channelSvg}</div>
                <div class="stage-panel__visuals-layer"><details class="visual-step"><summary class="visual-step__summary"><span>Статистика</span><strong>ФПВ мгновенных значений шума</strong></summary><div class="visual-step__body">${noiseScale}${pdfSvg}</div></details></div>
                <div class="stage-panel__visuals-layer">${cloudDetails}</div>
                <div class="stage-panel__visuals-layer">${envelopeDetails}</div>
            </div>`;
        },

        renderTheory: function(stage, params, toLatexNumber, SignalData) {
            const power = window.RadioMath.getPowerParams(params);
            const zMax = SignalData.zMax || 0;
            let theory = "На вход приёмника поступает смесь полезного сигнала и аддитивного белого гауссовского шума (АБГШ). Канал вносит случайные флуктуации, искажающие форму сигнала.";
            let formulas = `<div class="formula-preview"><span>Модель принимаемого сигнала</span>\\[ z(t) = \\chi S(t) + n(t) \\]</div>`;
            formulas += `<div class="stage-panel__info-box"><strong>Коэффициент ослабления:</strong><br>В методичке \\(z(t)=\\chi S(t)+n(t)\\), где \\(\\chi<1\\) учитывает затухание в линии. Поскольку в индивидуальных вариантах \\(\\chi\\) не задаётся, в численной модели принято \\(\\chi=1\\) — линия без дополнительного ослабления.</div>`;
            formulas += `<div class="formula-preview"><span>Узкополосная гауссовская помеха</span>\\[ n(t)=N_{\\text{ш}c}(t)\\cos\\omega_ш t+N_{\\text{ш}s}(t)\\sin\\omega_ш t,\\quad \\sigma_{Nшc}^2=\\sigma_{Nшs}^2=P_{\\text{ш}} \\]</div>`;
            formulas += `<div class="formula-preview"><span>СКО шума</span>\\[ \\sigma_{\\text{ш}} = \\sqrt{P_{\\text{ш}}} = \\sqrt{${toLatexNumber(power.P_sh.toFixed(6))}} = ${toLatexNumber(power.sigmaNoise.toFixed(4))}\\text{ В} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Пропускная способность НКС</span>\\[ C=\\Delta f_s\\log_2(1+h^2)=${toLatexNumber(power.df_s.toFixed(2))}\\log_2(1+${toLatexNumber(power.h2)})=${toLatexNumber(power.capacity.toFixed(2))}\\text{ кбит/с} \\]</div>`;
            formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Масштабирование осей: чтобы выбросы шума не обрезались, ось Y расширена до \\(Z_{max}=\\max(|z(t)|,1{,}5U_m)=${toLatexNumber(zMax.toFixed(4))}\\) В. Все три графика канала используют этот же масштаб.</div>`;
            return { theory, formulas };
        }
    };
})();
