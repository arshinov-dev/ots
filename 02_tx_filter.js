// 02_tx_filter.js - Передающий ФНЧ
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  window.StageHandlers['tx-filter'] = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const w2 = Math.max(3, Math.floor(800 / dfg));
      SignalData.x_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w2); j <= Math.min(N - 1, i + w2); j++) {
          sum += SignalData.g_t[j];
          count++;
        }
        SignalData.x_t[i] = sum / count;
      }

      const err = SignalData.g_t.reduce((acc, value, index) => acc + Math.pow(value - SignalData.x_t[index], 2), 0) / N;
      SignalData.filter_error_abs = err;
      SignalData.filter_error_sq = err / Pg;
      const analyticRel = window.VisualMath.getAnalyticFilterError(params);
      SignalData.filter_error_analytic_sq = analyticRel;
      SignalData.filter_error_analytic_abs = analyticRel * Pg;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, yZero, drawCurveSVG } = helpers;
      const vm = window.VisualMath;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const dfg = vm.safeNumber(params.signalBandwidth, 28);

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "t", "u(t)");
      timeSvg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5, 0.25);
      timeSvg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.8);
      timeSvg += `<rect x="${W - 220}" y="15" width="200" height="56" fill="#ffffff" fill-opacity="0.88" rx="6" stroke="#d5ddd8" />
        <line x1="${W - 202}" y1="31" x2="${W - 172}" y2="31" stroke="#287c9f" stroke-width="2.5" stroke-opacity="0.3" />
        <text x="${W - 162}" y="36" fill="#62716b" font-family="monospace" font-size="13">g(t) до ФНЧ</text>
        <line x1="${W - 202}" y1="53" x2="${W - 172}" y2="53" stroke="#0c6b4f" stroke-width="2.8" />
        <text x="${W - 162}" y="58" fill="#62716b" font-family="monospace" font-size="13">x(t) после ФНЧ</text>`;
      timeSvg += `</svg>`;

      const fMax = Math.max(dfg * 2.4, 40);
      const Hf = 240;
      const y = (value) => Hf - ((value - 0) / (Pg * 1.08)) * Hf;
      const x = (frequency) => ((frequency + fMax) / (2 * fMax)) * W;
      const spectrumSamples = vm.makeSamples(-fMax, fMax, 260, (f) => vm.spectrumValue(f, params));
      let freqSvg = `<svg viewBox="0 0 ${W} ${Hf}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      freqSvg += vm.axes(W, Hf, Hf - 18, "f", "G(f)");
      freqSvg += vm.drawXYCurve(spectrumSamples, W, Hf, -fMax, fMax, 0, Pg * 1.08, "#287c9f", 2.4, 0.28);
      const passY = y(Pg * 0.96);
      freqSvg += `<path d="M ${x(-fMax)} ${Hf - 18} L ${x(-dfg)} ${Hf - 18} L ${x(-dfg)} ${passY} L ${x(dfg)} ${passY} L ${x(dfg)} ${Hf - 18} L ${x(fMax)} ${Hf - 18}" stroke="#0c6b4f" stroke-width="3" fill="rgba(12,107,79,0.08)" stroke-linejoin="round" />
        <line x1="${x(-dfg)}" y1="20" x2="${x(-dfg)}" y2="${Hf - 18}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${x(dfg)}" y1="20" x2="${x(dfg)}" y2="${Hf - 18}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <text x="${W / 2}" y="28" fill="#e74c3c" font-family="monospace" font-size="14" text-anchor="middle">f_cp = Δf_g = ${dfg.toFixed(2)}</text>
        <text x="${x(dfg) + 10}" y="${passY - 8}" fill="#0c6b4f" font-family="monospace" font-size="14">идеальный ФНЧ</text>`;
      freqSvg += `</svg>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Наложение во времени: g(t) и x(t)</p>${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Ограничение спектра идеальным ФНЧ</p>${freqSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const eps = SignalData.filter_error_analytic_sq || window.VisualMath.getAnalyticFilterError(params);
      const epsAbs = SignalData.filter_error_analytic_abs || eps * Pg;
      let theory = "Передающий ФНЧ оставляет основную полосу сообщения и подавляет высокочастотные составляющие. На временном графике это выглядит как сглаживание, а на спектре — как прямоугольное окно пропускания.";
      let formulas = `<div class="formula-preview"><span>Частота среза ФНЧ</span>\\[ f_{cp} = \\Delta f_g = ${toLatexNumber(dfg)} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Аналитическая ошибка фильтрации</span>\\[ \\varepsilon_f^2 = 2\\int_{f_{cp}}^{\\infty}G_g(f)df \\approx ${toLatexNumber(epsAbs.toFixed(4))} \\text{ В}^2, \\quad \\frac{\\varepsilon_f^2}{P_g}\\approx ${toLatexNumber(eps.toFixed(4))} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Зелёный прямоугольник на спектре — это полоса \\(|f|\\le f_{cp}\\). Расчётная ошибка берётся как энергия спектрального хвоста за этой полосой, а не как сумма расхождений конкретной случайной реализации.</div>`;
      return { theory, formulas };
    }
  };
})();
