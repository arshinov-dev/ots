const stages = [
  {
    id: "source",
    title: "Источник и первичный преобразователь",
    group: "source",
    signal: "c(t) → g(t)",
  },
  {
    id: "tx-filter",
    title: "Передающий ФНЧ",
    group: "tx",
    signal: "g(t) → x(t)",
  },
  {
    id: "sampler",
    title: "Дискретизатор АЦП",
    group: "tx",
    signal: "x(t) → x(k · Δt)",
  },
  {
    id: "quantizer",
    title: "Квантователь АЦП",
    group: "tx",
    signal: "x(k · Δt) → vₖʲ",
  },
  {
    id: "encoder",
    title: "Кодер АЦП",
    group: "tx",
    signal: "vₖʲ → bₖᵘ",
  },
  {
    id: "modulator",
    title: "Модулятор и выход ПДУ",
    group: "tx",
    signal: "bₖᵘ + uₙ(t) → S(t)",
  },
  {
    id: "channel",
    title: "Непрерывный канал связи",
    group: "channel",
    signal: "S(t) + n(t) → z(t)",
  },
  {
    id: "detector",
    title: "Вход ПРУ, детектор и РУ",
    group: "rx",
    signal: "z(t) → b̂ₖᵘ",
  },
  {
    id: "decoder",
    title: "Декодер и интерполятор ЦАП",
    group: "rx",
    signal: "b̂ₖᵘ → x̂(t)",
  },
  {
    id: "recipient",
    title: "Приёмный ФНЧ и получатель",
    group: "rx",
    signal: "x̂(t) → ĉ(t)",
  },
];

const route = document.querySelector("[data-signal-route]");
const panel = document.querySelector("[data-stage-panel]");
const year = document.querySelector("[data-current-year]");
const parametersForm = document.querySelector("[data-parameters-form]");
const summary = document.querySelector("[data-parameters-summary]");
const summaryTitle = document.querySelector("[data-summary-title]");
const summaryDescription = document.querySelector("[data-summary-description]");
const primaryFrequencyLabel = document.querySelector(
  "[data-primary-frequency-label]",
);
const primaryFrequencyDescription = document.querySelector(
  "[data-primary-frequency-description]",
);
const secondaryFrequencyField = document.querySelector(
  "[data-secondary-frequency-field]",
);
const variantPreset = document.querySelector("[data-variant-preset]");
const receptionDescription = document.querySelector(
  "[data-reception-description]",
);
const summaryReceptionDescription = document.querySelector(
  "[data-summary-reception-description]",
);
const correlationPreview = document.querySelector(
  "[data-correlation-preview]",
);
const summaryCorrelationFormula = document.querySelector(
  "[data-summary-correlation-formula]",
);
const summaryBandwidthFormula = document.querySelector(
  "[data-summary-bandwidth-formula]",
);
let isApplyingVariant = false;
let mathRenderTimeout;

const modulationOptions = {
  DAM: {
    title: "ДАМ · дискретная амплитудная модуляция",
    description: "Двоичный код управляет амплитудой гармонической несущей.",
    primaryFrequencyLabel: "f<sub>0</sub>",
    primaryFrequencyDescription: "Несущая частота, МГц",
    receptions: [
      ["KO", "КО · когерентный приём"],
      ["NO", "НО · некогерентный приём"],
    ],
  },
  DCHM: {
    title: "ДЧМ · дискретная частотная модуляция",
    description: "Двоичный код переключает несущую между частотами f₁ и f₂.",
    primaryFrequencyLabel: "f<sub>2</sub>",
    primaryFrequencyDescription: "Нижняя несущая частота, МГц",
    receptions: [
      ["KO", "КО · когерентный приём"],
      ["NO", "НО · некогерентный приём"],
    ],
  },
  DOFM: {
    title: "ДОФМ · дискретная относительная фазовая модуляция",
    description: "Двоичный код управляет относительным изменением фазы несущей.",
    primaryFrequencyLabel: "f<sub>0</sub>",
    primaryFrequencyDescription: "Несущая частота, МГц",
    receptions: [
      ["SF", "СФ · сравнение фаз"],
      ["SP", "СП · сравнение полярностей"],
    ],
  },
};

const correlationGroups = {
  exponential: {
    latex: String.raw`B_c(\tau) = P_g \cdot e^{-\beta |\tau|}, \quad -\infty < \tau < \infty`,
    bandwidthFactor: 2,
  },
  cosineSquared: {
    latex: String.raw`B_c(\tau) = \begin{cases} P_g \cos^2(\pi \beta \tau), & |\tau| \le \dfrac{1}{2\beta}, \\ 0, & |\tau| > \dfrac{1}{2\beta}. \end{cases}`,
    bandwidthFactor: 1.5,
  },
  gaussian: {
    latex: String.raw`B_c(\tau) = P_g \cdot e^{-0{,}5 \beta^2 \tau^2}, \quad -\infty < \tau < \infty`,
    bandwidthFactor: 1,
  },
  sinc: {
    latex: String.raw`B_c(\tau) = P_g \cdot \dfrac{\sin(2\pi \beta \tau)}{2\pi \beta \tau}, \quad -\infty < \tau < \infty`,
    bandwidthFactor: 1,
  },
  sincSquared: {
    latex: String.raw`B_c(\tau) = P_g \cdot \left[\dfrac{\sin(2\pi \beta \tau)}{2\pi \beta \tau}\right]^2, \quad |\tau| \le \dfrac{1}{2\beta}`,
    bandwidthFactor: 1,
  },
  cosineRatio: {
    latex: String.raw`B_c(\tau) = \dfrac{P_g \cos(2\pi \beta \tau)}{1 - (4\beta \tau)^2}, \quad -\infty < \tau < \infty`,
    bandwidthFactor: 4,
  },
  cosineLimited: {
    latex: String.raw`B_c(\tau) = \begin{cases} P_g \cos(2\pi \beta \tau), & |\tau| \le \dfrac{1}{4\beta}, \\ 0, & |\tau| > \dfrac{1}{4\beta}. \end{cases}`,
    bandwidthFactor: 3,
  },
  exponentialLinear: {
    latex: String.raw`B_c(\tau) = P_g (1 - \beta |\tau|) e^{-\beta |\tau|}`,
    bandwidthFactor: 2,
  },
};

