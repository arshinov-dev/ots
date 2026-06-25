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

    function chooseDynamicWindow(values, options = {}) {
      const total = Array.isArray(values) ? values.length : 0;
      if (!total) return { start: 0, end: 0, length: 0, values: [] };

      // Сквозные временные графики используют один интервал исходной сетки.
      // Для массивов отсчётов переводим его в их локальные индексы.
      const signalData = window.SignalData;
      const shared = !options.ignoreShared && signalData && signalData.shared_time_window;
      if (shared) {
        let start = 0;
        let end = total;
        const fullRateArrays = [signalData.g_t, signalData.x_t, signalData.x_hat_t, signalData.g_hat_t];
        if (fullRateArrays.includes(values)) {
          start = clamp(shared.start, 0, Math.max(0, total - 1));
          end = clamp(shared.end, start + 1, total);
        } else {
          const sampleArrays = [
            signalData.sampled_x_values, signalData.quantized_indices, signalData.quantized_v,
            signalData.v_hat, signalData.decoded_indices
          ];
          if (sampleArrays.includes(values)) {
            const step = Math.max(1, signalData.sampling_step_indices || 1);
            start = clamp(Math.floor(shared.start / step), 0, Math.max(0, total - 1));
            end = clamp(Math.ceil(shared.end / step), start + 1, total);
          } else {
            start = -1;
          }
        }
        if (start >= 0) {
          return { start, end, length: end - start, values: values.slice(start, end) };
        }
      }

      const minLength = Math.min(total, Math.max(8, options.minLength || 80));
      const targetLength = options.length || Math.round(total * (options.fraction || 0.28));
      const length = Math.min(total, Math.max(minLength, targetLength));
      if (length === total) return { start: 0, end: total, length, values: values.slice() };

      let bestStart = 0;
      let bestScore = -Infinity;
      const stride = Math.max(1, Math.floor(length / 16));
      const lastStart = total - length;
      const candidateStarts = [];
      for (let start = 0; start <= lastStart; start += stride) candidateStarts.push(start);
      if (candidateStarts[candidateStarts.length - 1] !== lastStart) candidateStarts.push(lastStart);
      candidateStarts.forEach((start) => {
        let min = Infinity;
        let max = -Infinity;
        let variation = 0;
        let turns = 0;
        let previousDelta = 0;
        for (let i = start; i < start + length; i++) {
          const value = values[i];
          min = Math.min(min, value);
          max = Math.max(max, value);
          if (i > start) {
            const delta = value - values[i - 1];
            variation += Math.abs(delta);
            if (previousDelta && delta && Math.sign(delta) !== Math.sign(previousDelta)) turns++;
            if (delta) previousDelta = delta;
          }
        }
        const range = max - min;
        const score = range + variation / length + (turns / length) * range;
        if (score > bestScore) {
          bestScore = score;
          bestStart = start;
        }
      });
      return { start: bestStart, end: bestStart + length, length, values: values.slice(bestStart, bestStart + length) };
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
      const formatTick = (value) => {
        const magnitude = Math.abs(value);
        const digits = magnitude >= 10 ? 0 : magnitude >= 1 ? 1 : 2;
        return Number(value.toFixed(digits)).toString();
      };
      let svg = `<rect class="plot-frame" x="1" y="1" width="${W - 2}" height="${H - 2}" />
        <line class="plot-grid" x1="${W / 2}" y1="1" x2="${W / 2}" y2="${H - 1}" />
        <line class="plot-grid" x1="1" y1="${H / 2}" x2="${W - 1}" y2="${H / 2}" />
        <line class="plot-axis" x1="0" y1="${yAxis}" x2="${W}" y2="${yAxis}" />
        <line class="plot-axis" x1="2" y1="0" x2="2" y2="${H}" />
        <path class="plot-axis-arrow" d="M ${W - 10} ${yAxis - 4} L ${W} ${yAxis} L ${W - 10} ${yAxis + 4}" />
        <path class="plot-axis-arrow" d="M -2 10 L 2 0 L 6 10" />
        <text class="plot-axis-label" x="${W - 12}" y="${Math.max(18, yAxis - 12)}" text-anchor="end">${xLabel}</text>
        <text class="plot-axis-label" x="14" y="24">${yLabel}</text>`;

      // Числовые отметки: не больше трёх по каждой оси
      const { xMin, xMax, yMin, yMax } = options;
      if (Number.isFinite(xMin) && Number.isFinite(xMax)) {
        const xPositions = [2, W / 2, W - 2];
        const xValues = [xMin, (xMin + xMax) / 2, xMax];
        const textAnchors = ["start", "middle", "end"];
        xPositions.forEach((x, i) => {
          svg += `<line class="plot-tick" x1="${x}" y1="${yAxis}" x2="${x}" y2="${yAxis + 5}" />`;
          svg += `<text class="plot-tick-label" x="${x}" y="${yAxis + 18}" text-anchor="${textAnchors[i]}">${formatTick(xValues[i])}</text>`;
        });
      }
      if (Number.isFinite(yMin) && Number.isFinite(yMax)) {
        const middleValue = yMin < 0 && yMax > 0 ? 0 : (yMin + yMax) / 2;
        const middleY = H - ((middleValue - yMin) / (yMax - yMin)) * H;
        const yTicks = [
          { y: H - 2, value: yMin },
          { y: clamp(middleY, 2, H - 2), value: middleValue },
          { y: 2, value: yMax },
        ];
        yTicks.forEach(({ y, value }) => {
          svg += `<line class="plot-tick" x1="0" y1="${y}" x2="5" y2="${y}" />`;
          svg += `<text class="plot-tick-label" x="8" y="${clamp(y + 4, 11, H - 4)}">${formatTick(value)}</text>`;
        });
      }
      if (options.note) {
        svg += `<text class="plot-note" x="${W - 12}" y="18" text-anchor="end">${options.note}</text>`;
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

    // Обратное преобразование: время (мс) → индекс на сетке из count точек.
    // indexToTimeMs(index, count, params) = (index/(count-1))*span  ⇒  index = (t/span)*(count-1)
    function timeToIndex(timeMs, count, params) {
      const n = Math.max(1, count - 1);
      const span = getTimeSpanMs(params);
      if (!span) return 0;
      return Math.round((timeMs / span) * n);
    }

    // Downsample массива значений в buckets: каждый bucket = [min, max] значений.
    // Возвращает плоский массив пар [{i, min, max}, ...] длиной ≤ buckets.
    // Используется для overview-полосы полного g(t): ~400–800 вертикальных линий.
    function downsampleMinMax(values, buckets) {
      const n = values.length;
      if (!n) return [];
      const target = Math.max(1, Math.min(buckets || 600, n));
      const bucketSize = n / target;
      const result = [];
      for (let b = 0; b < target; b++) {
        const lo = Math.floor(b * bucketSize);
        const hi = Math.max(lo + 1, Math.floor((b + 1) * bucketSize));
        let mn = Infinity, mx = -Infinity;
        for (let i = lo; i < hi && i < n; i++) {
          if (values[i] < mn) mn = values[i];
          if (values[i] > mx) mx = values[i];
        }
        if (isFinite(mn)) result.push({ i: Math.floor((lo + hi - 1) / 2), min: mn, max: mx });
      }
      return result;
    }

    return { clamp, safeNumber, getSampleStep, getTimeSpanMs, indexToTimeMs, timeToIndex, downsampleMinMax, hashNoise, deterministicNormal, getCorrelationKind, getCorrelationMeta, normalCdf, laplacePhi, getAnalyticFilterError, getSpectrumWindow, getEta, getLevelProbabilitiesAnalytic, getZoomWindow, chooseDynamicWindow, correlationValue, spectrumValue, axes, drawXYCurve, makeSamples, chartSvg };
  })();

  window.StageHandlers.source = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const vm = window.VisualMath;
      const calculation = SignalData.calculation || window.SystemCalculations.calculate(params);
      const dfg = calculation.input.dfg;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const beta = vm.safeNumber(params.beta, 14);
      const sigmaG = Math.sqrt(Pg);
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;

      SignalData.g_t = new Array(N).fill(0);
      const spectrumWindow = vm.getSpectrumWindow(params);
      const componentCount = 96;
      const df = spectrumWindow.max / componentCount;
      const components = [];
      const correlationSalt = vm.getCorrelationKind(params).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const realizationSalt = 13 + beta * 0.37 + dfg * 0.11 + correlationSalt * 0.001;

      for (let m = 0; m < componentCount; m++) {
        const frequency = (m + 0.5) * df;
        const spectralDensity = vm.spectrumValue(frequency, params);
        const baseAmplitude = Math.sqrt(Math.max(0, 2 * spectralDensity * df));
        components.push({
          frequency,
          amplitude: baseAmplitude,
          phase: 2 * Math.PI * vm.hashNoise(m, realizationSalt),
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
      SignalData.source_component_count = componentCount;
      SignalData.source_frequency_step = df;
      SignalData.source_raw_mean = mean;
      SignalData.source_raw_variance = variance;
      SignalData.source_normalization_scale = scale;
      SignalData.source_sample_mean = SignalData.g_t.reduce((sum, value) => sum + value, 0) / N;
      SignalData.source_sample_variance = SignalData.g_t.reduce((sum, value) => sum + Math.pow(value - SignalData.source_sample_mean, 2), 0) / N;
      SignalData.source_bandwidth = dfg;
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
      const { W, H, getY, yZero } = helpers;
      const vm = window.VisualMath;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const beta = vm.safeNumber(params.beta, 14);
      const calculation = SignalData.calculation || window.SystemCalculations.calculate(params);
      const dfg = calculation.input.dfg;
      const sigmaG = Math.sqrt(Pg);
      const values = SignalData.g_t;

      const tw = (SignalData.sync && SignalData.sync.timeWindow) || { start: 0, end: SignalData.g_t.length };
      const dynStart = tw.start;
      const dynEnd = Math.min(tw.end, SignalData.g_t.length);
      const timeStart = vm.indexToTimeMs(dynStart, SignalData.g_t.length, params);
      const timeEnd = vm.indexToTimeMs(Math.max(dynStart, dynEnd - 1), SignalData.g_t.length, params);
      const timeSamples = SignalData.g_t.slice(dynStart, dynEnd).map((value, index) => [
        vm.indexToTimeMs(dynStart + index, SignalData.g_t.length, params),
        value
      ]);
      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "t, мс", "g(t), В", { xMin: timeStart, xMax: timeEnd, yMin: SignalData.yMin, yMax: SignalData.yMax });
      const yPlus = getY(sigmaG);
      const yMinus = getY(-sigmaG);
      timeSvg += `<line x1="0" y1="${yPlus}" x2="${W}" y2="${yPlus}" stroke="#b8c4be" stroke-dasharray="6,7" stroke-width="1.2" />
        <line x1="0" y1="${yMinus}" x2="${W}" y2="${yMinus}" stroke="#b8c4be" stroke-dasharray="6,7" stroke-width="1.2" />
        <text class="plot-note" x="${W - 12}" y="${yPlus - 6}" text-anchor="end">+σg</text>
        <text class="plot-note" x="${W - 12}" y="${yMinus - 6}" text-anchor="end">−σg</text>
        <text class="plot-note" x="12" y="${yZero - 7}">M{g}=0</text>`;
      timeSvg += vm.drawXYCurve(timeSamples, W, H, timeStart, timeEnd, SignalData.yMin, SignalData.yMax, '#287c9f', 2.5);
      timeSvg += `</svg>`;

      const tauMax = Math.max(0.18, 4 / Math.max(beta, 1));
      const corrSamples = vm.makeSamples(-tauMax, tauMax, 220, (tau) => vm.correlationValue(tau, params));
      const corrYMin = -Pg * 0.25;
      const corrYMax = Pg * 1.08;
      const corrPeakY = 220 - ((Pg - corrYMin) / (corrYMax - corrYMin)) * 220;
      const corrExtra = `<circle cx="${W / 2}" cy="${corrPeakY}" r="4" fill="#7554aa" />
        <text class="plot-note" x="${W / 2 + 10}" y="${Math.max(16, corrPeakY - 8)}">Bc(0)=Pg</text>`;
      const corrSvg = vm.chartSvg({
        W, H: 220, xMin: -tauMax, xMax: tauMax, yMin: corrYMin, yMax: corrYMax,
        xLabel: "τ, мс", yLabel: "B_c(τ), В²", samples: corrSamples, color: "#7554aa", extra: corrExtra
      });

      const fMax = Math.max(dfg * 2.4, beta * 4);
      const spectrumSamples = vm.makeSamples(-fMax, fMax, 260, (f) => vm.spectrumValue(f, params));
      const spectrumPeak = Math.max(...spectrumSamples.map(([, y]) => y), 0.0001);
      const dfgX = (f) => ((f + fMax) / (2 * fMax)) * W;
      const spectrumExtra = `<rect x="${dfgX(-dfg)}" y="1" width="${dfgX(dfg) - dfgX(-dfg)}" height="218" fill="#e74c3c" opacity="0.06" />
        <line x1="${dfgX(-dfg)}" y1="18" x2="${dfgX(-dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(dfg)}" y1="18" x2="${dfgX(dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(-dfg)}" y1="28" x2="${dfgX(dfg)}" y2="28" stroke="#e74c3c" stroke-width="1.5" />
        <text class="plot-note" x="${W / 2}" y="22" text-anchor="middle">Δfg</text>`;
      const spectrumSvg = vm.chartSvg({
        W, H: 220, xMin: -fMax, xMax: fMax, yMin: 0, yMax: spectrumPeak * 1.1,
        xLabel: "f", yLabel: "Gg(f)", samples: spectrumSamples, color: "#287c9f", extra: spectrumExtra
      });

      const binCount = 28;
      const xMin = -4 * sigmaG;
      const xMax = 4 * sigmaG;
      const binWidth = (xMax - xMin) / binCount;
      const counts = new Array(binCount).fill(0);
      values.forEach((value) => {
        if (value < xMin || value > xMax) return;
        const index = Math.min(binCount - 1, Math.floor((value - xMin) / binWidth));
        counts[index]++;
      });
      const density = counts.map((count) => count / (values.length * binWidth));
      const normalPdf = (u) => Math.exp(-(u * u) / (2 * sigmaG * sigmaG)) / (sigmaG * Math.sqrt(2 * Math.PI));
      const pdfSamples = vm.makeSamples(xMin, xMax, 240, normalPdf);
      const pdfYMax = Math.max(...density, normalPdf(0)) * 1.16;
      const pdfH = 280;
      const pdfX = (u) => ((u - xMin) / (xMax - xMin)) * W;
      const pdfY = (densityValue) => pdfH - (densityValue / pdfYMax) * pdfH;
      let histogramSvg = `<svg viewBox="0 0 ${W} ${pdfH}" width="100%" height="auto" class="stage-panel__visuals-svg source-histogram">`;
      histogramSvg += vm.axes(W, pdfH, pdfH - 18, "u", "Wg(u)", { xMin, xMax, yMin: 0, yMax: pdfYMax });
      density.forEach((densityValue, index) => {
        const x = pdfX(xMin + index * binWidth);
        const width = Math.max(1, pdfX(xMin + (index + 1) * binWidth) - x - 1);
        const y = pdfY(densityValue);
        histogramSvg += `<rect class="source-histogram__bar" x="${x}" y="${y}" width="${width}" height="${pdfH - y}" />`;
      });
      histogramSvg += vm.drawXYCurve(pdfSamples, W, pdfH, xMin, xMax, 0, pdfYMax, "#e74c3c", 3);
      [
        { value: -3 * sigmaG, label: "−3σg" }, { value: -sigmaG, label: "−σg" },
        { value: 0, label: "0" }, { value: sigmaG, label: "+σg" },
        { value: 3 * sigmaG, label: "+3σg" }
      ].forEach(({ value, label }, index) => {
        const x = pdfX(value);
        const labelY = index % 2 ? 48 : 32;
        histogramSvg += `<line class="source-histogram__marker" x1="${x}" y1="20" x2="${x}" y2="${pdfH - 18}" />
          <text class="plot-note" x="${x}" y="${labelY}" text-anchor="middle">${label}</text>`;
      });
      histogramSvg += `</svg>`;

      const timeScale = `<dl class="visual-scale"><div><dt>Среднее</dt><dd>\\(M\{g\}=0\\) В</dd></div><div><dt>СКО</dt><dd>\\(\\sigma_g=${sigmaG.toFixed(3)}\\) В</dd></div><div><dt>Окно</dt><dd>${(timeEnd - timeStart).toFixed(3)} мс</dd></div></dl>`;
      const corrScale = `<dl class="visual-scale"><div><dt>В нуле</dt><dd>\\(B_c(0)=P_g=${Pg.toFixed(3)}\\) В²</dd></div><div><dt>Параметр формы</dt><dd>\\(\\beta=${beta.toFixed(2)}\\) мс⁻¹</dd></div><div><dt>Диапазон</dt><dd>±${tauMax.toFixed(3)} мс</dd></div></dl>`;
      const spectrumScale = `<dl class="visual-scale"><div><dt>Полоса</dt><dd>\\(\\Delta f_g=${dfg.toFixed(2)}\\) кГц</dd></div><div><dt>Распределение</dt><dd>\\(G_g(f)\\), В²/кГц</dd></div></dl>`;
      const pdfScale = `<dl class="visual-scale"><div><dt>Интервалы</dt><dd>${binCount}</dd></div><div><dt>Диапазон</dt><dd>\\(\\pm4\\sigma_g\\)</dd></div><div><dt>Выборка</dt><dd>${values.length} значений</dd></div></dl>`;

      const caption = (shown, next, note = "") => `<div class="stage-visual-caption"><p><strong>Показывает:</strong> ${shown}</p><p><strong>Нужно дальше:</strong> ${next}</p>${note ? `<p class="stage-visual-caption__note">${note}</p>` : ""}</div>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">1. Временная реализация \\(g(t)\\)</p>${timeScale}${timeSvg}${caption("одну синтезированную реализацию случайного процесса \\(g(t)\\).", "этот же сигнал проходит через ФНЧ, дискретизатор, квантователь и восстановление.")}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">2. Корреляционная функция \\(B_c(\\tau)\\)</p>${corrScale}${corrSvg}${caption("как быстро значения процесса теряют связь при увеличении \\(\\tau\\).", "форма \\(B_c(\\tau)\\) задаёт спектральную плотность \\(G_g(f)\\).")}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">3. Спектральная плотность \\(G_g(f)\\)</p>${spectrumScale}${spectrumSvg}${caption("как мощность процесса распределена по частотам.", "по \\(G_g(f)\\) выбираются гармонические компоненты и определяется рабочая полоса \\(\\Delta f_g\\).")}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">4. Гистограмма значений \\(g(t)\\) и теоретическая ФПВ \\(W_g(u)\\)</p>${pdfScale}${histogramSvg}<div class="stage-panel__info-box source-pdf-formula">\\(W_g(u)=\\dfrac{1}{\\sigma_g\\sqrt{2\\pi}}\\exp\\left(-\\dfrac{u^2}{2\\sigma_g^2}\\right)\\), где \\(\\sigma_g=\\sqrt{P_g}=${sigmaG.toFixed(3)}\\text{ В}\\).</div>${caption("распределение значений текущей реализации \\(g(t)\\).", "гауссовская ФПВ \\(W_g(u)\\) используется при расчёте вероятностей уровней квантования.", "Из-за конечной длины реализации гистограмма только приближает теоретическую ФПВ.")}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const Pg = parseFloat(params.signalPower) || 1.5;
      const beta = parseFloat(params.beta) || 14;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const sigmaG = Math.sqrt(Pg);
      const meta = window.VisualMath.getCorrelationMeta(params);
      const kActual = parseFloat(params.bandwidthFactor) || meta.k;
      let theory = "Источник формирует синтезированную реализацию стационарного гауссовского случайного процесса: 96 косинусоид получают амплитуды из спектральной плотности, суммируются, центрируются и нормируются к заданной мощности. Поэтому временной график, корреляция, спектр и гистограмма описывают одну согласованную модель.";
      let formulas = `<div class="formula-preview"><span>Мощность сигнала</span>\\[ P_g = \\sigma_g^2 = ${toLatexNumber(Pg)} \\text{ В}^2, \\quad \\sigma_g = ${toLatexNumber(sigmaG.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Корреляционная функция варианта</span>\\[ ${params.correlationFunction || "B_c(\\tau)"} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ширина спектра по коэффициенту формы</span>\\[ \\Delta f_g = k\\beta = ${toLatexNumber(kActual)}\\cdot ${toLatexNumber(beta)} = ${toLatexNumber(dfg)} \\text{ кГц} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему такой k:</strong><br>В варианте задана ${meta.title}; табличное значение для этой формы корреляции: \\(k=${toLatexNumber(meta.k)}\\). Если поле \\(k\\) изменено вручную, графики используют фактическое значение из формы.</div>`;
      formulas += `<div class="formula-preview"><span>Аналитический результат Винера-Хинчина</span>\\[ G_g(f)=\\int_{-\\infty}^{\\infty}B_c(\\tau)e^{-j2\\pi f\\tau}d\\tau, \\qquad ${meta.spectrumLatex} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
