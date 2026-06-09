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
      return Math.max(6, Math.floor(2500 / fd));
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
          etaLatex: String.raw`\eta=\dfrac{1}{1-\exp\left(-\dfrac{1}{2\alpha^2}\right)}`,
        },
        cosineSquared: {
          title: "ограниченная функция вида cos^2",
          k: 1.5,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g\cos^2(\pi\beta\tau)\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{1-\cos^2\left(\dfrac{\pi}{3\alpha}\right)}`,
        },
        gaussian: {
          title: "гауссовская корреляционная функция",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\dfrac{P_g\sqrt{2\pi}}{\beta}\exp\left(-\dfrac{2\pi^2f^2}{\beta^2}\right)`,
          etaLatex: String.raw`\eta=\dfrac{1}{1-\exp\left(-\dfrac{1}{2\alpha^2}\right)}`,
        },
        sinc: {
          title: "sinc-корреляционная функция",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\begin{cases}\dfrac{P_g}{2\beta},& |f|\le\beta,\\0,& |f|>\beta,\end{cases}`,
          etaLatex: String.raw`\eta=1`,
        },
        sincSquared: {
          title: "квадрат sinc-корреляционной функции",
          k: 1,
          spectrumLatex: String.raw`G_g(f)=\dfrac{P_g}{2\beta}\Lambda\left(\dfrac{f}{2\beta}\right)`,
          etaLatex: String.raw`\eta=1`,
        },
        cosineRatio: {
          title: "дробно-косинусная корреляционная функция",
          k: 4,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{\dfrac{P_g\cos(2\pi\beta\tau)}{1-(4\beta\tau)^2}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{1-\cos^2\left(\dfrac{\pi}{3\alpha}\right)}`,
        },
        cosineLimited: {
          title: "ограниченная косинусная корреляционная функция",
          k: 3,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g\cos(2\pi\beta\tau), |\tau|\le\dfrac{1}{4\beta}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{1-\cos^2\left(\dfrac{\pi}{3\alpha}\right)}`,
        },
        exponentialLinear: {
          title: "экспоненциально-линейная корреляционная функция",
          k: 2,
          spectrumLatex: String.raw`G_g(f)=\mathcal{F}\left\{P_g(1-\beta|\tau|)e^{-\beta|\tau|}\right\}`,
          etaLatex: String.raw`\eta=\dfrac{1}{1-\exp\left(-\dfrac{1}{2\alpha^2}\right)}`,
        },
      };
      const meta = metas[kind] || metas.exponential;
      return { kind, ...meta };
    }

    function normalCdf(x) {
      const sign = x < 0 ? -1 : 1;
      const absX = Math.abs(x);
      const t = 1 / (1 + 0.3275911 * absX);
      const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
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
      const fMax = Math.max(dfg * 40, 200);
      const total = 2 * integratePositive((f) => spectrumValue(f, params), 0, fMax);
      const tail = 2 * integratePositive((f) => spectrumValue(f, params), dfg, fMax);
      return total > 0 ? tail / total : 0;
    }

    function getEta(params) {
      const alpha = safeNumber(params.samplingIncrease, 2);
      const kind = getCorrelationKind(params);
      if (["cosineSquared", "cosineRatio", "cosineLimited"].includes(kind)) {
        const denominator = 1 - Math.pow(Math.cos(Math.PI / (3 * alpha)), 2);
        return denominator > 0 ? 1 / denominator : 1;
      }
      if (["sinc", "sincSquared"].includes(kind)) return 1;
      const denominator = 1 - Math.exp(-1 / (2 * alpha * alpha));
      return denominator > 0 ? 1 / denominator : 1;
    }

    function getLevelProbabilitiesAnalytic(params, levels, dU) {
      const sigma = Math.sqrt(safeNumber(params.signalPower, 1.5));
      return levels.map((level, index) => {
        const left = index === 0 ? -Infinity : level - dU / 2;
        const right = index === levels.length - 1 ? Infinity : level + dU / 2;
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
      const dfg = Math.max(1, safeNumber(params.signalBandwidth, 28));
      const x = Math.abs(frequency) / dfg;
      const kind = getCorrelationKind(params);

      let shape = 0;
      if (kind === "exponential") shape = 1 / (1 + Math.pow(2.4 * x, 2));
      else if (kind === "cosineSquared") shape = x <= 1 ? 0.5 + 0.5 * Math.cos(Math.PI * x) : 0;
      else if (kind === "gaussian") shape = Math.exp(-2.2 * x * x);
      else if (kind === "sinc") shape = x <= 1 ? 1 : 0.06 * Math.exp(-2 * (x - 1));
      else if (kind === "sincSquared") shape = x <= 1 ? 1 - x : 0;
      else if (kind === "cosineRatio") shape = x <= 1.2 ? 0.5 + 0.5 * Math.cos(Math.PI * x / 1.2) : 0;
      else if (kind === "cosineLimited") shape = x <= 1 ? Math.pow(Math.cos(Math.PI * x / 2), 2) : 0;
      else if (kind === "exponentialLinear") shape = 1 / Math.pow(1 + Math.pow(1.8 * x, 2), 2);
      return Pg * Math.max(0, shape);
    }

    function axes(W, H, yZero, xLabel, yLabel) {
      return `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" />
        <line x1="2" y1="0" x2="2" y2="${H}" stroke="#d5ddd8" stroke-width="2" />
        <text x="${W - 30}" y="${yZero - 12}" fill="#62716b" font-family="monospace" font-size="15">${xLabel}</text>
        <text x="14" y="24" fill="#62716b" font-family="monospace" font-size="15">${yLabel}</text>`;
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
      svg += axes(W, H, yZero, xLabel, yLabel);
      svg += drawXYCurve(samples, W, H, xMin, xMax, yMin, yMax, color, width, alpha);
      svg += extra;
      svg += `</svg>`;
      return svg;
    }

    return { clamp, safeNumber, getSampleStep, getCorrelationKind, getCorrelationMeta, normalCdf, laplacePhi, getAnalyticFilterError, getEta, getLevelProbabilitiesAnalytic, getZoomWindow, correlationValue, spectrumValue, axes, drawXYCurve, makeSamples, chartSvg };
  })();

  window.StageHandlers.source = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const sigmaG = Math.sqrt(Pg);
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;

      SignalData.g_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        SignalData.g_t[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }

      const smoothed = new Array(N).fill(0);
      const w1 = Math.max(3, Math.floor(600 / dfg));
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w1); j <= Math.min(N - 1, i + w1); j++) {
          sum += SignalData.g_t[j];
          count++;
        }
        smoothed[i] = sum / count;
      }

      const mean = smoothed.reduce((a, b) => a + b) / N;
      const variance = smoothed.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / N;
      const currentStdDev = Math.sqrt(variance) || 1;

      for (let i = 0; i < N; i++) {
        SignalData.g_t[i] = ((smoothed[i] - mean) / currentStdDev) * sigmaG;
      }
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, yZero, drawCurveSVG } = helpers;
      const vm = window.VisualMath;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const beta = vm.safeNumber(params.beta, 14);
      const dfg = vm.safeNumber(params.signalBandwidth, 28);
      const sigmaG = Math.sqrt(Pg);

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "t", "g(t)");
      const yPlus = getY(3 * sigmaG);
      const yMinus = getY(-3 * sigmaG);
      const valLabel = (3 * sigmaG).toFixed(2);
      timeSvg += `<line x1="0" y1="${yPlus}" x2="${W}" y2="${yPlus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      timeSvg += `<text x="15" y="${yPlus - 8}" fill="#62716b" font-family="monospace" font-size="14">+3σ_g (${valLabel} В)</text>`;
      timeSvg += `<line x1="0" y1="${yMinus}" x2="${W}" y2="${yMinus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      timeSvg += `<text x="15" y="${yMinus + 16}" fill="#62716b" font-family="monospace" font-size="14">-3σ_g (-${valLabel} В)</text>`;
      timeSvg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5);
      timeSvg += `</svg>`;

      const tauMax = Math.max(0.18, 4 / Math.max(beta, 1));
      const corrSamples = vm.makeSamples(-tauMax, tauMax, 220, (tau) => vm.correlationValue(tau, params));
      const corrSvg = vm.chartSvg({
        W, H: 220, xMin: -tauMax, xMax: tauMax, yMin: -Pg * 0.25, yMax: Pg * 1.08,
        xLabel: "τ", yLabel: "B_c(τ)", samples: corrSamples, color: "#7554aa"
      });

      const fMax = Math.max(dfg * 2.4, beta * 4);
      const spectrumSamples = vm.makeSamples(-fMax, fMax, 260, (f) => vm.spectrumValue(f, params));
      const dfgX = (f) => ((f + fMax) / (2 * fMax)) * W;
      const spectrumExtra = `<line x1="${dfgX(-dfg)}" y1="18" x2="${dfgX(-dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(dfg)}" y1="18" x2="${dfgX(dfg)}" y2="202" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${dfgX(-dfg)}" y1="28" x2="${dfgX(dfg)}" y2="28" stroke="#e74c3c" stroke-width="1.5" />
        <text x="${W / 2}" y="22" fill="#e74c3c" font-family="monospace" font-size="14" text-anchor="middle">Δf_g = ${dfg.toFixed(2)}</text>`;
      const spectrumSvg = vm.chartSvg({
        W, H: 220, xMin: -fMax, xMax: fMax, yMin: 0, yMax: Pg * 1.08,
        xLabel: "f", yLabel: "G_g(f)", samples: spectrumSamples, color: "#287c9f", extra: spectrumExtra
      });

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Временная диаграмма g(t)</p>${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Корреляционная функция B_c(τ)</p>${corrSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Энергетический спектр G_g(f)</p>${spectrumSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const Pg = parseFloat(params.signalPower) || 1.5;
      const beta = parseFloat(params.beta) || 14;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const sigmaG = Math.sqrt(Pg);
      const meta = window.VisualMath.getCorrelationMeta(params);
      let theory = "Источник моделирует сообщение как стационарный гауссовский процесс. Его форма важна сразу в трёх областях: во времени, через корреляцию и через спектральную плотность мощности.";
      let formulas = `<div class="formula-preview"><span>Мощность сигнала</span>\\[ P_g = \\sigma_g^2 = ${toLatexNumber(Pg)} \\text{ В}^2, \\quad \\sigma_g = ${toLatexNumber(sigmaG.toFixed(3))} \\text{ В} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Корреляционная функция варианта</span>\\[ ${params.correlationFunction || "B_c(\\tau)"} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ширина спектра по табличному коэффициенту формы</span>\\[ \\Delta f_g = k\\beta = ${toLatexNumber(meta.k)}\\cdot ${toLatexNumber(beta)} = ${toLatexNumber(dfg)} \\text{ кГц} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Почему выбран этот k:</strong><br>В варианте задана ${meta.title}; для такой корреляционной функции методическая таблица задаёт коэффициент связи ширины спектра с параметром \\(\\beta\\): \\(k=${toLatexNumber(meta.k)}\\). Поэтому изменение \\(\\beta\\) или \\(k\\) в форме сразу меняет масштаб спектра на графике.</div>`;
      formulas += `<div class="formula-preview"><span>Аналитический результат Винера-Хинчина</span>\\[ G_g(f)=\\int_{-\\infty}^{\\infty}B_c(\\tau)e^{-j2\\pi f\\tau}d\\tau, \\qquad ${meta.spectrumLatex} \\]</div>`;
      return { theory, formulas };
    }
  };
})();