// JS эквиваленты формул для Bc(tau)
const BcJS = {
  exponential: (tau, Pg, beta) => Pg * Math.exp(-beta * Math.abs(tau)),
  cosineSquared: (tau, Pg, beta) => Math.abs(tau) <= 1 / (2 * beta) ? Pg * Math.pow(Math.cos(Math.PI * beta * tau), 2) : 0,
  gaussian: (tau, Pg, beta) => Pg * Math.exp(-0.5 * Math.pow(beta * tau, 2)),
  sinc: (tau, Pg, beta) => {
    const arg = 2 * Math.PI * beta * tau;
    return arg === 0 ? Pg : Pg * Math.sin(arg) / arg;
  },
  sincSquared: (tau, Pg, beta) => {
    if (Math.abs(tau) > 1 / (2 * beta)) return 0;
    const arg = 2 * Math.PI * beta * tau;
    return arg === 0 ? Pg : Pg * Math.pow(Math.sin(arg) / arg, 2);
  },
  cosineRatio: (tau, Pg, beta) => {
    const x = 4 * beta * tau;
    const den = 1 - x * x;
    if (Math.abs(den) < 1e-5) return Pg * Math.PI / 4; // Правило Лопиталя для 0/0
    return Pg * Math.cos(2 * Math.PI * beta * tau) / den;
  },
  cosineLimited: (tau, Pg, beta) => Math.abs(tau) <= 1 / (4 * beta) ? Pg * Math.cos(2 * Math.PI * beta * tau) : 0,
  exponentialLinear: (tau, Pg, beta) => Pg * (1 - beta * Math.abs(tau)) * Math.exp(-beta * Math.abs(tau))
};

// Ядро математической обработки сигнала
class SignalProcessor {
  constructor(params) {
    this.params = params;
    this.Pg = Number(params.signalPower);
    this.beta = Number(params.beta);
    this.dfg = Number(params.signalBandwidth);
    this.correlationId = params.correlationFunctionType; 

    // Единая шкала времени
    this.duration = 4 / this.beta; // Окно показа
    this.N = 800; // Точек времени
    this.dt = this.duration / this.N;
    this.time = Array.from({ length: this.N }, (_, i) => i * this.dt);

    this.frequencies = [];
    this.phases = [];
    this.Gg = [];
    
    this.calculateSpectrumAndBaseSignal();
    this.calculateFilter();
    this.calculateSampling();
    this.calculateQuantization();
    this.calculateEncoding();
    this.calculateModulation();
  }

  Bc(tau) {
    return BcJS[this.correlationId](tau, this.Pg, this.beta);
  }

