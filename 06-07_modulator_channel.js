(function() {
    'use strict';
    window.StageHandlers = window.StageHandlers || {};

    window.RadioMath = window.RadioMath || (function() {
      function safeNumber(value, fallback) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }

      function getDigitalBandwidth(params) {
        const alpha = safeNumber(params.samplingIncrease, 2);
        const dfg = safeNumber(params.signalBandwidth, 28);
        const fd = 2 * alpha * dfg;
        const tauSim = 1 / (fd * 4);
        return 1 / tauSim;
      }

      function getPowerParams(params) {
        const df_s = getDigitalBandwidth(params);
        const N0 = safeNumber(params.noiseDensity, 0.0001);
        const h2 = safeNumber(params.signalNoiseRatio, 8.5);
        const P_sh = N0 * df_s;
        const P_c = h2 * P_sh;
        const Um = params.modulation === "DAM" ? Math.sqrt(P_c) : Math.sqrt(2 * P_c);
        const sigmaNoise = Math.sqrt(P_sh);
        return { df_s, N0, h2, P_sh, P_c, Um, sigmaNoise };
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
        const pointsPerBit = SignalData.N / numBits;
        const startIdx = Math.max(0, Math.floor(zoom.start * pointsPerBit));
        const endIdx = Math.min(SignalData.N - 1, Math.max(startIdx + 1, Math.ceil(zoom.end * pointsPerBit)));
        return { ...zoom, pointsPerBit, startIdx, endIdx };
      }

      return { safeNumber, getDigitalBandwidth, getPowerParams, getCarrierCycles, getVisualFrequencyNote, toLatexFixed, getZoomInfo };
    })();

    // ==========================================
    // Блок 06: Модулятор
    // ==========================================
    window.StageHandlers.modulator = {
        process: function(params, SignalData) {
            const N = SignalData.N;
            const numBits = SignalData.b_t.length;
            const pointsPerBit = Math.max(1, N / numBits);

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
            for (let i = 0; i < N; i++) {
                let bitIdx = Math.floor(i / pointsPerBit);
                if (bitIdx >= numBits) bitIdx = numBits - 1;
                
                let bit = SignalData.b_t[bitIdx];
                let tSymbol = (i - bitIdx * pointsPerBit) / pointsPerBit;
                let w_t = 2 * Math.PI * carrierCycles.base * tSymbol;

                if (params.modulation === "DAM") {
                    SignalData.S_t[i] = bit > 0 ? power.Um * Math.sin(w_t) : 0;
                } else if (params.modulation === "DCHM") {
                    let f_current = bit > 0 ? carrierCycles.low : carrierCycles.high;
                    SignalData.S_t[i] = power.Um * Math.sin(2 * Math.PI * f_current * tSymbol);
                } else if (params.modulation === "DOFM") {
                    let phase = dofm_phases[bitIdx];
                    SignalData.S_t[i] = power.Um * Math.sin(w_t + phase);
                }
            }
        },

        renderSVG: function(id, params, helpers, SignalData) {
            const { W, H, getX, getY } = helpers;
            const zoom = window.RadioMath.getZoomInfo(SignalData, 5);
            const bitStepX = W / Math.max(1, zoom.length);
            const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;

            // Верхний график: бледный цифровой меандр b(t)
            let modTopH = 60;
            let modTopSVG = `<svg viewBox="0 0 ${W} ${modTopH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            let paleMeanderD = "";
            for (let i = 0; i < zoom.length; i++) {
                let x1 = i * bitStepX, x2 = (i + 1) * bitStepX;
                let bit = zoom.bits[i];
                let y = bit > 0 ? modTopH * 0.2 : modTopH * 0.8;
                if (i === 0) paleMeanderD += `M ${x1} ${y} `;
                else {
                    let prevY = zoom.bits[i - 1] > 0 ? modTopH * 0.2 : modTopH * 0.8;
                    if (prevY !== y) paleMeanderD += `L ${x1} ${prevY} L ${x1} ${y} `;
                }
                paleMeanderD += `L ${x2} ${y} `;
                modTopSVG += `<line x1="${x1}" y1="0" x2="${x1}" y2="${modTopH}" stroke="rgba(98,113,107,0.22)" stroke-dasharray="3,7" />`;
            }
            modTopSVG += `<path d="${paleMeanderD}" stroke="#0c6b4f" stroke-width="2" fill="none" stroke-opacity="0.3" stroke-linejoin="round" />`;
            modTopSVG += `<line x1="${W}" y1="0" x2="${W}" y2="${modTopH}" stroke="rgba(98,113,107,0.22)" stroke-dasharray="3,7" />`;
            modTopSVG += `<text x="${W - 14}" y="16" fill="#62716b" font-family="monospace" font-size="12" text-anchor="end">биты ${zoom.start + 1}–${zoom.end}</text>`;
            modTopSVG += `</svg>`;

            // Нижний график: радиоволна S(t)
            let modBotH = 190, modBotY0 = modBotH / 2;
            let modBotSVG = `<svg viewBox="0 0 ${W} ${modBotH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
            modBotSVG += `<line x1="0" y1="${modBotY0}" x2="${W}" y2="${modBotY0}" stroke="#d5ddd8" stroke-width="2" />`;
            let maxS = Math.max(...SignalData.S_t.slice(zoom.startIdx, zoom.endIdx + 1).map(Math.abs)); if (maxS === 0) maxS = 1;
            let sD = `M 0 ${modBotY0 - (SignalData.S_t[zoom.startIdx] / maxS) * (modBotH * 0.4)}`;
            for (let i = zoom.startIdx; i <= zoom.endIdx; i++) sD += ` L ${xOfIndex(i)} ${modBotY0 - (SignalData.S_t[i] / maxS) * (modBotH * 0.4)}`;
            for (let i = 0; i <= zoom.length; i++) {
                let x = i * bitStepX;
                modBotSVG += `<line x1="${x}" y1="0" x2="${x}" y2="${modBotH}" stroke="rgba(98,113,107,0.15)" stroke-dasharray="3,8" />`;
            }
            modBotSVG += `<path d="${sD}" stroke="#287c9f" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
            modBotSVG += `<text x="${W - 16}" y="24" fill="#62716b" font-family="monospace" font-size="14" text-anchor="end">U_m = ${(SignalData.Um || 0).toFixed(4)} В</text>`;
            modBotSVG += `</svg>`;
            return `<div class="stage-panel__visuals-stack"><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Цифровой сигнал b(t)</p>${modTopSVG}</div><div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Радиосигнал S(t)</p>${modBotSVG}</div></div>`;
        },

        renderTheory: function(stage, params, toLatexNumber, SignalData) {
            const power = window.RadioMath.getPowerParams(params);
            const ampFormula = params.modulation === "DAM"
              ? `U_m = \\sqrt{P_c} = \\sqrt{${toLatexNumber(power.P_c.toFixed(6))}} = ${toLatexNumber(power.Um.toFixed(4))}\\text{ В}`
              : `U_m = \\sqrt{2P_c} = \\sqrt{2\\cdot ${toLatexNumber(power.P_c.toFixed(6))}} = ${toLatexNumber(power.Um.toFixed(4))}\\text{ В}`;
            let theory = "Модулятор закладывает цифровую последовательность в параметр несущей: амплитуду для ДАМ, частоту для ДЧМ или относительную фазу для ДОФМ.";
            let formulas = `<div class="formula-preview"><span>Ширина спектра цифрового сигнала</span>\\[ \\Delta f_s = \\frac{1}{\\tau_{сим}} = ${toLatexNumber(power.df_s.toFixed(2))}\\text{ кГц} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Мощность шума в полосе</span>\\[ P_ш = N_0\\Delta f_s = ${toLatexNumber(power.N0)}\\cdot ${toLatexNumber(power.df_s.toFixed(2))} = ${toLatexNumber(power.P_sh.toFixed(6))}\\text{ Вт} \\]</div>`;
            formulas += `<div class="formula-preview"><span>Требуемая мощность сигнала</span>\\[ P_c = h^2P_ш = ${toLatexNumber(power.h2)}\\cdot ${toLatexNumber(power.P_sh.toFixed(6))} = ${toLatexNumber(power.P_c.toFixed(6))}\\text{ Вт} \\]</div>`;
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
            const N = SignalData.N;
            const power = window.RadioMath.getPowerParams(params);
            const noiseSigma = power.sigmaNoise;
            SignalData.noiseSigma = noiseSigma;

            SignalData.n_t = new Array(N).fill(0);
            SignalData.z_t = new Array(N).fill(0);

            for (let i = 0; i < N; i++) {
                // Преобразование Бокса-Мюллера
                let u = 0, v = 0;
                while (u === 0) u = Math.random();
                while (v === 0) v = Math.random();
                let noise = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

                SignalData.n_t[i] = noise * noiseSigma;
                SignalData.z_t[i] = SignalData.S_t[i] + SignalData.n_t[i];
            }
            SignalData.zMax = Math.max(...SignalData.z_t.map(Math.abs), 1.5 * SignalData.Um);
        },

        renderSVG: function(id, params, helpers, SignalData) {
            const { W, H, getX, getY } = helpers;
            let chanH = 120, chanY0 = chanH / 2;
            const zoom = window.RadioMath.getZoomInfo(SignalData, 5);
            const bitStepX = W / Math.max(1, zoom.length);
            const xOfIndex = (index) => ((index - zoom.startIdx) / Math.max(1, zoom.endIdx - zoom.startIdx)) * W;
            
            let maxZ = SignalData.zMax || Math.max(...SignalData.z_t.map(Math.abs));
            if (maxZ < SignalData.Um) maxZ = SignalData.Um * 1.5;
            if (maxZ === 0) maxZ = 1;

            let createChanSVG = (data, color) => {
                let svg = `<svg viewBox="0 0 ${W} ${chanH}" preserveAspectRatio="none" width="100%" height="auto" class="stage-panel__visuals-svg">`;
                svg += `<line x1="0" y1="${chanY0}" x2="${W}" y2="${chanY0}" stroke="#d5ddd8" stroke-width="2" />`;
                svg += `<text x="12" y="18" fill="#62716b" font-family="monospace" font-size="12">+${maxZ.toFixed(3)} В</text>`;
                svg += `<text x="12" y="${chanH - 8}" fill="#62716b" font-family="monospace" font-size="12">-${maxZ.toFixed(3)} В</text>`;
                for (let i = 0; i <= zoom.length; i++) {
                    const x = i * bitStepX;
                    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${chanH}" stroke="rgba(98,113,107,0.13)" stroke-dasharray="3,8" />`;
                }
                let d = `M 0 ${chanY0}`;
                for (let i = zoom.startIdx; i <= zoom.endIdx; i++) {
                    let y = chanY0 - (data[i] / maxZ) * (chanH * 0.4);
                    if (y < -10) y = -10; if (y > chanH + 10) y = chanH + 10;
                    d += ` L ${xOfIndex(i)} ${y}`;
                }
                svg += `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round" />`;
                svg += `<text x="${W - 12}" y="18" fill="#62716b" font-family="monospace" font-size="12" text-anchor="end">биты ${zoom.start + 1}–${zoom.end}</text>`;
                svg += `</svg>`;
                return svg;
            };

            let sSVG = createChanSVG(SignalData.S_t, '#287c9f');
            let nSVG = createChanSVG(SignalData.n_t, '#e74c3c');
            let zSVG = createChanSVG(SignalData.z_t, '#0c6b4f');

            return `<div class="stage-panel__visuals-stack">
                <div class="stage-panel__visuals-layer">
                    <p class="stage-panel__visuals-header"><strong style="color:#287c9f">Идеальный сигнал S(t)</strong></p>
                    ${sSVG}
                </div>
                <div class="stage-panel__visuals-layer">
                    <p class="stage-panel__visuals-header"><strong style="color:#e74c3c">Гауссовский шум n(t)</strong></p>
                    ${nSVG}
                </div>
                <div class="stage-panel__visuals-layer">
                    <p class="stage-panel__visuals-header"><strong style="color:#0c6b4f">Принятая смесь z(t)</strong></p>
                    ${zSVG}
                </div>
            </div>`;
        },

        renderTheory: function(stage, params, toLatexNumber, SignalData) {
            const power = window.RadioMath.getPowerParams(params);
            const zMax = SignalData.zMax || 0;
            let theory = "На вход приёмника поступает смесь полезного сигнала и аддитивного белого гауссовского шума (АБГШ). Канал вносит случайные флуктуации, искажающие форму сигнала.";
            let formulas = `<div class="formula-preview"><span>Модель принимаемого сигнала</span>\\[ z(t) = S(t) + n(t) \\]</div>`;
            formulas += `<div class="formula-preview"><span>СКО шума</span>\\[ \\sigma_ш = \\sqrt{P_ш} = \\sqrt{${toLatexNumber(power.P_sh.toFixed(6))}} = ${toLatexNumber(power.sigmaNoise.toFixed(4))}\\text{ В} \\]</div>`;
            formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Масштабирование осей: чтобы выбросы шума не обрезались, ось Y расширена до \\(Z_{max}=\\max(|z(t)|,1{,}5U_m)=${toLatexNumber(zMax.toFixed(4))}\\) В. Все три графика канала используют этот же масштаб.</div>`;
            return { theory, formulas };
        }
    };
})();
