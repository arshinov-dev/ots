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
      const { W, H, getY, getX, yZero, drawCurveSVG, drawStemsSVG } = helpers;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      const vm = window.VisualMath;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += vm.axes(W, H, yZero, "t", "x(t)");
      svg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 2.6, 0.22);
      svg += drawStemsSVG(SignalData.sampled_x_indices, SignalData.sampled_x_values, '#0c6b4f');

      SignalData.sampled_x_indices.forEach((idx, i) => {
        const x = getX(idx);
        const y = getY(SignalData.sampled_x_values[i]);
        svg += `<circle cx="${x}" cy="${y}" r="4.5" fill="#0c6b4f" stroke="#ffffff" stroke-width="1.5" />`;
      });

      if (SignalData.sampled_x_indices.length > 2) {
        const x1 = getX(SignalData.sampled_x_indices[1]);
        const x2 = getX(SignalData.sampled_x_indices[2]);
        const y = H - 42;
        svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#e74c3c" stroke-width="2" />
          <path d="M ${x1 + 7} ${y - 5} L ${x1} ${y} L ${x1 + 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />
          <path d="M ${x2 - 7} ${y - 5} L ${x2} ${y} L ${x2 - 7} ${y + 5}" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round" />`;
      }

      svg += `</svg>`;

      let holdSvg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      holdSvg += vm.axes(W, H, yZero, "t/Δt", "x(kΔt)");
      holdSvg += drawCurveSVG(SignalData.x_t, '#0c6b4f', 1.8, 0.22);
      let holdD = "";
      SignalData.sampled_x_indices.forEach((idx, i) => {
        const nextIdx = SignalData.sampled_x_indices[i + 1] ?? (SignalData.N - 1);
        const x1 = getX(idx);
        const x2 = getX(nextIdx);
        const y = getY(SignalData.sampled_x_values[i]);
        if (i === 0) holdD += `M ${x1} ${y} `;
        else holdD += `L ${x1} ${y} `;
        holdD += `L ${x2} ${y} `;
        holdSvg += `<line x1="${x1}" y1="18" x2="${x1}" y2="${H - 18}" stroke="#b8c0bc" stroke-width="1" stroke-dasharray="4,7" />`;
      });
      holdSvg += `<path d="${holdD}" stroke="#1f2b26" stroke-width="2.8" fill="none" stroke-linejoin="miter" />`;
      holdSvg += `</svg>`;

      const combH = 190;
      let combSvg = `<svg viewBox="0 0 ${W} ${combH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      combSvg += vm.axes(W, combH, combH - 26, "t", "δ_T(t)");
      SignalData.sampled_x_indices.forEach((idx, index) => {
        const x = getX(idx);
        const tall = index % 5 === 0;
        combSvg += `<line x1="${x}" y1="${combH - 26}" x2="${x}" y2="${tall ? 24 : 52}" stroke="#287c9f" stroke-width="${tall ? 2.6 : 1.7}" />
          <circle cx="${x}" cy="${tall ? 24 : 52}" r="${tall ? 3.5 : 2.5}" fill="#287c9f" />`;
      });
      combSvg += `</svg>`;

      const specH = 260;
      const fMax = Math.max(fd * 1.15, dfg * 4);
      const spectrumPeak = Math.max(...vm.makeSamples(-dfg, dfg, 90, (f) => vm.spectrumValue(f, params)).map(([, y]) => y), 0.0001);
      const spectralLobe = (center, color, alphaValue) => {
        const samples = vm.makeSamples(center - dfg, center + dfg, 120, (f) => vm.spectrumValue(f - center, params));
        const base = specH - 24;
        const sx = (f) => ((f + fMax) / (2 * fMax)) * W;
        const sy = (value) => specH - ((value - 0) / (spectrumPeak * 1.12)) * specH;
        const path = samples.map(([f, value], index) => `${index === 0 ? "M" : "L"} ${sx(f)} ${sy(value)}`).join(" ");
        return `<path d="${path} L ${sx(center + dfg)} ${base} L ${sx(center - dfg)} ${base} Z" fill="${color}" fill-opacity="${alphaValue}" stroke="${color}" stroke-width="2" stroke-opacity="${Math.min(1, alphaValue + 0.25)}" />`;
      };
      let specSvg = `<svg viewBox="0 0 ${W} ${specH}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      specSvg += vm.axes(W, specH, specH - 24, "f", "X_d(f)");
      [-fd, 0, fd].forEach((center) => {
        specSvg += spectralLobe(center, center === 0 ? "#0c6b4f" : "#287c9f", center === 0 ? 0.36 : 0.16);
      });
      const sx = (f) => ((f + fMax) / (2 * fMax)) * W;
      [-fd / 2, fd / 2, -dfg, dfg].forEach((f) => {
        const isNyquist = Math.abs(f) === fd / 2;
        specSvg += `<line x1="${sx(f)}" y1="20" x2="${sx(f)}" y2="${specH - 24}" stroke="${isNyquist ? "#e74c3c" : "#62716b"}" stroke-width="${isNyquist ? 1.8 : 1.2}" stroke-dasharray="${isNyquist ? "6,6" : "4,8"}" />`;
      });
      specSvg += `</svg>`;

      const scaleNote = `<dl class="visual-scale"><div><dt>Частота</dt><dd>fд=${fd.toFixed(2)} кГц</dd></div><div><dt>Интервал</dt><dd>Δt=${dt.toFixed(4)} мс</dd></div><div><dt>Запас</dt><dd>fд/(2Δfg)=${alpha.toFixed(2)}</dd></div></dl>`;
      return `<div class="stage-panel__visuals-stack">
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Отсчёты x(kΔt) через интервал Δt</p>${scaleNote}${svg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Дискретно-аналоговая форма с удержанием отсчёта</p>${scaleNote}${holdSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Дискретизирующая решётка δ_T(t)</p>${scaleNote}${combSvg}</div>
        <div class="stage-panel__visuals-layer"><p class="stage-panel__visuals-header">Спектральные копии после дискретизации</p>${scaleNote}${specSvg}</div>
      </div>`;
    },

    renderTheory: function(stage, params, toLatexNumber) {
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const fd = 2 * alpha * dfg;
      const dt = 1 / fd;
      let theory = "Дискретизатор умножает ограниченный по спектру сигнал на периодическую решётку импульсов и оставляет последовательность отсчётов. Чем больше α, тем дальше спектральные копии друг от друга.";
      let formulas = `<div class="formula-preview"><span>Теорема Котельникова</span>\\[ f_д \\ge 2\\Delta f_g, \\quad f_д = 2\\alpha\\Delta f_g \\]</div>`;
      formulas += `<div class="formula-preview"><span>Частота дискретизации</span>\\[ f_д = 2 \\cdot ${toLatexNumber(alpha)} \\cdot ${toLatexNumber(dfg)} = ${toLatexNumber(fd.toFixed(2))} \\text{ кГц} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Интервал дискретизации</span>\\[ \\Delta t = \\frac{1}{f_д} \\approx ${toLatexNumber(dt.toFixed(4))} \\text{ мс} \\]</div>`;
      formulas += `<div class="formula-preview"><span>Модель дискретизации</span>\\[ x_d(t)=x(t)\\sum_{k=-\\infty}^{\\infty}\\delta(t-k\\Delta t), \\quad X_d(f)=f_д\\sum_{m=-\\infty}^{\\infty}X(f-mf_д) \\]</div>`;
      return { theory, formulas };
    }
  };
})();