  calculateSpectrumAndBaseSignal() {
    const fmax = this.dfg * 6;
    const M = 200; // Количество гармоник
    const df = fmax / M;
    let totalPower = 0;

    for (let i = 0; i < M; i++) {
      const f = (i + 0.5) * df;
      this.frequencies.push(f);
      
      // Сохраняем "случайные" фазы, но фиксируем их зерно для стабильности графика (используем псевдорандом от индекса)
      this.phases.push((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % (2 * Math.PI));

      // Интегрирование по Винеру-Хинчину: 4 * int( Bc(tau)*cos(2pi f tau) dtau )
      let gg = 0;
      const tauMax = 5 / this.beta;
      const dtau = tauMax / 500;
      for (let tau = 0; tau < tauMax; tau += dtau) {
        gg += 4 * this.Bc(tau) * Math.cos(2 * Math.PI * f * tau) * dtau;
      }
      if (gg < 0) gg = 0;
      this.Gg.push(gg);
      totalPower += 2 * gg * df;
    }

    // Нормировка для строгого соответствия Pg
    const scale = Math.sqrt(this.Pg / totalPower) || 0;

    this.g_t = this.time.map(t => {
      let val = 0;
      for (let i = 0; i < M; i++) {
        const A = Math.sqrt(2 * this.Gg[i] * df) * scale;
        val += A * Math.cos(2 * Math.PI * this.frequencies[i] * t + this.phases[i]);
      }
      return val;
    });
    
    // Нормированный массив спектра для отрисовки
    this.Gg_normalized = this.Gg.map(val => val * (scale * scale));
    this.df = df;
  }

  calculateFilter() {
    const fcp = this.dfg;
    let Px = 0;
    const totalGg = this.Gg.reduce((a, b) => a + b, 0);
    const normFactor = totalGg > 0 ? Math.sqrt(this.Pg / (totalGg * this.df * 2)) : 0;
    
    this.x_t = this.time.map((t, tIdx) => {
      let val = 0;
      for (let i = 0; i < this.frequencies.length; i++) {
        if (this.frequencies[i] <= fcp) {
          const A = Math.sqrt(2 * this.Gg[i] * this.df) * normFactor;
          val += A * Math.cos(2 * Math.PI * this.frequencies[i] * t + this.phases[i]);
          if (tIdx === 0) {
             Px += 2 * this.Gg_normalized[i] * this.df;
          }
        }
      }
      return val;
    });
    
    this.Px = Px;
    this.eps_f2 = this.Pg - Px;
  }

  calculateSampling() {
    const alpha = Number(this.params.samplingIncrease);
    this.fd = 2 * alpha * this.dfg;
    this.dt_sample = 1 / this.fd;

    this.sampled_time = [];
    this.sampled_x = [];
    
    for (let t = 0; t <= this.duration; t += this.dt_sample) {
      const idx = Math.floor((t / this.duration) * (this.N - 1));
      if (idx >= 0 && idx < this.N) {
        this.sampled_time.push(this.time[idx]);
        this.sampled_x.push(this.x_t[idx]);
      }
    }
  }

  calculateQuantization() {
    const sigma_g = Math.sqrt(this.Pg);
    this.Dg = 6 * sigma_g;
    
    this.mu = 4; // Разрядность (ограничена 4 битами для наглядности сетки из 16 уровней)
    this.L = Math.pow(2, this.mu);
    this.dU = this.Dg / (this.L - 1);
    
    this.ui = Array.from({length: this.L}, (_, i) => -3 * sigma_g + i * this.dU);
    this.vj = Array.from({length: this.L}, (_, j) => -3 * sigma_g + j * this.dU);

    this.quantized_v = [];
    this.quantized_indices = [];
    
    this.sampled_x.forEach(val => {
      let clamped = Math.max(-3 * sigma_g, Math.min(3 * sigma_g, val));
      let j = Math.round((clamped - (-3 * sigma_g)) / this.dU);
      j = Math.max(0, Math.min(this.L - 1, j));
      
      this.quantized_v.push(this.vj[j]);
      this.quantized_indices.push(j);
    });
  }

  calculateEncoding() {
    this.tau_sim = this.dt_sample / this.mu;
    this.digital_b = [];
    this.bit_string = "";
    
    this.quantized_indices.forEach(j => {
      let bin = j.toString(2).padStart(this.mu, '0');
      this.bit_string += bin;
      for (let bit of bin) this.digital_b.push(parseInt(bit, 10));
    });
    
    this.b_t = this.time.map(t => {
      if (t > this.sampled_time[this.sampled_time.length - 1] + this.dt_sample) return 0;
      let bitIndex = Math.floor(t / this.tau_sim);
      if (bitIndex >= this.digital_b.length) bitIndex = this.digital_b.length - 1;
      return this.digital_b[bitIndex] !== undefined ? this.digital_b[bitIndex] : 0;
    });
  }

  calculateModulation() {
    const modType = this.params.modulation;
    const Um = 1; 
    
    // Визуальное занижение частот для отрисовки несущей
    const visual_f0 = 10 / this.tau_sim; 
    const visual_f1 = 20 / this.tau_sim;
    
    let phase = 0;
    this.S_t = this.time.map((t, idx) => {
      let bitIndex = Math.floor(t / this.tau_sim);
      if (bitIndex >= this.digital_b.length) bitIndex = this.digital_b.length - 1;
      let currentBit = this.digital_b[bitIndex] || 0;
      
      if (modType === "DAM") {
        return 0.5 * Um * (1 + currentBit) * Math.sin(2 * Math.PI * visual_f0 * t);
      } else if (modType === "DCHM") {
        let f = currentBit === 1 ? visual_f1 : visual_f0;
        return Um * Math.sin(2 * Math.PI * f * t);
      } else {
        if (idx > 0) {
           let prevBitIndex = Math.floor(this.time[idx-1] / this.tau_sim);
           if (bitIndex > prevBitIndex && currentBit === 1) phase += Math.PI; 
        }
        return Um * Math.sin(2 * Math.PI * visual_f0 * t + phase);
      }
    });
  }
}

// Утилиты для отрисовки на Canvas
const CanvasRenderer = {
  setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  },
  
  drawTimeAxis(ctx, w, h) {
    ctx.beginPath();
    ctx.strokeStyle = '#d5ddd8';
    ctx.lineWidth = 1;
    // Ось X
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
  },

  drawSignal(ctx, w, h, timeArray, signalArray, color, isDashed = false) {
    if (!signalArray || !signalArray.length) return;
    const maxVal = Math.max(...signalArray.map(Math.abs)) * 1.2 || 1;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (isDashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    
    for (let i = 0; i < timeArray.length; i++) {
      const x = (i / (timeArray.length - 1)) * w;
      const y = h / 2 - (signalArray[i] / maxVal) * (h / 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  },

  drawSpectrum(ctx, w, h, freqs, Gg, color, fillLimit = null) {
    const maxF = freqs[freqs.length - 1];
    const maxG = Math.max(...Gg) * 1.1 || 1;
    
    ctx.beginPath();
    ctx.strokeStyle = '#d5ddd8';
    ctx.moveTo(0, h - 10); ctx.lineTo(w, h - 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '40'; // прозрачная заливка
    ctx.lineWidth = 2;
    ctx.moveTo(0, h - 10);
    
    for (let i = 0; i < freqs.length; i++) {
      const x = (freqs[i] / maxF) * w;
      const y = (h - 10) - (Gg[i] / maxG) * (h - 20);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h - 10);
    ctx.stroke();
  },

  drawSpectrumCutoff(ctx, w, h, freqs, Gg, fcp, colorPass, colorCut) {
    const maxF = freqs[freqs.length - 1];
    const maxG = Math.max(...Gg) * 1.1 || 1;
    const baseline = h - 10;

    ctx.beginPath();
    ctx.strokeStyle = '#d5ddd8';
    ctx.moveTo(0, baseline); ctx.lineTo(w, baseline);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = colorPass + '40';
    ctx.moveTo(0, baseline);
    let cutoffX = 0;
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] <= fcp) {
        const x = (freqs[i] / maxF) * w;
        const y = baseline - (Gg[i] / maxG) * (baseline - 10);
        ctx.lineTo(x, y);
        cutoffX = x;
      }
    }
    ctx.lineTo(cutoffX, baseline);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = colorCut + '40';
    ctx.moveTo(cutoffX, baseline);
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] > fcp) {
        const x = (freqs[i] / maxF) * w;
        const y = baseline - (Gg[i] / maxG) * (baseline - 10);
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(w, baseline);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = colorCut;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(cutoffX, baseline); ctx.lineTo(cutoffX, 10);
    ctx.stroke(); ctx.setLineDash([]);
  },

