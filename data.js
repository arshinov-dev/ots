// data.js - Глобальный объект данных сигнала (единый источник данных)
(function() {
  'use strict';
  window.SignalData = {
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
    lastParamsString: ""
  };
})();