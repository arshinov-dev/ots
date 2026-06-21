// calculations.js — внутренний модуль проверяемых расчётов по методичке.
// Не показывается студенту напрямую; этапы используют эти функции,
// чтобы формула, расчёт и график строились из одного источника.
(function() {
  'use strict';

  // === Вспомогательные функции ===

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

  function clampPositive(v) { return v > 0 ? v : 0; }

  function safeDiv(a, b) { return Math.abs(b) < 1e-12 ? 0 : a / b; }

  // Интегральный синус: Si(x) = ∫₀ˣ sin(t)/t dt
  // Вычисляется через ряд Тейлора: Si(x) = Σ (-1)^n x^(2n+1) / ((2n+1)(2n+1)!)
  function sineIntegral(x) {
    if (Math.abs(x) < 1e-12) return 0;
    let sum = 0, term = x; // n=0: x^1 / (1 * 1!) = x
    for (let n = 1; n < 40; n++) {
      term *= -x * x / ((2 * n) * (2 * n + 1));
      const next = term / (2 * n + 1);
      sum += next;
      if (Math.abs(next) < 1e-14) break;
    }
    return x + sum;
  }

  // === 1. computeEta ===
  // Таблица 2 методички: 8 видов корреляционных функций.
  // Общая формула: η = 1/√(1 - r(Δt)²), где r(Δt) — нормированная корреляция при τ = Δt.
  // Каждая строка таблицы — это подстановка конкретного r(Δt).
  //
  // Соответствие видов (stable correlationType):
  //   exponential        → строка 3: r = exp(-1/(4α)),          η = 1/√(1-exp(-1/(2α)))
  //   cosineSquared      → строка 5: r = cos²(π/(3α)),          η = 1/√(1-cos⁴(π/(3α)))
  //   gaussian           → строка 8: r = exp(-1/(4α²)),         η = 1/√(1-exp(-1/(2α²)))
  //   sinc               → вывод:    r = sin(π/α)/(π/α),         η = 1/√(1-sinc²(π/α))
  //   sincSquared        → вывод:    r = [sin(π/α)/(π/α)]²,      η = 1/√(1-sinc⁴(π/α))
  //   cosineRatio        → вывод:    r = cos(π/(4α))/(1-1/(4α²)), η = 1/√(1-r²)
  //   cosineLimited      → строка 6: r = cos(π/(3α)),           η = 1/√(1-cos²(π/(3α)))
  //   exponentialLinear  → строка 1: r = (1-0.25/α)exp(-1/(4α)), η = 1/√(1-(1-0.25/α)²exp(-1/(2α)))

  const ETA_FORMULAS = {
    exponential: {
      formulaId: "eta-exponential",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\exp\\left(-\\dfrac{1}{2\\alpha}\\right)}}",
      tableRow: 3,
      compute: (alpha) => {
        const r = Math.exp(-1 / (4 * alpha));
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
    cosineSquared: {
      formulaId: "eta-cosineSquared",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\cos^4\\left(\\dfrac{\\pi}{3\\alpha}\\right)}}",
      tableRow: 5,
      compute: (alpha) => {
        const c = Math.cos(Math.PI / (3 * alpha));
        return 1 / Math.sqrt(clampPositive(1 - c * c * c * c));
      },
    },
    gaussian: {
      formulaId: "eta-gaussian",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\exp\\left(-\\dfrac{1}{2\\alpha^2}\\right)}}",
      tableRow: 8,
      compute: (alpha) => {
        const r = Math.exp(-1 / (4 * alpha * alpha));
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
    sinc: {
      formulaId: "eta-sinc",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\left(\\dfrac{\\sin(\\pi/\\alpha)}{\\pi/\\alpha}\\right)^2}}",
      tableRow: null,
      compute: (alpha) => {
        const arg = Math.PI / alpha;
        const r = Math.abs(arg) < 1e-9 ? 1 : Math.sin(arg) / arg;
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
    sincSquared: {
      formulaId: "eta-sincSquared",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\left(\\dfrac{\\sin(\\pi/\\alpha)}{\\pi/\\alpha}\\right)^4}}",
      tableRow: null,
      compute: (alpha) => {
        const arg = Math.PI / alpha;
        const sinc = Math.abs(arg) < 1e-9 ? 1 : Math.sin(arg) / arg;
        const r = sinc * sinc;
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
    cosineRatio: {
      formulaId: "eta-cosineRatio",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\left(\\dfrac{\\cos(\\pi/(4\\alpha))}{1-1/(4\\alpha^2)}\\right)^2}}",
      tableRow: null,
      compute: (alpha) => {
        const denom = 1 - 1 / (4 * alpha * alpha);
        if (Math.abs(denom) < 1e-12) return 1;
        const r = Math.cos(Math.PI / (4 * alpha)) / denom;
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
    cosineLimited: {
      formulaId: "eta-cosineLimited",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\cos^2\\left(\\dfrac{\\pi}{3\\alpha}\\right)}}",
      tableRow: 6,
      compute: (alpha) => {
        const c = Math.cos(Math.PI / (3 * alpha));
        return 1 / Math.sqrt(clampPositive(1 - c * c));
      },
    },
    exponentialLinear: {
      formulaId: "eta-exponentialLinear",
      latex: "\\eta=\\dfrac{1}{\\sqrt{1-\\left(1-\\dfrac{0{,}25}{\\alpha}\\right)^2\\exp\\left(-\\dfrac{1}{2\\alpha}\\right)}}",
      tableRow: 1,
      compute: (alpha) => {
        const r = (1 - 0.25 / alpha) * Math.exp(-1 / (4 * alpha));
        return 1 / Math.sqrt(clampPositive(1 - r * r));
      },
    },
  };

  function computeEta(correlationType, alpha) {
    const formula = ETA_FORMULAS[correlationType] || ETA_FORMULAS.exponential;
    const value = formula.compute(alpha);
    return {
      value: Number.isFinite(value) ? value : 1,
      formulaId: formula.formulaId,
      latex: formula.latex,
      tableRow: formula.tableRow,
      inputs: { correlationType, alpha },
    };
  }

  // === 2. computeSpectra ===
  // Аналитический расчёт ширины спектра цифрового и модулированного сигналов.
  // Формулы — из методички, раздел 2.6.
  //   Δfц = k1 / τсим,  k1 = 2
  //   ДАМ:  Δfs = 2·Δfц
  //   ДЧМ:  Δfs = |f1 - f2| + 2·Δfц
  //   ДОФМ: Δfs = 2·(mф + 1)·Δfц,  mф = π/2

  function computeSpectra(opts) {
    const modulation = opts.modulation || "DAM";
    const tauSim = opts.bitDuration;
    const digitalBandwidth = opts.digitalBandwidth;
    const carrierFrequency = opts.carrierFrequency || 0;
    const secondCarrierFrequency = opts.secondCarrierFrequency;

    let modulatedBandwidth = 0;
    let bandwidthFormulaLatex = "";
    let bandwidthDescription = "";
    let centralFrequencies = [];
    let formulaId = "";

    if (modulation === "DAM") {
      modulatedBandwidth = 2 * digitalBandwidth;
      bandwidthFormulaLatex = "\\Delta f_s=2\\Delta f_{ц}";
      bandwidthDescription = "ДАМ: полоса модулированного сигнала вдвое шире цифрового сигнала.";
      centralFrequencies = [carrierFrequency];
      formulaId = "spectrum-dam";
    } else if (modulation === "DCHM") {
      const deltaCarrier = Math.abs((secondCarrierFrequency || carrierFrequency) - carrierFrequency);
      modulatedBandwidth = deltaCarrier + 2 * digitalBandwidth;
      bandwidthFormulaLatex = "\\Delta f_s=|f_1-f_2|+2\\Delta f_{ц}";
      bandwidthDescription = "ДЧМ: полоса включает разнос несущих f1 и f2 и боковые составляющие цифрового сигнала.";
      centralFrequencies = [carrierFrequency, secondCarrierFrequency].filter(Boolean);
      formulaId = "spectrum-dchm";
    } else if (modulation === "DOFM") {
      const phaseIndex = Math.PI / 2;
      modulatedBandwidth = 2 * (phaseIndex + 1) * digitalBandwidth;
      bandwidthFormulaLatex = "\\Delta f_s=2(m_\\phi+1)\\Delta f_{ц},\\quad m_\\phi=\\pi/2";
      bandwidthDescription = "ДОФМ: спектр берётся как у фазовой манипуляции с индексом m_ф=π/2.";
      centralFrequencies = [carrierFrequency];
      formulaId = "spectrum-dofm";
    }

    return {
      digitalBandwidth,
      modulatedBandwidth,
      bandwidthFormulaLatex,
      bandwidthDescription,
      centralFrequencies,
      formulaId,
      inputs: { modulation, tauSim, digitalBandwidth, carrierFrequency, secondCarrierFrequency },
    };
  }

  // === 3. computeErrorProbability ===
  // 6 веток по методичке, раздел 2.8.
  //   ДАМ-КО:  pош = 1 - Φ(h/√2)
  //   ДАМ-НО:  pош = 0.5·exp(-h²/4)
  //   ДЧМ-КО:  pош = 1 - Φ(h)
  //   ДЧМ-НО:  pош = 0.5·exp(-h²/2)
  //   ДОФМ-СФ: pош = 0.5·exp(-h²)
  //   ДОФМ-СП: pош = 2·pДФМ·(1-pДФМ),  pДФМ = 1-Φ(√2·h)

  const ERROR_FORMULAS = {
    "DAM-KO": {
      formulaId: "perr-dam-ko",
      label: "ДАМ-КО",
      latex: "p_{ош}=1-\\Phi\\left(\\frac{h}{\\sqrt{2}}\\right)",
      compute: (h, h2) => 1 - normalCdf(h / Math.SQRT2),
    },
    "DAM-NO": {
      formulaId: "perr-dam-no",
      label: "ДАМ-НО",
      latex: "p_{ош}=0{,}5e^{-h^2/4}",
      compute: (h, h2) => 0.5 * Math.exp(-h2 / 4),
    },
    "DCHM-KO": {
      formulaId: "perr-dchm-ko",
      label: "ДЧМ-КО",
      latex: "p_{ош}=1-\\Phi(h)",
      compute: (h, h2) => 1 - normalCdf(h),
    },
    "DCHM-NO": {
      formulaId: "perr-dchm-no",
      label: "ДЧМ-НО",
      latex: "p_{ош}=0{,}5e^{-h^2/2}",
      compute: (h, h2) => 0.5 * Math.exp(-h2 / 2),
    },
    "DOFM-SF": {
      formulaId: "perr-dofm-sf",
      label: "ДОФМ-СФ",
      latex: "p_{ош}=0{,}5e^{-h^2}",
      compute: (h, h2) => 0.5 * Math.exp(-h2),
    },
    "DOFM-SP": {
      formulaId: "perr-dofm-sp",
      label: "ДОФМ-СП",
      latex: "p_{ош}=2p_{ДФМ}(1-p_{ДФМ}),\\quad p_{ДФМ}=1-\\Phi(\\sqrt{2}h)",
      compute: (h, h2) => {
        const pDfm = 1 - normalCdf(Math.SQRT2 * h);
        return 2 * pDfm * (1 - pDfm);
      },
    },
  };

  function computeErrorProbability(opts) {
    const modulation = opts.modulation || "DAM";
    const reception = opts.reception || "KO";
    const h2 = opts.hSquared;
    const h = Math.sqrt(h2);
    const key = modulation + "-" + reception;
    const formula = ERROR_FORMULAS[key] || ERROR_FORMULAS["DAM-KO"];
    const value = formula.compute(h, h2);
    return {
      value: Number.isFinite(value) ? value : 0,
      formulaId: formula.formulaId,
      label: formula.label,
      latex: formula.latex,
      h,
      h2,
      inputs: { modulation, reception, hSquared: h2 },
    };
  }

  // === 4. computeTransmissionNoise ===
  // Методичка, раздел 2.9 (формулы 39-42).
  //   ξп² = ((2/π)·Si(π) - 1) · ΔU² · p̄ош · Σᵢ pᵢ Σⱼ (j-i)²
  // Где:
  //   Si(π) = ∫₀^π sin(t)/t dt ≈ 1.85194
  //   Коэффициент (2/π)·Si(π) - 1 ≈ 0.179 (в коде/студенте: 0.1777)
  //   Σⱼ (j-i)² — сумма по ВСЕМ j от 1 до L+1 (не только однократные ошибки)
  //   p̄ош — усреднённая вероятность ошибки по уровням (формула 42):
  //     p̄ош = (1/(L+1)) · (1 - (1-p_ош)^μ)
  //   где μ — разрядность кода, L+1 — число уровней.

  function computeTransmissionNoise(opts) {
    const dU = opts.stepSize;
    const levelCount = opts.levelCount; // L+1
    const probabilities = opts.probabilities || [];
    const pError = opts.pError || 0; // p_ош — вероятность битовой ошибки
    const mu = opts.mu || Math.log2(levelCount); // разрядность кода

    // Коэффициент из методички: (2/π)·Si(π) - 1
    const SiPi = sineIntegral(Math.PI);
    const coefficient = (2 / Math.PI) * SiPi - 1;

    // Усреднённая вероятность ошибки по уровням (формула 42):
    // p̄_ош = (1/(L+1)) · (1 - (1-p_ош)^μ)
    // Вероятность правильного приёма кодового слова из μ битов = (1-p_ош)^μ
    const pCorrectWord = Math.pow(1 - pError, mu);
    const pAvgError = (1 / levelCount) * (1 - pCorrectWord);

    // Σᵢ pᵢ Σⱼ (j-i)²  — сумма по всем уровням (1-indexed в методичке)
    // В коде индексы 0-based, переводим: j_code = j_method - 1, i_code = i_method - 1
    // (j_method - i_method)² = (j_code - i_code)²
    let sumTransitions = 0;
    for (let i = 0; i < levelCount; i++) {
      const pi = probabilities[i] ?? (1 / levelCount);
      let innerSum = 0;
      for (let j = 0; j < levelCount; j++) {
        innerSum += (j - i) * (j - i);
      }
      sumTransitions += pi * innerSum;
    }

    const xiP = coefficient * dU * dU * pAvgError * sumTransitions;

    return {
      value: Number.isFinite(xiP) ? xiP : 0,
      coefficient,
      coefficientApprox: 0.1777, // значение из студенческого примера
      pAvgError,
      pBitError: pError,
      mu,
      sumTransitions,
      formulaId: "transmission-noise-methodical",
      latex: "\\xi_p^2=\\left(\\frac{2}{\\pi}\\text{Si}(\\pi)-1\\right)\\Delta U^2\\overline{p}_{ош}\\sum_{i=1}^{L+1}p_i\\sum_{j=1}^{L+1}(j-i)^2",
      latexPAvgError: "\\overline{p}_{ош}=\\frac{1}{L+1}\\left(1-(1-p_{ош})^{\\mu}\\right)",
      inputs: { stepSize: dU, levelCount, pError, mu, pAvgError, sumTransitions },
    };
  }

  // === Экспорт ===
  window.Calculations = {
    computeEta,
    computeSpectra,
    computeErrorProbability,
    computeTransmissionNoise,
    sineIntegral,
    ETA_FORMULAS,
    ERROR_FORMULAS,
  };
})();