  drawStems(ctx, w, h, timeArray, sampledTime, sampledValues, color, arrowsOnly = false) {
    if (!sampledValues || !sampledValues.length) return;
    const maxVal = Math.max(...sampledValues.map(Math.abs)) * 1.2 || 1;
    const duration = timeArray[timeArray.length - 1];
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    for (let i = 0; i < sampledTime.length; i++) {
      const x = (sampledTime[i] / duration) * w;
      const val = sampledValues[i];
      const y = h / 2 - (val / maxVal) * (h / 2);
      const y0 = h / 2;
      
      ctx.moveTo(x, y0); ctx.lineTo(x, y);
      
      if (arrowsOnly) {
        ctx.lineTo(x - 3, y + (val >= 0 ? 4 : -4));
        ctx.moveTo(x, y); ctx.lineTo(x + 3, y + (val >= 0 ? 4 : -4));
      }
    }
    ctx.stroke();
    
    if (!arrowsOnly) {
      ctx.beginPath();
      ctx.fillStyle = color;
      for (let i = 0; i < sampledTime.length; i++) {
        const x = (sampledTime[i] / duration) * w;
        const val = sampledValues[i];
        const y = h / 2 - (val / maxVal) * (h / 2);
        ctx.moveTo(x, y); ctx.arc(x, y, 3, 0, 2 * Math.PI);
      }
      ctx.fill();
    }
  }
};

const variants = [
  [1, 1, 13, 1.5, "DAM", 60, null, 0.0001, 14.5, "KO", 0.1, "exponential"],
  [2, 1.5, 14, 2, "DCHM", 61, 62.5, 0.001, 8.5, "NO", 0.12, "exponential"],
  [3, 2, 15, 2.5, "DOFM", 62, null, 0.0028, 4.3, "SF", 0.14, "exponential"],
  [4, 2.5, 16, 3, "DAM", 63, null, 0.0002, 15, "NO", 0.16, "exponential"],
  [5, 3, 17, 3.5, "DCHM", 64, 65.5, 0.0011, 9, "KO", 0.18, "exponential"],
  [6, 3.5, 18, 3.5, "DOFM", 65, null, 0.0029, 5.2, "SP", 0.2, "cosineSquared"],
  [7, 1.2, 29, 3, "DAM", 66, null, 0.0003, 15.5, "KO", 0.09, "cosineSquared"],
  [8, 2.7, 30, 2.5, "DCHM", 67, 68.8, 0.0012, 9.5, "NO", 0.11, "cosineSquared"],
  [9, 2.2, 31, 2, "DOFM", 68, null, 0.003, 4.6, "SF", 0.13, "cosineSquared"],
  [10, 2.7, 32, 1.5, "DAM", 69, null, 0.0004, 16, "NO", 0.15, "cosineSquared"],
  [11, 3.2, 33, 1.5, "DCHM", 70, 71.5, 0.0013, 10, "KO", 0.17, "gaussian"],
  [12, 3.7, 34, 2, "DOFM", 71, null, 0.0031, 4.9, "SP", 0.19, "gaussian"],
  [13, 1.4, 17, 2.5, "DAM", 72, null, 0.0005, 16.5, "KO", 0.1, "gaussian"],
  [14, 1.9, 18, 3, "DCHM", 73, 74.5, 0.0014, 10.5, "NO", 0.12, "gaussian"],
  [15, 2.4, 19, 3.5, "DOFM", 74, null, 0.0032, 5.5, "SF", 0.14, "gaussian"],
  [16, 2.9, 20, 3.5, "DAM", 75, null, 0.0006, 17, "NO", 0.16, "sinc"],
  [17, 3.4, 21, 3, "DCHM", 76, 77.5, 0.0015, 11, "KO", 0.18, "sinc"],
  [18, 3.9, 22, 2.5, "DOFM", 77, null, 0.0033, 5.8, "SP", 0.2, "sinc"],
  [19, 4, 5, 2, "DAM", 78, null, 0.0001, 17.5, "KO", 0.09, "sinc"],
  [20, 4.2, 6, 1.5, "DCHM", 79, 80.5, 0.0007, 11.5, "NO", 0.11, "sinc"],
  [21, 4.4, 7, 1.5, "DOFM", 80, null, 0.0022, 6.1, "SF", 0.13, "sincSquared"],
  [22, 4.6, 8, 2, "DAM", 81, null, 0.0008, 18, "NO", 0.15, "sincSquared"],
  [23, 4.8, 9, 2.5, "DCHM", 82, 83.5, 0.0017, 12, "KO", 0.17, "sincSquared"],
  [24, 5, 10, 3, "DOFM", 83, null, 0.0023, 6.4, "SP", 0.19, "sincSquared"],
  [25, 3.8, 13, 3.5, "DAM", 84, null, 0.0009, 18.5, "KO", 0.1, "sincSquared"],
  [26, 3.3, 14, 3.5, "DCHM", 85, 86.5, 0.0018, 12.5, "NO", 0.12, "cosineRatio"],
  [27, 2.8, 15, 3, "DOFM", 86, null, 0.0024, 6.7, "SF", 0.14, "cosineRatio"],
  [28, 2.3, 16, 2.5, "DAM", 87, null, 0.0004, 19, "NO", 0.16, "cosineRatio"],
  [29, 1.8, 17, 2, "DCHM", 88, 89.5, 0.0019, 13, "KO", 0.18, "cosineRatio"],
  [30, 1.3, 18, 1.5, "DOFM", 89, null, 0.0025, 7, "SP", 0.2, "cosineRatio"],
  [31, 3.6, 7, 1.5, "DAM", 90, null, 0.0005, 19.5, "KO", 0.09, "cosineLimited"],
  [32, 3.1, 8, 2, "DCHM", 91, 92.5, 0.002, 13.5, "NO", 0.11, "cosineLimited"],
  [33, 2.6, 9, 2.5, "DOFM", 92, null, 0.0026, 7.3, "SF", 0.13, "cosineLimited"],
  [34, 2.1, 10, 3, "DAM", 93, null, 0.0006, 20, "NO", 0.15, "cosineLimited"],
  [35, 1.6, 11, 3.5, "DCHM", 94, 95.5, 0.0021, 14, "KO", 0.17, "cosineLimited"],
  [36, 1.1, 12, 3.5, "DOFM", 95, null, 0.0027, 7.6, "SP", 0.19, "exponentialLinear"],
  [37, 1.2, 6, 3, "DAM", 96, null, 0.0009, 8, "NO", 0.12, "exponentialLinear"],
  [38, 1.5, 9, 2.5, "DCHM", 97, 98.5, 0.0011, 10, "KO", 0.13, "exponentialLinear"],
  [39, 1.7, 12, 2, "DOFM", 98, null, 0.0015, 12, "SF", 0.14, "exponentialLinear"],
  [40, 1.9, 15, 1.5, "DAM", 99, null, 0.0018, 15, "KO", 0.15, "exponentialLinear"],
].map(
  ([
    number,
    signalPower,
    beta,
    samplingIncrease,
    modulation,
    primaryFrequency,
    secondaryFrequency,
    noiseDensity,
    signalNoiseRatio,
    reception,
    acceptableError,
    correlation,
  ]) => ({
    number,
    signalPower,
    beta,
    bandwidthFactor: correlationGroups[correlation].bandwidthFactor,
    signalBandwidth: beta * correlationGroups[correlation].bandwidthFactor,
    samplingIncrease,
    modulation,
    primaryFrequency,
    secondaryFrequency,
    noiseDensity,
    signalNoiseRatio,
    reception,
    acceptableError,
    correlationFunction: correlationGroups[correlation].latex,
    correlationFunctionType: correlation,
  }),
);

