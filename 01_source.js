// 01_source.js - Источник и первичный преобразователь
(function() {
  'use strict';

  // Регистрация обработчика для этапа "source"
  window.StageHandlers = window.StageHandlers || {};
  window.StageHandlers.source = {
    // Обработка данных: генерация гауссовского процесса
    process: function(params, SignalData) {
      const N = SignalData.N;
      const dfg = parseFloat(params.signalBandwidth) || 28;
      const Pg = parseFloat(params.signalPower) || 1.5;
      const sigmaG = Math.sqrt(Pg);

      // БЛОК 01: Генерация случайного гауссовского процесса — источник c(t)
      // Используем преобразование Бокса — Мюллера
      SignalData.g_t = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        SignalData.g_t[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }

      // БЛОК 02: Сглаживание (формирование коррелированного процесса g(t))
      let smoothed = new Array(N).fill(0);
      const w1 = Math.max(3, Math.floor(600 / dfg));
      for (let i = 0; i < N; i++) {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - w1); j <= Math.min(N - 1, i + w1); j++) {
          sum += SignalData.g_t[j];
          count++;
        }
        smoothed[i] = sum / count;
      }

      // БЛОК 03: Нормировка к заданной дисперсии P_g
      let mean = smoothed.reduce((a, b) => a + b) / N;
      let variance = smoothed.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / N;
      let currentStdDev = Math.sqrt(variance);

      for (let i = 0; i < N; i++) {
        SignalData.g_t[i] = ((smoothed[i] - mean) / currentStdDev) * sigmaG;
      }
    },

    // Генерация SVG для этапа
    renderSVG: function(id, params, helpers, SignalData) {
      const { W, H, getY, getX, yZero, drawCurveSVG } = helpers;
      const sigmaG = Math.sqrt(parseFloat(params.signalPower) || 1.5);
      // Устанавливаем границы для всех последующих этапов
      SignalData.yMax = 4 * sigmaG;
      SignalData.yMin = -4 * sigmaG;

      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="stage-panel__visuals-svg">`;

      // Оси
      svg += `<line x1="0" y1="${yZero}" x2="${W}" y2="${yZero}" stroke="#d5ddd8" stroke-width="2" />`;
      svg += `<line x1="2" y1="0" x2="2" y2="${H}" stroke="#d5ddd8" stroke-width="2" />`;
      svg += `<text x="${W - 25}" y="${yZero - 15}" fill="#62716b" font-family="monospace" font-size="16">t</text>`;
      svg += `<text x="15" y="25" fill="#62716b" font-family="monospace" font-size="16">u(t)</text>`;

      let yPlus = getY(3 * sigmaG);
      let yMinus = getY(-3 * sigmaG);
      let valLabel = (3 * sigmaG).toFixed(2);
      svg += `<line x1="0" y1="${yPlus}" x2="${W}" y2="${yPlus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      svg += `<text x="15" y="${yPlus - 8}" fill="#62716b" font-family="monospace" font-size="14">+3σ_g (${valLabel} В)</text>`;
      svg += `<line x1="0" y1="${yMinus}" x2="${W}" y2="${yMinus}" stroke="#d5ddd8" stroke-dasharray="8,8" stroke-width="1.5" />`;
      svg += `<text x="15" y="${yMinus + 16}" fill="#62716b" font-family="monospace" font-size="14">-3σ_g (-${valLabel} В)</text>`;
      svg += drawCurveSVG(SignalData.g_t, '#287c9f', 2.5);
      svg += `</svg>`;
      return svg;
    },

    // Теория и формулы
    renderTheory: function(stage, params, toLatexNumber) {
      let theory = "Реальное сообщение непредсказуемо, поэтому оно моделируется как стационарный гауссовский случайный процесс с нулевым матожиданием.";
      let formulas = `<div class="formula-preview"><span>Мощность сигнала</span>\\[ P_g = \\sigma_g^2 = ${toLatexNumber(params.signalPower)} \\text{ В}^2 \\]</div>`;
      formulas += `<div class="formula-preview"><span>Ширина спектра</span>\\[ \\Delta f_g = ${toLatexNumber(params.signalBandwidth)} \\text{ кГц} \\]</div>`;
      return { theory, formulas };
    }
  };
})();