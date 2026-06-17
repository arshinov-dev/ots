// 02_tx_filter.js - Передающий ФНЧ
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  window.StageHandlers['tx-filter'] = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const vm = window.VisualMath;
      const dfg = vm.safeNumber(params.signalBandwidth, 28);
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      SignalData.x_t = new Array(N).fill(0);

      if (Array.isArray(SignalData.source_components) && SignalData.source_components.length) {
        const kept = SignalData.source_components.filter((component) => component.frequency <= dfg);
        for (let i = 0; i < N; i++) {
          const t = vm.indexToTimeMs(i, N, params);
          let value = 0;
          for (const component of kept) {
            value += component.amplitude * Math.cos(2 * Math.PI * component.frequency * t + component.phase);
          }
          SignalData.x_t[i] = value;
        }
        const mean = SignalData.x_t.reduce((a, b) => a + b, 0) / N;
        for (let i = 0; i < N; i++) SignalData.x_t[i] -= mean;
      } else {
        const w2 = Math.max(3, Math.floor(800 / dfg));
        for (let i = 0; i < N; i++) {
          let sum = 0, count = 0;
          for (let j = Math.max(0, i - w2); j <= Math.min(N - 1, i + w2); j++) {
            sum += SignalData.g_t[j];
            count++;
          }
          SignalData.x_t[i] = sum / count;
        }
      }

      const err = SignalData.g_t.reduce((acc, value, index) => acc + Math.pow(value - SignalData.x_t[index], 2), 0) / N;
      SignalData.filter_error_abs = err;
      SignalData.filter_error_sq = err / Pg;
      const analyticRel = window.VisualMath.getAnalyticFilterError(params);
      SignalData.filter_error_analytic_sq = analyticRel;
      SignalData.filter_error_analytic_abs = analyticRel * Pg;
      SignalData.filtered_power_analytic = Math.max(0, Pg - SignalData.filter_error_analytic_abs);
      SignalData.filtered_power_empirical = SignalData.x_t.reduce((acc, value) => acc + value * value, 0) / N;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, yZero, drawCurveSVG } = helpers;
      const vm = window.VisualMath;
      const Pg = vm.safeNumber(params.signalPower, 1.5);
      const dfg = vm.safeNumber(params.signalBandwidth, 28);
      const epsAbs = SignalData.filter_error_analytic_abs || 0;
      const Px = SignalData.filtered_power_analytic || Math.max(0, Pg - epsAbs);

      let timeSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      timeSvg += vm.axes(W, H, yZero, "t", "u(t)");
      timeSvg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5, 0.25);
      timeSvg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.8);
      timeSvg += `</svg>`;

      let errorSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      errorSvg += vm.axes(W, H, yZero, "t", "g(t)-x(t)");
      errorSvg += drawCurveSVG(SignalData.g_t.map((value, index) => value - SignalData.x_t[index]), '#e74c3c', 2.3, 0.9);
      errorSvg += `</svg>`;

      const fMax = vm.getSpectrumWindow(params).max;
      const Hf = 240;
      const spectrumSamples = vm.makeSamples(-fMax, fMax, 320, (f) => vm.spectrumValue(f, params));
      const spectrumPeak = Math.max(...spectrumSamples.map(([, y]) => y), 0.0001);
      const y = (value) => Hf - ((value - 0) / (spectrumPeak * 1.08)) * Hf;
      const x = (frequency) => ((frequency + fMax) / (2 * fMax)) * W;
      let freqSvg = `<svg viewBox="0 0 ${W} ${Hf}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      freqSvg += vm.axes(W, Hf, Hf - 18, "f", "G(f)");
      freqSvg += vm.drawXYCurve(spectrumSamples, W, Hf, -fMax, fMax, 0, spectrumPeak * 1.08, "#287c9f", 2.4, 0.4);
      const passSamples = spectrumSamples.map(([f, value]) => [f, Math.abs(f) <= dfg ? value : 0]);
      const tailSamples = spectrumSamples.map(([f, value]) => [f, Math.abs(f) > dfg ? value : 0]);
      freqSvg += vm.drawXYCurve(passSamples, W, Hf, -fMax, fMax, 0, spectrumPeak * 1.08, "#0c6b4f", 3, 1);
      freqSvg += `<path d="${tailSamples.map(([f, value], index) => `${index === 0 ? "M" : "L"} ${x(f)} ${y(value)}`).join(" ")} L ${W} ${Hf - 18} L 0 ${Hf - 18} Z" fill="rgba(231,76,60,0.16)" stroke="none" />`;
      freqSvg += `<rect x="${x(-dfg)}" y="20" width="${Math.max(0, x(dfg) - x(-dfg))}" height="${Hf - 38}" fill="rgba(12,107,79,0.08)" stroke="#0c6b4f" stroke-width="2" />
        <line x1="${x(-dfg)}" y1="20" x2="${x(-dfg)}" y2="${Hf - 18}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />
        <line x1="${x(dfg)}" y1="20" x2="${x(dfg)}" y2="${Hf - 18}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="5,6" />`;
      freqSvg += `</svg>`;
      const legend = `<dl class="visual-scale"><div><dt>До ФНЧ</dt><dd><span class="legend-line legend-line--source"></span>g(t)</dd></div><div><dt>После ФНЧ</dt><dd><span class="legend-line legend-line--filtered"></span>x(t), |f|≤Δfg</dd></div><div><dt>Энергия</dt><dd>Px≈${Px.toFixed(3)} В², εf²≈${epsAbs.toFixed(4)} В²</dd></div></dl>`;

      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Наложение во времени: g(t) и x(t)</p>${legend}${timeSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Ограничение спектра идеальным ФНЧ</p>${legend}${freqSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Потерянная часть реализации ε_f(t)=g(t)-x(t)</p>${legend}${errorSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber, SignalData) {
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const eps = SignalData.filter_error_analytic_sq || window.VisualMath.getAnalyticFilterError(params);
      const epsAbs = SignalData.filter_error_analytic_abs || eps * Pg;
      const Px = SignalData.filtered_power_analytic || Math.max(0, Pg - epsAbs);
      let theory = "Передающий ФНЧ оставляет основную полосу сообщения и подавляет высокочастотные составляющие. На временном графике это выглядит как сглаживание, а на спектре — как прямоугольное окно пропускания.";
      let formulas = `<div class="formula-preview"><span>Частота среза ФНЧ</span>\\[ f_{cp} = \\Delta f_g = ${toLatexNumber(dfg)} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Мощность после идеального ФНЧ</span>\\[ P_x = 2\\int_{0}^{f_{cp}}G_g(f)df \\approx ${toLatexNumber(Px.toFixed(4))} \\text{ В}^2 \\]</div>`;
      formulas += `<div class="formula-preview"><span>Аналитическая ошибка фильтрации</span>\\[ \\varepsilon_f^2 = 2\\int_{f_{cp}}^{\\infty}G_g(f)df = P_g-P_x \\approx ${toLatexNumber(epsAbs.toFixed(4))} \\text{ В}^2, \\quad \\frac{\\varepsilon_f^2}{P_g}\\approx ${toLatexNumber(eps.toFixed(4))} \\]</div>`;
      formulas += `<div class="stage-panel__info-box"><strong>Связь с графиком:</strong><br>Зелёная область на спектре даёт \\(P_x\\), красная область за \\(\\pm f_{cp}\\) даёт \\(\\varepsilon_f^2\\). Временной график строится из тех же спектральных составляющих, поэтому \\(g(t)\\) и \\(x(t)\\) связаны напрямую.</div>`;
      return { theory, formulas };
    }
  };
})();
