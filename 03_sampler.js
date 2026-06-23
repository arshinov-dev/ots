// 03_sampler.js - Дискретизатор АЦП
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};

  window.StageHandlers.sampler = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const stepSize = window.VisualMath.getSampleStep(params);
      SignalData.sampled_x_indices = [];
      SignalData.sampled_x_values = [];
      for (let i = 0; i < N; i += stepSize) {
        SignalData.sampled_x_indices.push(i);
        SignalData.sampled_x_values.push(SignalData.x_t[i]);
      }
      SignalData.sampling_step_indices = stepSize;
      SignalData.sampling_frequency = 2 * (parseFloat(params.samplingIncrease) || 2) * (parseFloat(params.signalBandwidth) || 28);
      SignalData.sampling_interval_ms = 1 / SignalData.sampling_frequency;
    },

    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, yZero } = helpers;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      const vm = window.VisualMath;
      const sync = SignalData.sync || {};
      const tw = sync.timeWindow || { start: 0, end: SignalData.x_t.length };
      const sw = sync.sampleWindow || { start: 0, end: Math.min(16, SignalData.sampled_x_values.length) };
      const visibleIndices = SignalData.sampled_x_indices.slice(sw.start, sw.end);
      const visibleValues = SignalData.sampled_x_values.slice(sw.start, sw.end);
      const startIndex = tw.start;
      const endIndex = Math.min(tw.end, SignalData.x_t.length);
      const timeStart = vm.indexToTimeMs(startIndex, SignalData.x_t.length, params);
      const timeEnd = vm.indexToTimeMs(Math.max(startIndex, endIndex - 1), SignalData.x_t.length, params);
      const continuousSamples = SignalData.x_t.slice(startIndex, endIndex).map((value, index) => [
        vm.indexToTimeMs(startIndex + index, SignalData.x_t.length, params),
        value
      ]);
      const sxTime = (index) => ((vm.indexToTimeMs(index, SignalData.x_t.length, params) - timeStart) / (timeEnd - timeStart)) * W;
      const syValue = (value) => H - ((value - SignalData.yMin) / (SignalData.yMax - SignalData.yMin)) * H;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += vm.axes(W, H, yZero, "t, мс", "x(t), В", {
        xMin: timeStart, xMax: timeEnd, yMin: SignalData.yMin, yMax: SignalData.yMax
      });
      svg += vm.drawXYCurve(continuousSamples, W, H, timeStart, timeEnd, SignalData.yMin, SignalData.yMax, '#287c9f', 1.7, 0.58);

      visibleIndices.forEach((idx, i) => {
        const x = sxTime(idx);
        const y = syValue(visibleValues[i]);
        svg += `<line x1="${x}" y1="${yZero}" x2="${x}" y2="${y}" stroke="#0c6b4f" stroke-width="2.2" />
          <circle cx="${x}" cy="${y}" r="3.6" fill="#0c6b4f" stroke="#ffffff" stroke-width="1.2" />`;
      });

      if (visibleIndices.length > 2) {
        const x1 = sxTime(visibleIndices[1]);
        const x2 = sxTime(visibleIndices[2]);
        const y = H - 42;
        svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#e74c3c" stroke-width="2" />
          <path d="M ${x1 + 7} ${y - 5} L ${x1} ${y} L ${x1 + 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />
          <path d="M ${x2 - 7} ${y - 5} L ${x2} ${y} L ${x2 - 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />
          <text class="plot-note" x="${(x1 + x2) / 2}" y="${y - 7}" text-anchor="middle">Δt</text>`;
      }

      svg += `</svg>`;

      const specH = 260;
      const fMax = Math.max(fd + dfg * 1.15, dfg * 4);
      const spectralLines = (center, color, opacity) => {
        const base = specH - 24;
        const sx = (f) => ((f + fMax) / (2 * fMax)) * W;
        return [-1, -0.5, 0, 0.5, 1].map((offset) => {
          const amplitude = offset === 0 ? 1 : Math.abs(offset) === 0.5 ? 0.56 : 0.18;
          const x = sx(center + offset * dfg);
          const y = base - amplitude * (specH - 66);
          return `<line x1="${x}" y1="${base}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${offset === 0 ? 3 : 1.8}" stroke-opacity="${opacity}" />`;
        }).join("");
      };
      let specSvg = `<svg viewBox="0 0 ${W} ${specH}" width="100%" height="auto" class="stage-panel__visuals-svg spectrum-plot spectrum-plot--schematic">`;
      specSvg += vm.axes(W, specH, specH - 24, "f, кГц", "Xд(f), норм.", {
        xMin: -fMax, xMax: fMax, yMin: 0, yMax: 1, note: "схематически, нормировано"
      });
      [-fd, 0, fd].forEach((center) => {
        specSvg += spectralLines(center, center === 0 ? "#0c6b4f" : "#287c9f", center === 0 ? 1 : 0.62);
      });
      const sx = (f) => ((f + fMax) / (2 * fMax)) * W;
      [-fd / 2, fd / 2, -dfg, dfg].forEach((f) => {
        const isNyquist = Math.abs(f) === fd / 2;
        specSvg += `<line x1="${sx(f)}" y1="20" x2="${sx(f)}" y2="${specH - 24}" stroke="${isNyquist ? "#e74c3c" : "#62716b"}" stroke-width="${isNyquist ? 1.8 : 1.2}" stroke-dasharray="${isNyquist ? "6,6" : "4,8"}" />`;
      });
      specSvg += `<text class="plot-note" x="${sx(0)}" y="42" text-anchor="middle">центральная копия</text>
        <text class="plot-note" x="${sx(-fd)}" y="58" text-anchor="middle">−fд</text>
        <text class="plot-note" x="${sx(fd)}" y="58" text-anchor="middle">+fд</text>
        <line x1="${sx(-dfg)}" y1="30" x2="${sx(dfg)}" y2="30" stroke="#e74c3c" stroke-width="1.5" />
        <text class="plot-note" x="${sx(0)}" y="23" text-anchor="middle">Δfg</text>`;
      specSvg += `</svg>`;

      const timeScale = `<dl class="visual-scale"><div><dt>Частота</dt><dd>\\(f_{\\text{д}}=${fd.toFixed(2)}\\) кГц</dd></div><div><dt>Интервал</dt><dd>\\(\\Delta t=${dt.toFixed(4)}\\) мс</dd></div><div><dt>Решётка</dt><dd>\\(\\delta_T(t)\\) — моменты отсчётов</dd></div></dl>`;
      const spectrumScale = `<dl class="visual-scale"><div><dt>Спектр</dt><dd>\\(X_{\\text{д}}(f)\\), нормировано</dd></div><div><dt>Полоса копии</dt><dd>\\(\\Delta f_g=${dfg.toFixed(2)}\\) кГц</dd></div><div><dt>Период копий</dt><dd>\\(f_{\\text{д}}=${fd.toFixed(2)}\\) кГц, \\(f_{\\text{д}}\\geq2\\Delta f_g\\)</dd></div></dl>`;
      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отсчёты \\(x(k\\Delta t)\\) на непрерывной кривой \\(x(t)\\)</p>${timeScale}${svg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Схематический спектр \\(X_{\\text{д}}(f)\\) после дискретизации</p>${spectrumScale}${specSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      let theory = `Дискретизатор умножает ограниченный по спектру сигнал на периодическую решётку импульсов и оставляет последовательность отсчётов. Чем больше \\(\\alpha\\), тем дальше спектральные копии друг от друга.`;
      let formulas = `<div class="formula-preview"><span>Теорема Котельникова</span>\\[ f_{\\text{д}} \\ge 2\\Delta f_g, \\quad f_{\\text{д}} = 2\\alpha\\Delta f_g \\]</div>`;
      formulas += `<div class="formula-preview"><span>Частота дискретизации</span>\\[ f_{\\text{д}} = 2 \\cdot ${toLatexNumber(alpha)} \\cdot ${toLatexNumber(dfg)} = ${toLatexNumber(fd.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Интервал дискретизации</span>\\[ \\Delta t = \\frac{1}{f_{\\text{д}}} \\approx ${toLatexNumber(dt.toFixed(4))} \\text{ мс} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Модель дискретизации</span>\\[ x_d(t)=x(t)\\sum_{k=-\\infty}^{\\infty}\\delta(t-k\\Delta t), \\quad X_d(f)=f_{\\text{д}}\\sum_{m=-\\infty}^{\\infty}X(f-mf_{\\text{д}}) \\]</div>`;
      return { theory, formulas };
    }
  };
})();
