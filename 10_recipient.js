// 10_recipient.js - Приёмный ФНЧ и получатель
(function() {
  'use strict';
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.recipient = {
    process: function(params, SignalData) {
      const N = SignalData.N;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const w2 = Math.max(3, Math.floor(800 / dfg));
      const Pg = parseFloat(params.signalPower) || 1.5;
      const sigmaG = Math.sqrt(Pg);

      SignalData.g_hat_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w2); j <= Math.min(N - 1, i + w2); j++) { sum += SignalData.x_hat_t[j]; count++; }
        SignalData.g_hat_t[i] = sum / count;
      }

      let diffSum = 0;
      for (let i = 0; i < N; i++) { diffSum += Math.pow(SignalData.g_t[i] - SignalData.g_hat_t[i], 2); }
      SignalData.delta_sum_sq = diffSum / (N * Pg);
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;
    },
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getX, getY, yZero, drawCurveSVG } = helpers;
      const alpha = parseFloat(params.samplingIncrease) || 2;
      const stepSize = Math.max(15, Math.floor(100 / alpha));
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;
      svg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" />`;
      let stepD = `M 0 ${getY(SignalData.x_hat_t[0])}`;
      for (let i = 0; i < SignalData.N; i += stepSize) {
        let x1 = getX(i); let x2 = getX(Math.min(i + stepSize, SignalData.N - 1));
        let y = getY(SignalData.x_hat_t[i]);
        if (i === 0) stepD = `M ${x1} ${y}`; else stepD += ` L ${x1} ${y}`;
        stepD += ` L ${x2} ${y}`;
      }
      svg += `<path d="${stepD}" stroke="rgba(12, 107, 79, 0.4)" stroke-dasharray="4,4" stroke-width="2" fill="none" stroke-linejoin="round" />`;

      let areaD = `M ${getX(0)} ${getY(SignalData.g_t[0])}`;
      for (let i = 1; i < SignalData.N; i++) areaD += ` L ${getX(i)} ${getY(SignalData.g_t[i])}`;
      for (let i = SignalData.N - 1; i >= 0; i--) areaD += ` L ${getX(i)} ${getY(SignalData.g_hat_t[i])}`;
      areaD += ` Z`;
      svg += `<path d="${areaD}" fill="rgba(231, 76, 60, 0.25)" stroke="none" />`;
      svg += drawCurveSVG(SignalData.g_t, '#287c9f', 2);
      svg += drawCurveSVG(SignalData.g_hat_t, '#7554aa', 3);
      svg += `</svg>`;
      return svg;
    },
    renderTheory: function(stage, params, toLatexNumber) {
      let theory = "Приёмный ФНЧ сглаживает ступеньки x̂(t), восстанавливая непрерывный сигнал ĝ(t) — итоговую оценку сообщения.";
      const delta_sum_sq = SignalData.delta_sum_sq || 0;
      const acceptableError = parseFloat(params.acceptableError) || 0.12;
      let formulas = `<div class="formula-preview"><span>Суммарная ошибка восстановления</span>\\[ \\delta_\\Sigma^2 = \\varepsilon_ф^2 + \\xi_{кв}^2 + \\xi_{п}^2 \\approx ${toLatexNumber(delta_sum_sq.toFixed(4))} \\]</div>`;
      let isSuccess = delta_sum_sq <= acceptableError;
      formulas += `<div class="stage-panel__info-box ${isSuccess ? 'stage-panel__info-box--success' : 'stage-panel__info-box--error'}"><strong>Проверка качества:</strong><br>Допустимая ошибка: \\( \\delta_{доп}^2 = ${toLatexNumber(acceptableError)} \\)<br>${isSuccess ? '<span style="color: #0c6b4f; font-weight: bold;">✓ Система спроектирована верно.</span>' : '<span style="color: #e74c3c; font-weight: bold;">✗ Требуется корректировка.</span>'}</div>`;
      return { theory, formulas };
    }
  };
})();