const receptionDescriptions = {
  KO: "Когерентный приём: детектор использует синхронное опорное колебание. Для обработки важна согласованность частоты и фазы.",
  NO: "Некогерентный приём: детектор выделяет огибающую сигнала. Знание текущей фазы несущей не требуется.",
  SF: "Сравнение фаз: приёмник сопоставляет фазы текущей и предыдущей посылок, задержанных на длительность символа.",
  SP: "Сравнение полярностей: приёмник сопоставляет полярности продетектированных текущей и задержанной посылок.",
};

const parameterLabels = {
  signalPower: ["P<sub>g</sub>", "В²"],
  beta: ["β", "мс⁻¹"],
  signalBandwidth: ["Δf<sub>g</sub>", ""],
  samplingIncrease: ["α", ""],
  noiseDensity: ["N<sub>0</sub>", "мВт/Гц"],
  signalNoiseRatio: ["h<sup>2</sup>", ""],
  acceptableError: ["δ<sub>доп</sub><sup>2</sup>", ""],
};

let currentProcessor = null;

function getStage(stageId) {
  return stages.find((stage) => stage.id === stageId) ?? stages[0];
}

function createStageCard(stage, index) {
  const card = document.createElement("button");
  card.className = "stage-card";
  card.type = "button";
  card.dataset.stageId = stage.id;
  card.dataset.group = stage.group;
  card.setAttribute("aria-pressed", "false");

  card.innerHTML = `
    <span class="stage-card__index">${String(index + 1).padStart(2, "0")}</span>
    <strong class="stage-card__title">${stage.title}</strong>
    <span class="stage-card__signal">${stage.signal}</span>
    <span class="stage-card__status">Ожидает исследования</span>
  `;

  card.addEventListener("click", () => selectStage(stage.id));
  return card;
}

function renderRoute() {
  const fragment = document.createDocumentFragment();

  stages.forEach((stage, index) => {
    fragment.append(createStageCard(stage, index));
  });

  route.replaceChildren(fragment);
}

function renderPanel(stage) {
  if (stage.id === "source") {
    renderSourceStage(stage);
  } else if (stage.id === "tx-filter") {
    renderTxFilterStage(stage);
  } else if (stage.id === "sampler") {
    renderSamplerStage(stage);
  } else if (stage.id === "quantizer") {
    renderQuantizerStage(stage);
  } else if (stage.id === "encoder") {
    renderEncoderStage(stage);
  } else if (stage.id === "modulator") {
    renderModulatorStage(stage);
  } else {
    renderPlaceholderStage(stage);
  }
}

function renderSourceStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;
  
  const template = document.getElementById("template-stage-source");
  const clone = template.content.cloneNode(true);
  
  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;
  
  setFormula(clone.querySelector("[data-math-bc]"), p.params.correlationFunction);
  setFormula(clone.querySelector("[data-math-pg]"), String.raw`P_g = \sigma_g^2 = ${toLatexNumber(p.Pg.toFixed(2))} \text{ В}^2`);
  setFormula(clone.querySelector("[data-math-gg]"), String.raw`G_g(f) = 4 \int_0^\infty B_c(\tau) \cos(2\pi f \tau) d\tau`);

  panel.replaceChildren(clone);
  renderMath();
  
  setTimeout(() => {
    const cg = CanvasRenderer.setup(panel.querySelector('#canvas-source-g'));
    CanvasRenderer.drawTimeAxis(cg.ctx, cg.w, cg.h);
    CanvasRenderer.drawSignal(cg.ctx, cg.w, cg.h, p.time, p.g_t, '#0c6b4f');

    const cbc = CanvasRenderer.setup(panel.querySelector('#canvas-source-bc'));
    CanvasRenderer.drawTimeAxis(cbc.ctx, cbc.w, cbc.h);
    const taus = Array.from({length: 200}, (_, i) => (i - 100) * (3 / p.beta / 100));
    const bcVals = taus.map(t => p.Bc(t));
    CanvasRenderer.drawSignal(cbc.ctx, cbc.w, cbc.h, taus, bcVals, '#287c9f');

    const cgg = CanvasRenderer.setup(panel.querySelector('#canvas-source-gg'));
    CanvasRenderer.drawSpectrum(cgg.ctx, cgg.w, cgg.h, p.frequencies, p.Gg_normalized, '#ad6d13');
  }, 50);
}

function renderTxFilterStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;

  const template = document.getElementById("template-stage-tx-filter");
  const clone = template.content.cloneNode(true);

  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;

  setFormula(clone.querySelector("[data-math-fcp]"), String.raw`f_{cp} = \Delta f_g = ${toLatexNumber(p.dfg.toFixed(2))} \text{ кГц}`);
  setFormula(clone.querySelector("[data-math-px]"), String.raw`P_x = \int_0^{f_{cp}} 2 G_g(f) df = ${toLatexNumber(p.Px.toFixed(3))} \text{ В}^2`);
  setFormula(clone.querySelector("[data-math-eps]"), String.raw`\varepsilon_ф^2 = P_g - P_x = ${toLatexNumber(p.Pg.toFixed(3))} - ${toLatexNumber(p.Px.toFixed(3))} = ${toLatexNumber(p.eps_f2.toFixed(3))} \text{ В}^2`);

  panel.replaceChildren(clone);
  renderMath();
  
  setTimeout(() => {
    const cspec = CanvasRenderer.setup(panel.querySelector('#canvas-tx-spec'));
    CanvasRenderer.drawSpectrumCutoff(cspec.ctx, cspec.w, cspec.h, p.frequencies, p.Gg_normalized, p.dfg, '#0c6b4f', '#e74c3c');

    const cx = CanvasRenderer.setup(panel.querySelector('#canvas-tx-x'));
    CanvasRenderer.drawTimeAxis(cx.ctx, cx.w, cx.h);
    CanvasRenderer.drawSignal(cx.ctx, cx.w, cx.h, p.time, p.g_t, 'rgba(40, 124, 159, 0.4)');
    CanvasRenderer.drawSignal(cx.ctx, cx.w, cx.h, p.time, p.x_t, '#0c6b4f');
  }, 50);
}

function renderSamplerStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;

  const template = document.getElementById("template-stage-sampler");
  const clone = template.content.cloneNode(true);

  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;
  setFormula(clone.querySelector("[data-math-fd]"), String.raw`f_d = 2\alpha\Delta f_g = 2 \cdot ${toLatexNumber(p.params.samplingIncrease)} \cdot ${toLatexNumber(p.dfg.toFixed(2))} = ${toLatexNumber(p.fd.toFixed(2))} \text{ кГц}`);
  setFormula(clone.querySelector("[data-math-dt]"), String.raw`\Delta t = \frac{1}{f_d} = \frac{1}{${toLatexNumber(p.fd.toFixed(2))}} \approx ${toLatexNumber((p.dt_sample * 1000).toFixed(4))} \text{ мс}`);

  panel.replaceChildren(clone);
  renderMath();

  setTimeout(() => {
    const cdelta = CanvasRenderer.setup(panel.querySelector('#canvas-sampler-delta'));
    CanvasRenderer.drawTimeAxis(cdelta.ctx, cdelta.w, cdelta.h);
    CanvasRenderer.drawStems(cdelta.ctx, cdelta.w, cdelta.h, p.time, p.sampled_time, p.sampled_x.map(() => 1), '#287c9f', true);

    const cx = CanvasRenderer.setup(panel.querySelector('#canvas-sampler-x'));
    CanvasRenderer.drawTimeAxis(cx.ctx, cx.w, cx.h);
    CanvasRenderer.drawSignal(cx.ctx, cx.w, cx.h, p.time, p.x_t, 'rgba(40, 124, 159, 0.4)');
    CanvasRenderer.drawStems(cx.ctx, cx.w, cx.h, p.time, p.sampled_time, p.sampled_x, '#0c6b4f');
  }, 50);
}

function renderQuantizerStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;

  const template = document.getElementById("template-stage-quantizer");
  const clone = template.content.cloneNode(true);

  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;
  setFormula(clone.querySelector("[data-math-dg]"), String.raw`D_g = 6\sigma_g = 6 \cdot ${toLatexNumber(Math.sqrt(p.Pg).toFixed(2))} = ${toLatexNumber(p.Dg.toFixed(2))} \text{ В}`);
  setFormula(clone.querySelector("[data-math-du]"), String.raw`\Delta U = \frac{D_g}{L-1} = \frac{${toLatexNumber(p.Dg.toFixed(2))}}{${p.L}-1} = ${toLatexNumber(p.dU.toFixed(3))} \text{ В}`);

  panel.replaceChildren(clone);
  renderMath();

  setTimeout(() => {
    const cchar = CanvasRenderer.setup(panel.querySelector('#canvas-quantizer-char'));
    CanvasRenderer.drawTimeAxis(cchar.ctx, cchar.w, cchar.h);
    cchar.ctx.beginPath(); cchar.ctx.strokeStyle = '#0c6b4f'; cchar.ctx.lineWidth = 2;
    const stepX = cchar.w / p.L, stepY = cchar.h / p.L;
    for (let i = 0; i < p.L; i++) {
       cchar.ctx.moveTo(i * stepX, cchar.h - i * stepY); cchar.ctx.lineTo((i + 1) * stepX, cchar.h - i * stepY);
       if (i < p.L - 1) cchar.ctx.lineTo((i + 1) * stepX, cchar.h - (i + 1) * stepY);
    }
    cchar.ctx.stroke();

    const cv = CanvasRenderer.setup(panel.querySelector('#canvas-quantizer-v'));
    CanvasRenderer.drawTimeAxis(cv.ctx, cv.w, cv.h);
    cv.ctx.beginPath(); cv.ctx.strokeStyle = '#eef2ee'; cv.ctx.lineWidth = 1;
    const maxVal = Math.max(...p.sampled_x.map(Math.abs)) * 1.2 || 1;
    p.vj.forEach(v => {
       const y = cv.h / 2 - (v / maxVal) * (cv.h / 2);
       cv.ctx.moveTo(0, y); cv.ctx.lineTo(cv.w, y);
    });
    cv.ctx.stroke();
    CanvasRenderer.drawStems(cv.ctx, cv.w, cv.h, p.time, p.sampled_time, p.sampled_x, 'rgba(40, 124, 159, 0.4)');
    CanvasRenderer.drawStems(cv.ctx, cv.w, cv.h, p.time, p.sampled_time, p.quantized_v, '#0c6b4f');
  }, 50);
}

function renderEncoderStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;

  const template = document.getElementById("template-stage-encoder");
  const clone = template.content.cloneNode(true);

  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;
  setFormula(clone.querySelector("[data-math-mu]"), String.raw`\mu = \log_2(L) = \log_2(${p.L}) = ${p.mu} \text{ бит}`);
  setFormula(clone.querySelector("[data-math-tau]"), String.raw`\tau_{сим} = \frac{\Delta t}{\mu} = \frac{${toLatexNumber((p.dt_sample * 1000).toFixed(4))}}{${p.mu}} \approx ${toLatexNumber((p.tau_sim * 1000).toFixed(4))} \text{ мс}`);

  panel.replaceChildren(clone);
  renderMath();

  setTimeout(() => {
    const cb = CanvasRenderer.setup(panel.querySelector('#canvas-encoder-b'));
    CanvasRenderer.drawTimeAxis(cb.ctx, cb.w, cb.h);
    
    cb.ctx.beginPath(); cb.ctx.strokeStyle = '#0c6b4f'; cb.ctx.lineWidth = 2;
    for (let i = 0; i < p.time.length; i++) {
       const x = (i / (p.time.length - 1)) * cb.w;
       const y = cb.h / 2 - (p.b_t[i] > 0 ? 0.6 : -0.6) * (cb.h / 2);
       if (i === 0) cb.ctx.moveTo(x, y); 
       else { const prevY = cb.h / 2 - (p.b_t[i-1] > 0 ? 0.6 : -0.6) * (cb.h / 2); if (prevY !== y) cb.ctx.lineTo(x, prevY); cb.ctx.lineTo(x, y); }
    }
    cb.ctx.stroke();

    // Отрисовка битов точно по границам
    cb.ctx.beginPath(); cb.ctx.strokeStyle = '#d5ddd8'; cb.ctx.lineWidth = 1; cb.ctx.setLineDash([4, 4]);
    cb.ctx.font = "13px 'SFMono-Regular', Consolas, monospace";
    cb.ctx.fillStyle = '#0c6b4f';
    cb.ctx.textAlign = "center";
    cb.ctx.textBaseline = "middle";

    for (let i = 0; i < p.digital_b.length; i++) {
       const t = i * p.tau_sim;
       if (t > p.time[p.time.length - 1]) break;
       const x = (t / p.time[p.time.length - 1]) * cb.w;
       cb.ctx.moveTo(x, 10); cb.ctx.lineTo(x, cb.h - 10);
       const nextT = (i + 1) * p.tau_sim;
       const centerX = ((t + Math.min(nextT, p.time[p.time.length - 1])) / 2 / p.time[p.time.length - 1]) * cb.w;
       cb.ctx.fillText(p.digital_b[i], centerX, cb.h - 15);
    }
    cb.ctx.stroke(); cb.ctx.setLineDash([]);
  }, 50);
}

function renderModulatorStage(stage) {
  const p = currentProcessor;
  panel.dataset.group = stage.group;

  const template = document.getElementById("template-stage-modulator");
  const clone = template.content.cloneNode(true);

  clone.querySelector("[data-title]").textContent = stage.title;
  clone.querySelector("[data-signal]").textContent = stage.signal;
  setFormula(clone.querySelector("[data-math-mod]"), String.raw`\text{${p.params.modulation}}`);
  setFormula(clone.querySelector("[data-math-f0]"), String.raw`f_0 = ${toLatexNumber(p.params.primaryFrequency)} \text{ МГц}`);

  panel.replaceChildren(clone);
  renderMath();

  setTimeout(() => {
    const cs = CanvasRenderer.setup(panel.querySelector('#canvas-modulator-s'));
    CanvasRenderer.drawTimeAxis(cs.ctx, cs.w, cs.h);
    
    cs.ctx.beginPath(); cs.ctx.strokeStyle = 'rgba(40, 124, 159, 0.2)'; cs.ctx.lineWidth = 2; cs.ctx.setLineDash([5, 5]);
    for (let i = 0; i < p.time.length; i++) {
       const x = (i / (p.time.length - 1)) * cs.w;
       const y = cs.h / 2 - (p.b_t[i] > 0 ? 0.9 : -0.9) * (cs.h / 2);
       if (i === 0) cs.ctx.moveTo(x, y); 
       else { const prevY = cs.h / 2 - (p.b_t[i-1] > 0 ? 0.9 : -0.9) * (cs.h / 2); if (prevY !== y) cs.ctx.lineTo(x, prevY); cs.ctx.lineTo(x, y); }
    }
    cs.ctx.stroke(); cs.ctx.setLineDash([]);

    CanvasRenderer.drawSignal(cs.ctx, cs.w, cs.h, p.time, p.S_t, '#ad6d13');
  }, 50);
}

function renderPlaceholderStage(stage) {
  panel.dataset.group = stage.group;
  panel.innerHTML = `
    <div class="stage-panel__content">
      <p class="eyebrow">Выбранный этап</p>
      <h2>${stage.title}</h2>
      <span class="stage-panel__signal">${stage.signal}</span>
      <p>
        Этот блок пока не реализован. Перед началом работы нужно изучить
        относящиеся к нему разделы методических указаний, выписать формулы
        и определить обязательные графики преобразования сигнала.
      </p>
    </div>

    <div class="stage-panel__placeholder" aria-label="Место для будущего графика">
      <div>
        <strong>Область будущей визуализации</strong>
        <p>Здесь появится график изменения сигнала на выбранном этапе.</p>
      </div>
    </div>
  `;
}

function getParameters() {
  return Object.fromEntries(new FormData(parametersForm));
}

