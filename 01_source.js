// 01_source.js - Источник и первичный преобразователь
(function() {
  'use strict';

  window.StageHandlers = window.StageHandlers || {};

  window.VisualMath = window.VisualMath || (function() {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const safeNumber = (value, fallback) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    function getSampleStep(params) {
      const alpha = safeNumber(params.samplingIncrease, 2);
      const dfg = safeNumber(params.signalBandwidth, 28);
      const fd = Math.max(1, 2 * alpha * dfg);
      const samplesInWindow = Math.max(6, fd * getTimeSpanMs(params));
      return Math.max(3, Math.floor(1000 / samplesInWindow));
    }

    function getTimeSpanMs(params) {
      const dfg = Math.max(1, safeNumber(params.signalBandwidth, 28));
      return clamp(20 / dfg, 0.35, 1.25);
    }

    function indexToTimeMs(index, count, params) {
      const n = Math.max(1, count - 1);
      return (index / n) * getTimeSpanMs(params);
    }

    function hashNoise(index, salt = 0) {
      const x = Math.sin((index + 1) * 127.1 + (salt + 1) * 311.7) * 43758.5453123;
      return x - Math.floor(x);
    }

    function deterministicNormal(index, salt = 0) {
      const u1 = Math.max(1e-6, hashNoise(index, salt));
      const u2 = hashNoise(index + 173, salt + 19);
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    function getCorrelationKind(params) {
      const text = String(params.correlationFunction || "");
      if (text.includes("cos^2")) return "cosineSquared";
      if (text.includes("beta^2") || text.includes("0{,}5")) return "gaussian";
      if (text.includes("left[") || text.includes("right]^2")) return "sincSquared";
      if (text.includes("sin(2\\pi")) return "sinc";
      if (text.includes("1 - (4\\beta")) return "cosineRatio";
      if (text.includes("cos(2\\pi")) return "cosineLimited";
      if (text.includes("(1 - \\beta")) return "exponentialLinear";
      return "exponential";
    }

    function getCorrelationMeta(params) {
      const kind = getCorrelationKind(params);
      const metas = {
        exponential: {
          title: "экспоненциальная корреляционная функция",
          k: 2,
          spectrumLatex: String.raw`G_g(f)=\dfrac{2P_g\beta}{\beta^2+(2\pi f)^2}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\exp\left(-\dfrac{1}{2\alpha}\right)}}`,
        },
        cosineSquared: {
          title: "ограниченная функция вида cos^2",
          k: 1.5,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g\cos^2(\pi\beta\tau)\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\cos^4\left(\dfrac{\pi}{3\alpha}\right)}}`,
        },
        gaussian: {
          title: "гауссовская корреляционная функция",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\dfrac{P_g\sqrt{2\pi}}{\beta}\exp\left(-\dfrac{2\pi^2f^2}{\beta^2}\right)`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\exp\left(-\dfrac{1}{2\alpha^2}\right)}}`,
        },
        sinc: {
          title: "sinc-корреляционная функция",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\begin{cases}\dfrac{P_g}{2\beta},& |f|\le\beta,\\0,& |f|>\beta,\end{cases}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\left(\dfrac{\sin(\pi/\alpha)}{\pi/\alpha}\right)^2}}`,
        },
        sincSquared: {
          title: "квадрат sinc-корреляционной функции",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\dfrac{P_g}{2\beta}\Lambda\left(\dfrac{f}{2\beta}\right)`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\left(\dfrac{\sin(\pi/\alpha)}{\pi/\alpha}\right)^4}}`,
        },
        cosineRatio: {
          title: "дробно-косинусная корреляционная функция",
          k: 4,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{\dfrac{P_g\cos(2\pi\beta\tau)}{1-(4\beta\tau)^2}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\left(\dfrac{\cos(\pi/(4\alpha))}{1-1/(4\alpha^2)}\right)^2}}`,
        },
        cosineLimited: {
          title: "ограниченная косинусная корреляционная функция",
          k: 3,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g\cos(2\pi\beta\tau), |\tau|\le\dfrac{1}{4\beta}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\cos^2\left(\dfrac{\pi}{3\alpha}\right)}}`,
        },
        exponentialLinear: {
          title: "экспоненциально-линейная корреляционная функция",
          k: 2,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g(1-\beta|\tau|)e^{-\beta|\tau|}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{\sqrt{1-\left(1-\dfrac{0{,}25}{\alpha}\right)^2\exp\left(-\dfrac{1}{2\alpha}\right)}}`,
        },
      };
      const meta = metas[kind] || metas.exponential;
      return { kind, ...meta };
    }

    function normalCdf(x) {
      // Нормальное распределение: Φ(x) = 0.5·(1 + erf(x/√2)).
      // Аппроксимация erf вычисляется от x/√2, а не от x напрямую.
      const z = x / Math.SQRT2;
      const sign = z < 0 ? -1 : 1;
      const absZ = Math.abs(z);
      const t = 1 / (1 + 0.3275911 * absZ);
      const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absZ * absZ);
      return 0.5 * (1 + sign * erf);
    }

    function laplacePhi(x) {
      return normalCdf(x) - 0.5;
    }

    function integratePositive(fn, start, end, steps = 600) {
      if (end <= start) return 0;
      const h = (end - start) / steps;
      let sum = 0;
      for (let i = 0; i <= steps; i++) {
        const weight = i === 0 || i === steps ? 0.5 : 1;
        sum += weight * fn(start + i * h);
      }
      return sum * h;
    }

    function getAnalyticFilterError(params) {
      const dfg = safeNumber(params.signalBandwidth, 28);
      const fMax = getSpectrumWindow(params).max;
      const total = 2 * integratePositive((f) => spectrumValue(f, params), 0, fMax);
      const tail = 2 * integratePositive((f) => spectrumValue(f, params), dfg, fMax);
      return total > 0 ? tail / total : 0;
    }

    function getSpectrumWindow(params) {
      const beta = Math.max(1, safeNumber(params.beta, 14));
      const dfg = Math.max(1, safeNumber(params.signalBandwidth, 28));
      return { max: Math.max(dfg * 3.2, beta * 5, 60), cutoff: dfg };
    }

    function getEta(params) {
      const alpha = safeNumber(params.samplingIncrease, 2);
      const kind = getCorrelationKind(params);
      // Делегируем в общий модуль Calculations, чтобы формула, расчёт и LaTeX
      // всегда соответствовали таблице 2 методички.
      if (window.Calculations && window.Calculations.computeEta) {
        return window.Calculations.computeEta(kind, alpha).value;
      }
      // Fallback (если calculations.js не загружен) — тот же набор формул.
      const formulas = {
        exponential: () => 1 / Math.sqrt(Math.max(1e-12, 1 - Math.exp(-1 / (2 * alpha)))),
        cosineSquared: () => { const c = Math.cos(Math.PI / (3 * alpha)); return 1 / Math.sqrt(Math.max(1e-12, 1 - c * c * c * c)); },
        gaussian: () => 1 / Math.sqrt(Math.max(1e-12, 1 - Math.exp(-1 / (2 * alpha * alpha)))),
        sinc: () => { const a = Math.PI / alpha; const s = Math.abs(a) < 1e-9 ? 1 : Math.sin(a) / a; return 1 / Math.sqrt(Math.max(1e-12, 1 - s * s)); },
        sincSquared: () => { const a = Math.PI / alpha; const s = Math.abs(a) < 1e-9 ? 1 : Math.sin(a) / a; const r = s * s; return 1 / Math.sqrt(Math.max(1e-12, 1 - r * r)); },
        cosineRatio: () => { const d = 1 - 1 / (4 * alpha * alpha); if (Math.abs(d) < 1e-12) return 1; const r = Math.cos(Math.PI / (4 * alpha)) / d; return 1 / Math.sqrt(Math.max(1e-12, 1 - r * r)); },
        cosineLimited: () => { const c = Math.cos(Math.PI / (3 * alpha)); return 1 / Math.sqrt(Math.max(1e-12, 1 - c * c)); },
        exponentialLinear: () => { const r = (1 - 0.25 / alpha) * Math.exp(-1 / (4 * alpha)); return 1 / Math.sqrt(Math.max(1e-12, 1 - r * r)); },
      };
      return (formulas[kind] || formulas.exponential)();
    }

    function getLevelProbabilitiesAnalytic(params, thresholds, levels) {
      const sigma = Math.sqrt(safeNumber(params.signalPower, 1.5));
      return levels.map((level, index) => {
        const left = index === 0 ? -Infinity : thresholds[index - 1];
        const right = index === levels.length - 1 ? Infinity : thresholds[index];
        const cdfRight = right === Infinity ? 1 : normalCdf(right / sigma);
        const cdfLeft = left === -Infinity ? 0 : normalCdf(left / sigma);
        return Math.max(0, cdfRight - cdfLeft);
      });
    }

    function getZoomWindow(SignalData, size = 5) {
      const bits = SignalData.b_t || [];
      const total = bits.length;
      const length = Math.min(size, total);
      if (!length) return { start: 0, end: 0, length: 0, bits: [] };
      let start = 0;
      for (let i = 0; i <= total - length; i++) {
        const slice = bits.slice(i, i + length);
        const hasZero = slice.some((bit) => bit < 0);
        const hasOne = slice.some((bit) => bit > 0);
        if (hasZero && hasOne) { start = i; break; }
      }
      return { start, end: start + length, length, bits: bits.slice(start, start + length) };
    }

    function correlationValue(tau, params) {
      const Pg = safeNumber(params.signalPower, 1.5);
      const beta = safeNumber(params.beta, 14);
      const a = Math.abs(beta * tau);
      const kind = getCorrelationKind(params);

      if (kind === "cosineSquared") return a <= 0.5 ? Pg * Math.pow(Math.cos(Math.PI * a), 2) : 0;
      if (kind === "gaussian") return Pg * Math.exp(-0.5 * a * a);
      if (kind === "sinc" || kind === "sincSquared") {
        if (a < 0.0001) return Pg;
        const s = Math.sin(2 * Math.PI * a) / (2 * Math.PI * a);
        return Pg * (kind === "sincSquared" ? s * s : s);
      }
      if (kind === "cosineRatio") {
        const denominator = 1 - Math.pow(4 * a, 2);
        if (Math.abs(denominator) < 0.08) return 0;
        return clamp(Pg * Math.cos(2 * Math.PI * a) / denominator, -Pg, Pg);
      }
      if (kind === "cosineLimited") return a <= 0.25 ? Pg * Math.cos(2 * Math.PI * a) : 0;
      if (kind === "exponentialLinear") return Pg * Math.max(0, 1 - a) * Math.exp(-a);
      return Pg * Math.exp(-a);
    }

    function spectrumValue(frequency, params) {
      const Pg = safeNumber(params.signalPower, 1.5);
      const beta = Math.max(1, safeNumber(params.beta, 14));
      const f = Math.abs(frequency);
      const kind = getCorrelationKind(params);

      if (kind === "exponential") return (2 * Pg * beta) / (beta * beta + Math.pow(2 * Math.PI * f, 2));
      if (kind === "gaussian") return (Pg * Math.sqrt(2 * Math.PI) / beta) * Math.exp(-2 * Math.PI * Math.PI * f * f / (beta * beta));
      if (kind === "sinc") return f <= beta ? Pg / (2 * beta) : 0;

      const tauMax = kind === "cosineSquared" ? 0.5 / beta
        : kind === "cosineLimited" ? 0.25 / beta
        : kind === "sincSquared" ? 5 / beta
        : kind === "cosineRatio" ? 2 / beta
        : kind === "exponentialLinear" ? 8 / beta
        : 8 / beta;
      const value = 2 * integratePositive((tau) => correlationValue(tau, params) * Math.cos(2 * Math.PI * f * tau), 0, tauMax, 220);
      return Math.max(0, value);
    }

    function axes(W, H, yZero, xLabel, yLabel, options = {}) {
      const yAxis = clamp(yZero, 18, H - 24);
      let svg = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#1f2b26" stroke-width="1.4" />`;
      for (let i = 1; i < 6; i++) {
        const x = (W / 6) * i;
        svg += `<line x1="${x}" y1="1" x2="${x}" y2="${H - 1}" stroke="#b8c0bc" stroke-width="1" />`;
      }
      for (let i = 1; i < 5; i++) {
        const y = (H / 5) * i;
        svg += `<line x1="1" y1="${y}" x2="${W - 1}" y2="${y}" stroke="#b8c0bc" stroke-width="1" />`;
      }
      svg += `<line x1="0" y1="${yAxis}" x2="${W}" y2="${yAxis}" stroke="#1f2b26" stroke-width="1.8" />
        <line x1="2" y1="0" x2="2" y2="${H}" stroke="#1f2b26" stroke-width="1.8" />
        <path d="M ${W - 10} ${yAxis - 4} L ${W} ${yAxis} L ${W - 10} ${yAxis + 4}" fill="none" stroke="#1f2b26" stroke-width="1.8" />
        <path d="M -2 10 L 2 0 L 6 10" fill="none" stroke="#1f2b26" stroke-width="1.8" />
        <text x="${W - 36}" y="${Math.max(18, yAxis - 12)}" fill="#31433b" font-family="monospace" font-size="15">${xLabel}</text>
        <text x="14" y="24" fill="#31433b" font-family="monospace" font-size="15">${yLabel}</text>`;

      // Числовые отметки: не больше трёх по каждой оси
      const { xMin, xMax, yMin, yMax } = options;
      if (Number.isFinite(xMin) && Number.isFinite(xMax)) {
        const xPositions = [0, W / 2, W];
        const xValues = [xMin, (xMin + xMax) / 2, xMax];
        xPositions.forEach((x, i) => {
          svg += `<line x1="${x}" y1="${yAxis}" x2="${x}" y2="${yAxis + 5}" stroke="#1f2b26" stroke-width="1.4" />`;
          svg += `<text x="${x}" y="${yAxis + 18}" fill="#62716b" font-family="monospace" font-size="11" text-anchor="middle">${Number(xValues[i]).toFixed(1)}</text>`;
        });
      }
      if (Number.isFinite(yMin) && Number.isFinite(yMax)) {
        const yTicks = [
          { y: H - 6, value: yMin },
          { y: 10, value: yMax },
        ];
        if (yMin < 0 && yMax > 0) yTicks.push({ y: yAxis, value: 0 });
        yTicks.forEach(({ y, value }) => {
          svg += `<line x1="0" y1="${y}" x2="5" y2="${y}" stroke="#1f2b26" stroke-width="1.4" />`;
          svg += `<text x="8" y="${y + 4}" fill="#62716b" font-family="monospace" font-size="11">${Number(value).toFixed(2)}</text>`;
        });
      }
      return svg;
    }

    function drawXYCurve(samples, W, H, xMin, xMax, yMin, yMax, color, width = 2.5, alpha = 1) {
      const sx = (x) => ((x - xMin) / (xMax - xMin)) * W;
      const sy = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
      let d = "";
      samples.forEach(([x, y], index) => {
        d += `${index === 0 ? "M" : "L"} ${sx(x)} ${sy(y)} `;
      });
      return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-opacity="${alpha}" stroke-linejoin="round" />`;
    }

    function makeSamples(xMin, xMax, count, fn) {
      const samples = [];
      for (let i = 0; i < count; i++) {
        const x = xMin + (i / (count - 1)) * (xMax - xMin);
        samples.push([x, fn(x)]);
      }
      return samples;
    }

    function chartSvg({ W = 1000, H = 210, xMin, xMax, yMin, yMax, xLabel, yLabel, samples, color, width = 2.5, alpha = 1, extra = "" }) {
      const yZero = yMin < 0 && yMax > 0 ? H - ((0 - yMin) / (yMax - yMin)) * H : H - 18;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += axes(W, H, yZero, xLabel, yLabel, { xMin, xMax, yMin, yMax });
      svg += drawXYCurve(samples, W, H, xMin, xMax, yMin, yMax, color, width, alpha);
      svg += extra;
      svg += `</svg>`;
      return svg;
    }

    return { clamp, safeNumber, getSampleStep, getTimeSpanMs, indexToTimeMs, hashNoise, deterministicNormal, getCorrelationKind, getCorrelationMeta, normalCdf, laplacePhi, getAnalyticFilterError, getSpectrumWindow, getEta, getLevelProbabilitiesAnalytic, getZoomWindow, correlationValue, spectrumValue, axes, drawXYCurve, makeSamples, chartSvg };
  })();

  window.StageHandlers.source = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const vm = window.VisualMath;
      const dfg = vm.safeNumber(params.signalBandwidth, 28);
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const sigmaG = Math.sqrt(Pg);
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;

      SignalData.g_t = new Array(N).fill(0);
      const spectrumWindow = vm.getSpectrumWindow(params);
      const componentCount = 96;
      const df = spectrumWindow.max / componentCount;
      const components = [];

      for (let m = 0; m < componentCount; m++) {
        const frequency = (m + 0.5) * df;
        const spectralDensity = vm.spectrumValue(frequency, params);
        const baseAmplitude = Math.sqrt(Math.max(0, 2 * spectralDensity * df));
        const jitter = 0.75 + 0.5 * vm.hashNoise(m, 7);
        components.push({
          frequency,
          amplitude: baseAmplitude * jitter,
          phase: 2 * Math.PI * vm.hashNoise(m, 13),
        });
      }

      for (let i = 0; i < N; i++) {
        const t = vm.indexToTimeMs(i, N, params);
        let value = 0;
        for (const component of components) {
          value += component.amplitude * Math.cos(2 * Math.PI * component.frequency * t + component.phase);
        }
        SignalData.g_t[i] = value;
      }

      const mean = SignalData.g_t.reduce((a, b) => a + b, 0) / N;
      const variance = SignalData.g_t.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / N;
      const currentStdDev = Math.sqrt(variance) || 1;
      const scale = sigmaG / currentStdDev;

      for (let i = 0; i < N; i++) {
        SignalData.g_t[i] = (SignalData.g_t[i] - mean) * scale;
      }
      SignalData.source_components = components.map((component) => ({ ...component, amplitude: component.amplitude * scale }));
      SignalData.source_time_span_ms = vm.getTimeSpanMs(params);
      SignalData.source_sigma = sigmaG;
      let spectralEnergy = 0;
      let previousF = 0;
      let previousY = vm.spectrumValue(0, params);
      for (let i = 1; i <= 360; i++) {
        const f = (i / 360) * spectrumWindow.max;
        const y = vm.spectrumValue(f, params);
        spectralEnergy += (f - previousF) * (y + previousY) / 2;
        previousF = f;
        previousY = y;
      }
      SignalData.source_spectrum_energy = 2 * spectralEnergy;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, yZero, drawCurveSVG } = helpers;
      const vm = window.VisualMath;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const beta = vm.safeNumber(params.beta, 14);
      const dfg = vm.safeNumber(params.signalBandwidth, 28);
      const sigmaG = Math.sqrt(Pg);

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "t, мс", "g(t), В", { xMin: 0, xMax: vm.getTimeSpanMs(params), yMin: SignalData.yMin, yMax: SignalData.yMax });
      const yPlus = getY(3 * sigmaG);
      const yMinus = getY(-3 * sigmaG);
      timeSvg += `<line x1="0" y1="${yPlus}" x2="${W}" y2="${yPlus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      timeSvg += `<line x1="0" y1="${yMinus}" x2="${W}" y2="${yMinus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      timeSvg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5);
      timeSvg += `</svg>`;

      const tauMax = Math.max(0.18, 4 / Math.max(beta, 1));
      const corrSamples = vm.makeSamples(-tauMax, tauMax, 220, (tau) => vm.correlationValue(tau, params));
      const corrSvg = vm.chartSvg({
        W, H: 220, xMin: -tauMax, xMax: tauMax, yMin: -Pg * 0.25, yMax: Pg * 1.08,
        xLabel: "τ, мс", yLabel: "B_c(τ), В²", samples: corrSamples, color: "#7554aa"
      });

      const fMax = Math.max(dfg * 2.4, beta * 4);
      const spectrumSamples = vm.makeSamples(-fMax, fMax, 260, (f) => vm.spectrumValue(f, params));
      const spectrumPeak = Math.max(...spectrumSamples.map(([, y]) => y), 0.0001);
      const dfgX = (f) => ((f + fMax) / (2 * fMax)) * W;
      const spectrumExtra = `<line x1="${dfgX(-dfg)}" y1="18" x2="${dfgX(-dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(dfg)}" y1="18" x2="${dfgX(dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(-dfg)}" y1="28" x2="${dfgX(dfg)}" y2="28" stroke="#e74c3c" stroke-width="1.5" />`;
      const spectrumSvg = vm.chartSvg({
        W, H: 220, xMin: -fMax, xMax: fMax, yMin: 0, yMax: spectrumPeak * 1.1,
        xLabel: "f, кГц", yLabel: "G_g(f), В²/кГц", samples: spectrumSamples, color: "#287c9f", extra: spectrumExtra
      });
      const pdfNote = `<div class="stage-panel__info-box">Одномерная плотность вероятности гауссовского сигнала: \\( W_g(u)=\\dfrac{1}{\\sigma_g\\sqrt{2\\pi}}\\exp\\left(-\\dfrac{u^2}{2\\sigma_g^2}\\right) \\), где \\( \\sigma_g=${sigmaG.toFixed(3)} \\) В.</div>`;
      const sourceScale = `<dl class="visual-scale"><div><dt>Разброс амплитуд</dt><dd>±3σg=±${(3 * sigmaG).toFixed(3)} В</dd></div><div><dt>Полоса сообщения</dt><dd>Δfg=${dfg.toFixed(2)} кГц</dd></div><div><dt>Окно времени</dt><dd>${vm.getTimeSpanMs(params).toFixed(3)} мс</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Временная диаграмма g(t)</p>${sourceScale}${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Корреляционная функция B_c(τ)</p>${sourceScale}${corrSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Энергетический спектр G_g(f)</p>${sourceScale}${spectrumSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Плотность вероятности W_g(u)</p>${pdfNote}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const Pg = parseFloat(params.signalPower) || 1.5;
      const beta = parseFloat(params.beta) || 14;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const sigmaG = Math.sqrt(Pg);
      const meta = window.VisualMath.getCorrelationMeta(params);
      const kActual = parseFloat(params.bandwidthFactor) || meta.k;
      let theory = "Источник моделирует сообщение как стационарный гауссовский процесс. Его форма важна сразу в трёх областях: во времени, через корреляцию и через спектральную плотность мощности.";
      let formulas = `<div class="formula-preview"><span>Мощность сигнала</span>\\[ P_g = \\sigma_g^2 = ${toLatexNumber(Pg)} \\text{ В}^2, \\quad \\sigma_g = ${toLatexNumber(sigmaG.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Корреляционная функция варианта</span>\\[ ${params.correlationFunction || "B_c(\\tau)"} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ширина спектра по коэффициенту формы</span>\\[ \\Delta f_g = k\\beta = ${toLatexNumber(kActual)}\\cdot ${toLatexNumber(beta)} = ${toLatexNumber(dfg)} \\text{ кГц} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему такой k:</strong><br>В варианте задана ${meta.title}; табличное значение для этой формы корреляции: \\(k=${toLatexNumber(meta.k)}\\). Если поле \\(k\\) изменено вручную, графики используют фактическое значение из формы.</div>`;
      formulas += `<div class="formula-preview"><span>Аналитический результат Винера-Хинчина</span>\\[ G_g(f)=\\int_{-\\infty}^{\\infty}B_c(\\tau)e^{-j2\\pi f\\tau}d\\tau, \\qquad ${meta.spectrumLatex} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
