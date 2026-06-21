// 10_recipient.js - Приемный ФНЧ и получатель
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function meanSquareDiff(left, right) {
    const n = Math.min(left?.length || 0, right?.length || 0);
    if (!n) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.pow((left[i] || 0) - (right[i] || 0), 2);
    return sum / n;
  }

  // Идеальный ФНЧ через sinc-свёртку.
  // Согласован с текстом методички: ступенчатый интерполятор (g0(t) = 1 при t ∈ [0,T])
  // и последующий идеальный ФНЧ с полосой Δfg.
  // |K(f)| = 1 для |f| ≤ Δfg, 0 вне полосы.
  function idealLowpassFilter(xHat, params, SignalData) {
    const N = xHat.length;
    const calc = SignalData.calculation || window.SystemCalculations.calculate(params);
    const dfg = calc.input.dfg;
    const timeSpanMs = window.VisualMath.getTimeSpanMs(params);
    // Нормированная частота среза: циклы на один отсчёт визуальной сетки
    const fcNorm = Math.max(1e-6, dfg * timeSpanMs / N);
    // Первый нуль sinc: k = 1/(2*fcNorm). Окно — 3x от первого нуля.
    const firstZero = Math.ceil(1 / (2 * fcNorm));
    const halfWindow = Math.min(N - 1, Math.max(10, firstZero * 3));
    // Ядро sinc: h[k] = 2*fcNorm * sinc(2*fcNorm*k)
    // где sinc(x) = sin(πx)/(πx), h[0] = 2*fcNorm
    const kernel = new Array(2 * halfWindow + 1);
    let kernelSum = 0;
    for (let k = -halfWindow; k <= halfWindow; k++) {
      const arg = 2 * fcNorm * k;
      const val = Math.abs(arg) < 1e-9 ? 2 * fcNorm : Math.sin(Math.PI * arg) / (Math.PI * k);
      kernel[k + halfWindow] = val;
      kernelSum += val;
    }
    // Нормировка: сумма ядра должна быть 1 (единичный коэффициент на нулевой частоте)
    if (Math.abs(kernelSum) > 1e-12) {
      for (let k = 0; k < kernel.length; k++) kernel[k] /= kernelSum;
    }
    // Свёртка с репликацией краёв
    const result = new Array(N);
    for (let n = 0; n < N; n++) {
      let acc = 0;
      for (let k = -halfWindow; k <= halfWindow; k++) {
        let idx = n - k;
        if (idx < 0) idx = 0;
        else if (idx >= N) idx = N - 1;
        acc += xHat[idx] * kernel[k + halfWindow];
      }
      result[n] = acc;
    }
    return { signal: result, halfWindow, fcNorm, firstZero };
  }

  window.StageHandlers.recipient = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const sigmaG = Math.sqrt(Pg);

      // Идеальный ФНЧ с полосой Δfg, применённый к ступенчатому сигналу x̂(t)
      const lpf = idealLowpassFilter(SignalData.x_hat_t, params, SignalData);
      SignalData.g_hat_t = lpf.signal;
      SignalData.lpf_half_window = lpf.halfWindow;
      SignalData.lpf_first_zero = lpf.firstZero;
      SignalData.lpf_fc_norm = lpf.fcNorm;

      SignalData.reconstruction_error_t = new Array(N).fill(0).map((_, i) => (SignalData.g_t[i] || 0) - (SignalData.g_hat_t[i] || 0));
      SignalData.visual_delta_sq = meanSquareDiff(SignalData.g_t, SignalData.g_hat_t) / Pg;

      const filterAbs = SignalData.filter_error_analytic_abs || SignalData.filter_error_abs || 0;
      const quantAbs = SignalData.quantization_error_analytic_sq || SignalData.quantization_error_sq || 0;
      const transmissionAbs = SignalData.transmission_noise_analytic_sq || SignalData.transmission_noise_sq || 0;
      SignalData.delta_sum_sq = (filterAbs + quantAbs + transmissionAbs) / Pg;
      SignalData.delta_sum_components = { filterAbs, quantAbs, transmissionAbs };
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, yZero } = helpers;
      const vm = window.VisualMath;
      const stepSize = vm.getSampleStep(params);
      const Pg = parseFloat(params.signalPower) || 1.5;
      const calc = SignalData.calculation || window.SystemCalculations.calculate(params);
      const dfg = calc.input.dfg;
      const acceptableError = parseFloat(params.acceptableError) || 0.12;
      const shownStepCount = Math.min(10, SignalData.v_hat.length);
      const stepWindow = vm.chooseDynamicWindow(SignalData.v_hat, {
        minLength: Math.min(6, shownStepCount),
        length: shownStepCount
      });
      const startIndex = Math.min(SignalData.N - 1, stepWindow.start * stepSize);
      const endIndex = Math.min(SignalData.N - 1, Math.max(startIndex + 1, stepWindow.end * stepSize));
      const timeStart = vm.indexToTimeMs(startIndex, SignalData.N, params);
      const timeEnd = vm.indexToTimeMs(endIndex, SignalData.N, params);
      const sx = (index) => ((vm.indexToTimeMs(index, SignalData.N, params) - timeStart) / (timeEnd - timeStart)) * W;
      const sy = (value) => H - ((value - SignalData.yMin) / (SignalData.yMax - SignalData.yMin)) * H;
      const curveSamples = (values) => values.slice(startIndex, endIndex + 1).map((value, offset) => [
        vm.indexToTimeMs(startIndex + offset, SignalData.N, params),
        value
      ]);

      // --- Ступенчатый сигнал x̂(t) ---
      let stepSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      stepSvg += vm.axes(W, H, yZero, "t, мс", "u(t), В", {
        xMin: timeStart, xMax: timeEnd, yMin: SignalData.yMin, yMax: SignalData.yMax
      });
      let stepD = "";
      for (let wordIndex = stepWindow.start; wordIndex < stepWindow.end; wordIndex++) {
        const i = Math.min(SignalData.N - 1, wordIndex * stepSize);
        const next = Math.min(endIndex, (wordIndex + 1) * stepSize);
        const x1 = sx(i);
        const x2 = sx(next);
        const y = sy(SignalData.v_hat[wordIndex] ?? 0);
        if (!stepD) stepD = `M ${x1} ${y}`;
        else stepD += ` L ${x1} ${y}`;
        stepD += ` L ${x2} ${y}`;
      }
      stepSvg += `<path d="${stepD}" stroke="#0c6b4f" stroke-width="2.8" fill="none" stroke-linejoin="round" />`;
      stepSvg += vm.drawXYCurve(curveSamples(SignalData.g_hat_t), W, H, timeStart, timeEnd, SignalData.yMin, SignalData.yMax, '#7554aa', 2.6, 0.9);
      stepSvg += `</svg>`;

      // --- Сравнение g(t) и ĝ(t) ---
      let overlaySvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      overlaySvg += vm.axes(W, H, yZero, "t, мс", "u(t), В", {
        xMin: timeStart, xMax: timeEnd, yMin: SignalData.yMin, yMax: SignalData.yMax
      });
      overlaySvg += vm.drawXYCurve(curveSamples(SignalData.g_t), W, H, timeStart, timeEnd, SignalData.yMin, SignalData.yMax, '#287c9f', 2.2);
      overlaySvg += vm.drawXYCurve(curveSamples(SignalData.g_hat_t), W, H, timeStart, timeEnd, SignalData.yMin, SignalData.yMax, '#7554aa', 3);
      overlaySvg += `</svg>`;

      // --- Компактная форма АЧХ идеального ФНЧ ---
      const filterNote = `<div class="stage-panel__info-box">\\( |K(f)|=1 \\) при \\( |f|\\\le\\\Delta f_g \\), иначе \\(0\\); \\(\\\Delta f_g=${dfg.toFixed(2)}\\) кГц.</div>`;

      // --- Составляющие ошибки ---
      const components = SignalData.delta_sum_components || {};
      const componentRows = [
        { label: "ξф²", value: components.filterAbs || 0, color: "#287c9f" },
        { label: "ξкв²", value: components.quantAbs || 0, color: "#0c6b4f" },
        { label: "ξп²", value: components.transmissionAbs || 0, color: "#e74c3c" },
      ];
      const maxComponent = Math.max(...componentRows.map((item) => item.value), 1e-9);
      const compH = 210;
      const barW = W * 0.16;
      let compSvg = `<svg viewBox="0 0 ${W} ${compH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      compSvg += window.VisualMath.axes(W, compH, compH - 28, "составляющая", "В²");
      componentRows.forEach((item, index) => {
        const x = W * (0.22 + index * 0.25);
        const h = Math.max(2, (item.value / maxComponent) * (compH - 62));
        compSvg += `<rect x="${x}" y="${compH - 28 - h}" width="${barW}" height="${h}" fill="${item.color}" fill-opacity="0.74" />
          <text x="${x + barW / 2}" y="${compH - 9}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="middle">${item.label}</text>
          <text x="${x + barW / 2}" y="${Math.max(16, compH - 34 - h)}" fill="#31433b" font-family="monospace" font-size="13" text-anchor="middle">${item.value.toFixed(4)}</text>`;
      });
      compSvg += `</svg>`;

      const isSuccess = (SignalData.delta_sum_sq || 0) <= acceptableError;
      const stepScale = `<dl class="visual-scale"><div><dt>Ступени</dt><dd>\\(\\hat x(t)\\), ${stepWindow.length} уровней</dd></div><div><dt>Сглаживание</dt><dd>\\(\\hat g(t)\\)</dd></div><div><dt>Общее окно</dt><dd>${(timeEnd - timeStart).toFixed(3)} мс</dd></div></dl>`;
      const compareScale = `<dl class="visual-scale"><div><dt>Синяя</dt><dd>исходное \\(g(t)\\)</dd></div><div><dt>Фиолетовая</dt><dd>восстановленное \\(\\hat g(t)\\)</dd></div><div><dt>Окно</dt><dd>совпадает с \\(\\hat x(t)\\)</dd></div></dl>`;
      const errorScale = `<dl class="visual-scale"><div><dt>Итог</dt><dd>\\(\\delta_\\Sigma^2=${(SignalData.delta_sum_sq || 0).toFixed(4)}\\)</dd></div><div><dt>Допуск</dt><dd>\\(\\delta_{\\text{доп}}^2=${acceptableError.toFixed(4)}\\)</dd></div><div><dt>Результат</dt><dd>${isSuccess ? "норма" : "требуется корректировка"}</dd></div></dl>`;
      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">\\(\\hat x(t)\\) после интерполяции → сглаженный сигнал \\(\\hat g(t)\\)</p>${stepScale}${stepSvg}${filterNote}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Финальное сравнение \\(g(t)\\) и \\(\\hat g(t)\\)</p>${compareScale}${overlaySvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">\\(\\xi_{\\text{ф}}^2\\), \\(\\xi_{\\text{кв}}^2\\), \\(\\xi_{\\text{п}}^2\\) и официальная итоговая ошибка</p>${errorScale}${compSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const delta_sum_sq = SignalData.delta_sum_sq || 0;
      const acceptableError = parseFloat(params.acceptableError) || 0.12;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const calc = SignalData.calculation || window.SystemCalculations.calculate(params);
      const dfg = calc.input.dfg;
      const components = SignalData.delta_sum_components || {};
      const filterAbs = components.filterAbs ?? SignalData.filter_error_analytic_abs ?? 0;
      const quantAbs = components.quantAbs ?? SignalData.quantization_error_analytic_sq ?? 0;
      const transmissionAbs = components.transmissionAbs ?? SignalData.transmission_noise_analytic_sq ?? 0;
      const theory = `Приёмный ФНЧ превращает восстановленные уровни ЦАП в непрерывную оценку сообщения. Модель: ступенчатый интерполятор с \\(g_0(t)=1\\) при \\(t\\in[0,T]\\), затем идеальный ФНЧ с полосой \\(\\Delta f_g\\).`;
      let formulas = `<div class="formula-preview"><span>Ступенчатая интерполяция ЦАП</span>\\[ \\hat{x}(t)=\\sum_k \\hat{v}_k g_0(t-k\\Delta t),\\quad g_0(t)=\\begin{cases}1,&0\\le t\\le\\Delta t\\\\0,&\\text{иначе}\\end{cases} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Идеальный приёмный ФНЧ</span>\\[ |K(f)|=\\begin{cases}1,&|f|\\le\\Delta f_g\\\\0,&|f|>\\Delta f_g\\end{cases} \\]</div>`;
      formulas += `<details class="visual-step"><summary class="visual-step__summary"><span>ФНЧ</span><strong>Показать импульсную характеристику</strong></summary><div class="visual-step__body"><div class="formula-preview"><span>Импульсная характеристика идеального ФНЧ</span>\\[ h(t)=2\\Delta f_g\\cdot\\text{sinc}(2\\Delta f_g t),\\quad \\text{sinc}(x)=\\frac{\\sin(\\pi x)}{\\pi x} \\]</div></div></details>`;
      formulas += `<div class="formula-preview"><span>Итоговая расчетная ошибка</span>\\[ \\delta_\\Sigma^2 = \\frac{\\varepsilon_{\\text{ф}}^2 + \\varepsilon_{\\text{кв}}^2 + \\xi_{\\text{п}}^2}{P_g} = \\frac{${toLatexNumber(filterAbs.toFixed(4))} + ${toLatexNumber(quantAbs.toFixed(4))} + ${toLatexNumber(transmissionAbs.toFixed(4))}}{${toLatexNumber(Pg)}} = ${toLatexNumber(delta_sum_sq.toFixed(4))} \\]</div>`;
      const isSuccess = delta_sum_sq <= acceptableError;
      formulas += `<div class="stage-panel__info-box ${isSuccess ? 'stage-panel__info-box--success' : 'stage-panel__info-box--error'}"><strong>Сравнение с допуском:</strong><br>\\( \\delta_\\Sigma^2 = ${toLatexNumber(delta_sum_sq.toFixed(4))} \\), \\( \\delta_{\\text{доп}}^2 = ${toLatexNumber(acceptableError)} \\)<br>${isSuccess ? '<span style="color: #0c6b4f; font-weight: bold;">НОРМА</span>' : '<span style="color: #e74c3c; font-weight: bold;">ТРЕБУЕТСЯ КОРРЕКТИРОВКА</span>'}</div>`;
      return { theory, formulas };
    }
  };
})();