function renderVariantOptions() {
  variantPreset.append(
    ...variants.map(({ number }) => {
      const option = document.createElement("option");
      option.value = String(number);
      option.textContent = `Вариант ${number}`;
      return option;
    }),
  );
}

function applyVariant(variantNumber) {
  const variant = variants.find(({ number }) => number === Number(variantNumber));

  if (!variant) {
    return;
  }

  isApplyingVariant = true;

  Object.entries(variant).forEach(([name, value]) => {
    if (name === "number" || value === null) {
      return;
    }

    if (parametersForm.elements[name]) {
      parametersForm.elements[name].value = String(value);
    }
  });

  updateConditionalFields();
  updateDerivedFields();
  parametersForm.elements.reception.value = variant.reception;
  currentProcessor = new SignalProcessor(getParameters());
  renderParametersSummary();
  isApplyingVariant = false;
}

function formatNumber(value) {
  return Number.isFinite(value)
    ? String(Number(value.toFixed(10)))
    : "";
}

function updateDerivedFields() {
  const beta = Number(parametersForm.elements.beta.value);
  const bandwidthFactor = Number(parametersForm.elements.bandwidthFactor.value);

  parametersForm.elements.signalBandwidth.value = formatNumber(
    beta * bandwidthFactor,
  );
}

function renderReceptionOptions(modulation) {
  const reception = parametersForm.elements.reception;
  const preferredValue = reception.value || reception.dataset.initialValue;
  const options = modulationOptions[modulation].receptions;

  reception.replaceChildren(
    ...options.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );

  if (options.some(([value]) => value === preferredValue)) {
    reception.value = preferredValue;
  }

  delete reception.dataset.initialValue;
}

function updateConditionalFields() {
  const modulation = parametersForm.elements.modulation.value;
  const isDchm = modulation === "DCHM";

  primaryFrequencyLabel.innerHTML =
    modulationOptions[modulation].primaryFrequencyLabel;
  primaryFrequencyDescription.textContent =
    modulationOptions[modulation].primaryFrequencyDescription;
  secondaryFrequencyField.hidden = !isDchm;
  secondaryFrequencyField.querySelector("input").disabled = !isDchm;
  renderReceptionOptions(modulation);
}

function createSummaryItem(label, value, unit = "") {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.innerHTML = label;
  description.textContent = `${value}${unit ? ` ${unit}` : ""}`;
  wrapper.append(term, description);
  return wrapper;
}

function renderMath() {
  clearTimeout(mathRenderTimeout);
  mathRenderTimeout = setTimeout(() => {
    if (!window.MathJax?.typesetPromise) {
      return;
    }

    const elements = [
      correlationPreview,
      summaryCorrelationFormula,
      summaryBandwidthFormula,
      panel
    ];

    window.MathJax.typesetClear(elements);
    window.MathJax.typesetPromise(elements).catch((error) => {
      console.warn("Не удалось отобразить формулу", error);
    });
  }, 80);
}

function setFormula(element, latex) {
  element.textContent = `\\[${latex}\\]`;
}

function toLatexNumber(value) {
  return String(value).replace(".", "{,}");
}

function renderParametersSummary() {
  const values = getParameters();
  const modulation = modulationOptions[values.modulation];
  const receptionLabel =
    parametersForm.elements.reception.selectedOptions[0]?.textContent ?? "—";

  summaryTitle.textContent = modulation.title;
  summaryDescription.textContent = modulation.description;
  receptionDescription.textContent = receptionDescriptions[values.reception];
  summaryReceptionDescription.textContent =
    receptionDescriptions[values.reception];
  setFormula(correlationPreview, values.correlationFunction);
  setFormula(summaryCorrelationFormula, values.correlationFunction);
  setFormula(
    summaryBandwidthFormula,
    String.raw`\Delta f_g = ${toLatexNumber(values.bandwidthFactor)}\beta = ${toLatexNumber(values.signalBandwidth)}`,
  );
  summary.replaceChildren(
    createSummaryItem(
      "Режим",
      values.variantPreset === "custom"
        ? "Ручной ввод"
        : `Вариант ${values.variantPreset}`,
    ),
    ...Object.entries(parameterLabels).map(([key, [label, unit]]) =>
      createSummaryItem(label, values[key], unit),
    ),
    createSummaryItem(
      values.modulation === "DCHM" ? "f<sub>2</sub>" : "f<sub>0</sub>",
      values.primaryFrequency,
      "МГц",
    ),
    ...(values.modulation === "DCHM"
      ? [createSummaryItem("f<sub>1</sub>", values.secondaryFrequency, "МГц")]
      : []),
    createSummaryItem("Приём", receptionLabel),
  );
  renderMath();
}

function handleParametersChange(event) {
  if (event.target.name === "variantPreset") {
    applyVariant(event.target.value);
    return;
  }

  if (!isApplyingVariant) {
    variantPreset.value = "custom";
  }

  if (event.target.name === "modulation") {
    updateConditionalFields();
  }

  if (["beta", "bandwidthFactor"].includes(event.target.name)) {
    updateDerivedFields();
  }

  currentProcessor = new SignalProcessor(getParameters());
  renderParametersSummary();
  
  // Обновление текущей панели, если параметры изменились
  const activeCard = document.querySelector(".stage-card.is-active");
  if (activeCard) {
    selectStage(activeCard.dataset.stageId);
  }
}

function selectStage(stageId) {
  const stage = getStage(stageId);

  document.querySelectorAll(".stage-card").forEach((card) => {
    const isActive = card.dataset.stageId === stage.id;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
  });

  renderPanel(stage);
}

function init() {
  renderVariantOptions();
  updateConditionalFields();
  updateDerivedFields();
  currentProcessor = new SignalProcessor(getParameters());
  renderParametersSummary();
  renderRoute();
  selectStage(stages[0].id);
  year.textContent = new Date().getFullYear();
  parametersForm.addEventListener("input", handleParametersChange);
  parametersForm.addEventListener("change", handleParametersChange);
  window.addEventListener("load", renderMath);
}

init();
