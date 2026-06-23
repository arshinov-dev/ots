// data.js - Единый расчётный объект и глобальные данные сигнала
(function() {
  'use strict';

  const safeNumber = (value, fallback) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function buildCodebook(levelCount, mu) {
    return Array.from({ length: levelCount }, (_, index) => {
      const decimal = index + 1;
      return decimal === levelCount ? "0".repeat(mu) : decimal.toString(2).padStart(mu, "0");
    });
  }

  function calculate(params) {
    const Pg = safeNumber(params.signalPower, 1.5);
    const sigmaG = Math.sqrt(Pg);
    const beta = safeNumber(params.beta, 14);
    const dfg = safeNumber(params.signalBandwidth, 28);
    const alpha = safeNumber(params.samplingIncrease, 2);
    const fd = 2 * alpha * dfg;
    const dt = 1 / fd;

    // Методика: сначала допустимый условный шаг, затем разрядность и фактический шаг.
    // η берётся из общего модуля Calculations (таблица 2 методички, 8 видов корреляции).
    const correlationKind = window.VisualMath?.getCorrelationKind
      ? window.VisualMath.getCorrelationKind(params)
      : "exponential";
    const etaResult = (window.Calculations && window.Calculations.computeEta)
      ? window.Calculations.computeEta(correlationKind, alpha)
      : { value: window.VisualMath?.getEta(params) || 1, formulaId: "fallback", latex: "", tableRow: null };
    const eta = etaResult.value;
    const deltaU1 = Math.sqrt(Pg / 2);
    const conditionalStep = deltaU1 / eta;
    const Dg = 6 * sigmaG;
    const mu = Math.max(1, Math.ceil(Math.log2(Dg / conditionalStep + 2)));
    const thresholdCount = Math.pow(2, mu) - 1;
    const levelCount = thresholdCount + 1;
    const dU = Dg / (thresholdCount - 1);
    const thresholds = Array.from(
      { length: thresholdCount },
      (_, index) => -3 * sigmaG + index * dU
    );
    const levels = Array.from(
      { length: levelCount },
      (_, index) => -3 * sigmaG + (index - 0.5) * dU
    );
    const codebook = buildCodebook(levelCount, mu);

    const tauSim = dt / mu;
    const k1 = 2;
    const dfPcm = k1 / tauSim;
    const f0 = safeNumber(params.primaryFrequency, 60);
    const f1 = safeNumber(params.secondaryFrequency, f0 + 1.5);
    const deltaCarrierKhz = Math.abs(f1 - f0) * 1000;
    // Ширина спектра модулированного сигнала — через общий модуль Calculations,
    // чтобы формула, расчёт и LaTeX всегда соответствовали методичке.
    const spectrumResult = (window.Calculations && window.Calculations.computeSpectra)
      ? window.Calculations.computeSpectra({
          modulation: params.modulation,
          bitDuration: tauSim,
          digitalBandwidth: dfPcm,
          carrierFrequency: f0,
          secondCarrierFrequency: f1,
        })
      : null;
    let dfSignal, bandwidthDescription, bandwidthFormulaLatex;
    if (spectrumResult) {
      dfSignal = spectrumResult.modulatedBandwidth;
      bandwidthDescription = spectrumResult.bandwidthDescription;
      bandwidthFormulaLatex = spectrumResult.bandwidthFormulaLatex;
    } else {
      dfSignal = 2 * dfPcm;
      bandwidthDescription = "ДАМ: полоса модулированного сигнала вдвое шире цифрового сигнала.";
      bandwidthFormulaLatex = "\\Delta f_s=2\\Delta f_{ц}";
      if (params.modulation === "DCHM") {
        dfSignal = deltaCarrierKhz + 2 * dfPcm;
        bandwidthDescription = "ДЧМ: полоса включает разнос несущих f1 и f2 и боковые составляющие цифрового сигнала.";
        bandwidthFormulaLatex = "\\Delta f_s=|f_1-f_2|+2\\Delta f_{ц}";
      } else if (params.modulation === "DOFM") {
        const phaseIndex = Math.PI / 2;
        dfSignal = 2 * (phaseIndex + 1) * dfPcm;
        bandwidthDescription = "ДОФМ: спектр берётся как у фазовой манипуляции с индексом m_{\\text{ф}}=π/2.";
        bandwidthFormulaLatex = "\\Delta f_s=2(m_{\\text{ф}}+1)\\Delta f_{ц},\\quad m_{\\text{ф}}=\\pi/2";
      }
    }

    const N0 = safeNumber(params.noiseDensity, 0.0001);
    const h2 = safeNumber(params.signalNoiseRatio, 8.5);
    const noisePower = N0 * dfSignal;
    const signalPower = h2 * noisePower;
    const symbolPower = params.modulation === "DAM" ? signalPower / 2 : signalPower;
    const Um = params.modulation === "DAM" ? Math.sqrt(symbolPower) : Math.sqrt(2 * symbolPower);

    return {
      input: { Pg, beta, dfg, alpha, N0, h2, f0, f1 },
      source: { sigmaG, Dg },
      sampling: { fd, dt },
      quantizer: {
        eta, etaResult, deltaU1, conditionalStep, mu, thresholdCount, levelCount,
        dU, thresholds, levels,
      },
      coding: { mu, codebook, tauSim, k1, dfPcm },
      radio: {
        dfSignal, deltaCarrierKhz, bandwidthDescription, bandwidthFormulaLatex,
        noisePower, signalPower, symbolPower, Um,
        sigmaNoise: Math.sqrt(noisePower),
        capacity: dfSignal * Math.log2(1 + h2),
      },
      runtime: { radioSamplesPerBit: 32 },
      units: {
        Pg: "В²", sigmaG: "В", Dg: "В", deltaU1: "В", conditionalStep: "В", dU: "В",
        beta: "мс⁻¹", dfg: "кГц", fd: "кГц", dt: "мс", tauSim: "мс",
        dfPcm: "кГц", dfSignal: "кГц", N0: "мВт/Гц", noisePower: "Вт",
        signalPower: "Вт", Um: "В", capacity: "кбит/с",
      },
    };
  }

  window.SystemCalculations = { calculate };

  window.SignalData = {
    resetDerived: function() {
      const derivedFields = [
        "calculation",
        "source_components", "source_time_span_ms", "source_sigma", "source_spectrum_energy", "g_t",
        "x_t", "filter_error_abs", "filter_error_sq", "filter_error_analytic_sq", "filter_error_analytic_abs",
        "filtered_power_analytic", "filtered_power_empirical",
        "sampled_x_indices", "sampled_x_values", "sampling_step_indices", "sampling_frequency", "sampling_interval_ms",
        "thresholds", "levels", "quantized_indices", "quantized_v", "quantization_errors",
        "level_probabilities", "level_probabilities_empirical", "level_cumulative", "quantized_power_analytic",
        "quantization_eta", "quantization_gamma", "quantization_Px", "quantization_Py", "quantization_Bxv",
        "quantization_error_sq", "quantization_error_analytic_sq", "quantization_error_approx_sq",
        "quantization_step", "quantization_mu", "quantization_threshold_count", "quantization_level_count",
        "quantization_delta_u1", "quantization_conditional_step",
        "codebook", "code_words", "code_distance_matrix", "code_level_indices", "code_decimal_numbers",
        "digital_b", "b_t", "bit_probabilities", "indexFromCode", "code_mu",
        "S_t", "s_t", "radio_N", "radio_points_per_bit", "modulation_symbols", "df_s", "P_sh", "P_c", "Um", "noiseSigma",
        "n_t", "z_t", "channel_chi", "zMax", "noise_quadrature",
        "detectorTrace", "detector_channel1", "detector_channel2", "coherent_detects",
        "b_hat", "errors", "p_err_val", "p_err_formula", "receiver_type", "receiver_desc", "u0",
        "v_hat", "chunkErrors", "received_code_words", "original_code_words", "error_code_words", "decoded_indices",
        "transmission_noise_sq", "transmission_noise_analytic_sq", "transmission_noise_meta", "transition_distance_factor",
        "x_hat_t", "g_hat_t", "lpf_half_window", "lpf_first_zero", "lpf_fc_norm",
"reconstruction_error_t", "visual_delta_sq", "delta_sum_sq", "delta_sum_components",
        "sync", "shared_time_window"
      ];
      derivedFields.forEach((key) => { delete this[key]; });
      this.lastParamsString = null;
    },
    calculation: null,
    g_t: null,
    x_t: null,
    sampled_x_indices: null,
    sampled_x_values: null,
    quantized_v: null,
    digital_b: null,
    b_t: null,
    S_t: null,
    n_t: null,
    z_t: null,
    b_hat: null,
    errors: null,
    detectorTrace: null,
    v_hat: null,
    chunkErrors: null,
    x_hat_t: null,
    g_hat_t: null,
    levels: null,
    Um: null,
    u0: null,
    p_err_val: null,
    p_err_formula: null,
    delta_sum_sq: null,
    N: 1000,
    yMin: -4,
    yMax: 4,
    lastParamsString: null
  };
})();
