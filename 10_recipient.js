// 10_recipient.js - Приемный ФНЧ и получатель
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  function getSmoothingWindow(params) {
    const dfg = parseFloat(params.signalBandwidth) || 28;
    return Math.max(3, Math.floor(800 / dfg));
  }

  function meanSquareDiff(left, right) {
    const n = Math.min(left?.length || 0, right?.length || 0);
    if (!n) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.pow((left[i] || 0) - (right[i] || 0), 2);
    return sum / n;
  }

  window.StageHandlers.recipient = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const w2 = getSmoothingWindow(params);
      const Pg = parseFloat(params.signalPower) || 1.5;
      const sigmaG = Math.sqrt(Pg);

      SignalData.g_hat_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w2); j <= Math.min(N - 1, i + w2); j++) {
          sum += SignalData.x_hat_t[j];
          count++;
        }
        SignalData.g_hat_t[i] = sum / count;
      }

      SignalData.reconstruction_error_t = new Array(N).fill(0).map((_, i) => (SignalData.g_t[i] || 0) - (SignalData.g_hat_t[i] || 0));
      SignalData.visual_delta_sq = meanSquareDiff(SignalData.g_t, SignalData.g_hat_t) / Pg;
      SignalData.smoothing_window = w2;

      const filterAbs = SignalData.filter_error_analytic_abs || SignalData.filter_error_abs || 0;
      const quantAbs = SignalData.quantization_error_analytic_sq || SignalData.quantization_error_sq || 0;
      const transmissionAbs = SignalData.transmission_noise_analytic_sq || SignalData.transmission_noise_sq || 0;
      SignalData.delta_sum_sq = (filterAbs + quantAbs + transmissionAbs) / Pg;
      SignalData.delta_sum_components = { filterAbs, quantAbs, transmissionAbs };
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getY, yZero, drawCurveSVG } = helpers;
      const stepSize = window.VisualMath.getSampleStep(params);
      const Pg = parseFloat(params.signalPower) || 1.5;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const w2 = SignalData.smoothing_window || getSmoothingWindow(params);

      let stepSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      stepSvg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" />`;
      let stepD = `M 0 ${getY(SignalData.x_hat_t[0])}`;
      for (let i = 0; i < SignalData.N; i += stepSize) {
        const x1 = getX(i);
        const x2 = getX(Math.min(i + stepSize, SignalData.N - 1));
        const y = getY(SignalData.x_hat_t[i]);
        if (i === 0) stepD = `M ${x1} ${y}`;
        else stepD += ` L ${x1} ${y}`;
        stepD += ` L ${x2} ${y}`;
      }
      stepSvg += drawCurveSVG(SignalData.g_t, '#287c9f', 1.8, 0.32);
      stepSvg += `<path d="${stepD}" stroke="#0c6b4f" stroke-width="2.8" fill="none" stroke-linejoin="round" />`;
      stepSvg += `</svg>`;

      let overlaySvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      overlaySvg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" />`;
      let areaD = `M ${getX(0)} ${getY(SignalData.g_t[0])}`;
      for (let i = 1; i < SignalData.N; i++) areaD += ` L ${getX(i)} ${getY(SignalData.g_t[i])}`;
      for (let i = SignalData.N - 1; i >= 0; i--) areaD += ` L ${getX(i)} ${getY(SignalData.g_hat_t[i])}`;
      areaD += ` Z`;
      overlaySvg += `<path d="${areaD}" fill="rgba(231, 76, 60, 0.25)" stroke="none" />`;
      overlaySvg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.2);
      overlaySvg += drawCurveSVG(SignalData.g_hat_t, '#7554aa', 3);
      overlaySvg += `</svg>`;

      const errMax = Math.max(...(SignalData.reconstruction_error_t || [0]).map(Math.abs), 1e-6);
      const errH = 190;
      const errY = (value) => errH / 2 - (value / errMax) * (errH * 0.36);
      let errSvg = `<svg viewBox="0 0 ${W} ${errH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      errSvg += `<line x1="0" y1="${errH / 2}" x2="${W}" y2="${errH / 2}" stroke="#d5ddd8" stroke-width="2" />`;
      let errD = `M 0 ${errY(SignalData.reconstruction_error_t?.[0] || 0)}`;
      for (let i = 1; i < SignalData.N; i++) errD += ` L ${getX(i)} ${errY(SignalData.reconstruction_error_t[i] || 0)}`;
      errSvg += `<path d="${errD}" stroke="#e74c3c" stroke-width="2.4" fill="none" stroke-linejoin="round" />`;
      errSvg += `</svg>`;

      const specH = 240;
      const cutoff = dfg;
      const xMax = Math.max(dfg * 3, 10);
      const responseSamples = window.VisualMath.makeSamples(0, xMax, 260, (f) => {
        const ratio = Math.max(0, Math.min(1, 1 - Math.pow(f / Math.max(cutoff, 1e-6), 2)));
        return f <= cutoff ? Math.sqrt(ratio) : 0;
      });
      const responseSvg = window.VisualMath.chartSvg({
        W, H: specH, xMin: 0, xMax, yMin: 0, yMax: 1.08,
        xLabel: "f, кГц", yLabel: "|K(f)|", samples: responseSamples, color: "#7554aa", width: 2.6
      });

      const components = SignalData.delta_sum_components || {};
      const componentRows = [
        { label: "εф²", value: components.filterAbs || 0, color: "#287c9f" },
        { label: "εкв²", value: components.quantAbs || 0, color: "#0c6b4f" },
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

      const stepScale = `<dl class="visual-scale"><div><dt>Вход ЦАП</dt><dd>x̂(t) из блока 09</dd></div><div><dt>Интервал</dt><dd>Δt = ${stepSize} точек визуальной сетки</dd></div><div><dt>Сравнение</dt><dd>бледная кривая: g(t)</dd></div></dl>`;
      const filterScale = `<dl class="visual-scale"><div><dt>ФНЧ</dt><dd>g0(t)=1 при 0≤t≤T</dd></div><div><dt>Окно</dt><dd>${2 * w2 + 1} отсчетов</dd></div><div><dt>Граница</dt><dd>Δfg=${dfg.toFixed(2)} кГц</dd></div></dl>`;
      const compareScale = `<dl class="visual-scale"><div><dt>Синяя</dt><dd>исходное сообщение g(t)</dd></div><div><dt>Фиолетовая</dt><dd>восстановленное ĝ(t)</dd></div><div><dt>Красная область</dt><dd>g(t)-ĝ(t)</dd></div></dl>`;
      const errorScale = `<dl class="visual-scale"><div><dt>Визуально</dt><dd>δвиз²=${(SignalData.visual_delta_sq || 0).toFixed(4)}</dd></div><div><dt>Расчетно</dt><dd>δΣ²=${(SignalData.delta_sum_sq || 0).toFixed(4)}</dd></div><div><dt>Нормировка</dt><dd>Pg=${Pg.toFixed(4)} В²</dd></div></dl>`;
      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Ступенчатый сигнал после декодера x̂(t)</p>${stepScale}${stepSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Приемный ФНЧ: сглаживание ступенек ЦАП</p>${filterScale}${responseSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Финальное сравнение g(t) и ĝ(t)</p>${compareScale}${overlaySvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Мгновенная ошибка восстановления e(t)=g(t)-ĝ(t)</p>${errorScale}${errSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Составляющие итоговой среднеквадратической ошибки</p>${errorScale}${compSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const delta_sum_sq = SignalData.delta_sum_sq || 0;
      const acceptableError = parseFloat(params.acceptableError) || 0.12;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const components = SignalData.delta_sum_components || {};
      const filterAbs = components.filterAbs ?? SignalData.filter_error_analytic_abs ?? 0;
      const quantAbs = components.quantAbs ?? SignalData.quantization_error_analytic_sq ?? 0;
      const transmissionAbs = components.transmissionAbs ?? SignalData.transmission_noise_analytic_sq ?? 0;
      const visualDelta = SignalData.visual_delta_sq || 0;
      const theory = "Приемный ФНЧ превращает восстановленные уровни ЦАП в непрерывную оценку сообщения. Здесь финально видно, какие искажения пришли из передающего фильтра, квантователя и цифрового канала.";
      let formulas = `<div class="formula-preview"><span>Интерполяция ЦАП и приемный ФНЧ</span>\\[ \\hat{x}(t)=\\sum_k \\hat{v}_k g_0(t-k\\Delta t),\\quad g_0(t)=\\begin{cases}1,&0\\le t\\le\\Delta t\\\\0,&\\text{иначе}\\end{cases} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Восстановленное сообщение</span>\\[ \\hat{g}(t)=\\int_{-\\infty}^{\\infty}\\hat{x}(\\lambda)h_\\text{ФНЧ}(t-\\lambda)d\\lambda \\]</div>`;
      formulas += `<div class="formula-preview"><span>Итоговая расчетная ошибка</span>\\[ \\delta_\\Sigma^2 = \\frac{\\varepsilon_ф^2 + \\varepsilon_{кв}^2 + \\xi_{п}^2}{P_g} = \\frac{${toLatexNumber(filterAbs.toFixed(4))} + ${toLatexNumber(quantAbs.toFixed(4))} + ${toLatexNumber(transmissionAbs.toFixed(4))}}{${toLatexNumber(Pg)}} = ${toLatexNumber(delta_sum_sq.toFixed(4))} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ошибка на отрисованной реализации</span>\\[ \\delta_\\text{виз}^2=\\frac{1}{NP_g}\\sum_{i=1}^{N}\\left(g_i-\\hat{g}_i\\right)^2=${toLatexNumber(visualDelta.toFixed(4))} \\]</div>`;
      const isSuccess = delta_sum_sq <= acceptableError;
      formulas += `<div class="stage-panel__info-box ${isSuccess ? 'stage-panel__info-box--success' : 'stage-panel__info-box--error'}"><strong>Сравнение с допуском:</strong><br>\\( \\delta_\\Sigma^2 = ${toLatexNumber(delta_sum_sq.toFixed(4))} \\), \\( \\delta_{доп}^2 = ${toLatexNumber(acceptableError)} \\)<br>${isSuccess ? '<span style="color: #0c6b4f; font-weight: bold;">НОРМА</span>' : '<span style="color: #e74c3c; font-weight: bold;">ТРЕБУЕТСЯ КОРРЕКТИРОВКА</span>'}</div>`;
      return { theory, formulas };
    }
  };
})();
