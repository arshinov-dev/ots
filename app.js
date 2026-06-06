// app.js - Основной файл приложения
(function() {
  'use strict';

  // Глобальный объект для обработчиков этапов (заполняется из файлов 01-10)
  window.StageHandlers = window.StageHandlers || {};

  const stages = [
    { id: "source", title: "Источник и первичный преобразователь", group: "source", signal: "c(t) → g(t)" },
    { id: "tx-filter", title: "Передающий ФНЧ", group: "tx", signal: "g(t) → x(t)" },
    { id: "sampler", title: "Дискретизатор АЦП", group: "tx", signal: "x(t) → x(k · Δt)" },
    { id: "quantizer", title: "Квантователь АЦП", group: "tx", signal: "x(k · Δt) → vₖʲ" },
    { id: "encoder", title: "Кодер АЦП", group: "tx", signal: "vₖʲ → bₖᵘ" },
    { id: "modulator", title: "Модулятор и выход ПДУ", group: "tx", signal: "bₖᵘ + uₙ(t) → S(t)" },
    { id: "channel", title: "Непрерывный канал связи", group: "channel", signal: "S(t) + n(t) → z(t)" },
    { id: "detector", title: "Вход ПРУ, детектор и РУ", group: "rx", signal: "z(t) → b̂ₖᵘ" },
    { id: "decoder", title: "Декодер и интерполятор ЦАП", group: "rx", signal: "b̂ₖᵘ → x̂(t)" },
    { id: "recipient", title: "Приёмный ФНЧ и получатель", group: "rx", signal: "x̂(t) → ĉ(t)" },
  ];

  // DOM элементы
  const route = document.querySelector("[data-signal-route]");
  const panel = document.querySelector("[data-stage-panel]");
  const year = document.querySelector("[data-current-year]");
  const parametersForm = document.querySelector("[data-parameters-form]");
  const summary = document.querySelector("[data-parameters-summary]");
  const summaryTitle = document.querySelector("[data-summary-title]");
  const summaryDescription = document.querySelector("[data-summary-description]");
  const primaryFrequencyLabel = document.querySelector("[data-primary-frequency-label]");
  const primaryFrequencyDescription = document.querySelector("[data-primary-frequency-description]");
  const secondaryFrequencyField = document.querySelector("[data-secondary-frequency-field]");
  const variantPreset = document.querySelector("[data-variant-preset]");
  const receptionDescription = document.querySelector("[data-reception-description]");
  const summaryReceptionDescription = document.querySelector("[data-summary-reception-description]");
  const correlationPreview = document.querySelector("[data-correlation-preview]");
  const summaryCorrelationFormula = document.querySelector("[data-summary-correlation-formula]");
  const summaryBandwidthFormula = document.querySelector("[data-summary-bandwidth-formula]");

  let isApplyingVariant = false;
  let mathRenderTimeout;
  let currentStageId = stages[0].id; // Отслеживаем текущий выбранный этап

  // Используем SignalData из data.js (глобальный объект window.SignalData)
  const SignalData = window.SignalData;

  const modulationOptions = {
    DAM: { title: "ДАМ · дискретная амплитудная модуляция", description: "Двоичный код управляет амплитудой гармонической несущей.", primaryFrequencyLabel: "f<sub>0</sub>", primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DCHM: { title: "ДЧМ · дискретная частотная модуляция", description: "Двоичный код переключает несущую между частотами f₁ и f₂.", primaryFrequencyLabel: "f<sub>2</sub>", primaryFrequencyDescription: "Нижняя несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DOFM: { title: "ДОФМ · дискретная относительная фазовая модуляция", description: "Двоичный код управляет относительным изменением фазы несущей.", primaryFrequencyLabel: "f<sub>0</sub>", primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["SF", "СФ · сравнение фаз"], ["SP", "СП · сравнение полярностей"]] },
  };

  const correlationGroups = {
    exponential: { latex: String.raw`B_c(\tau) = P_g \cdot e^{-\beta |\tau|}, \quad -\infty < \tau < \infty`, bandwidthFactor: 2 },
    cosineSquared: { latex: String.raw`B_c(\tau) = \begin{cases} P_g \cos^2(\pi \beta \tau), & |\tau| \le \dfrac{1}{2\beta}, \\ 0, & |\tau| > \dfrac{1}{2\beta}. \end{cases}`, bandwidthFactor: 1.5 },
    gaussian: { latex: String.raw`B_c(\tau) = P_g \cdot e^{-0{,}5 \beta^2 \tau^2}, \quad -\infty < \tau < \infty`, bandwidthFactor: 1 },
    sinc: { latex: String.raw`B_c(\tau) = P_g \cdot \dfrac{\sin(2\pi \beta \tau)}{2\pi \beta \tau}, \quad -\infty < \tau < \infty`, bandwidthFactor: 1 },
    sincSquared: { latex: String.raw`B_c(\tau) = P_g \cdot \left[\dfrac{\sin(2\pi \beta \tau)}{2\pi \beta \tau}\right]^2, \quad |\tau| \le \dfrac{1}{2\beta}`, bandwidthFactor: 1 },
    cosineRatio: { latex: String.raw`B_c(\tau) = \dfrac{P_g \cos(2\pi \beta \tau)}{1 - (4\beta \tau)^2}, \quad -\infty < \tau < \infty`, bandwidthFactor: 4 },
    cosineLimited: { latex: String.raw`B_c(\tau) = \begin{cases} P_g \cos(2\pi \beta \tau), & |\tau| \le \dfrac{1}{4\beta}, \\ 0, & |\tau| > \dfrac{1}{4\beta}. \end{cases}`, bandwidthFactor: 3 },
    exponentialLinear: { latex: String.raw`B_c(\tau) = P_g (1 - \beta |\tau|) e^{-\beta |\tau|}`, bandwidthFactor: 2 },
  };

  const variants = [
    [1, 1, 13, 1.5, "DAM", 60, null, 0.0001, 14.5, "KO", 0.1, "exponential"],
    [2, 1.5, 14, 2, "DCHM", 61, 62.5, 0.0001, 8.5, "NO", 0.12, "exponential"],
    [3, 2, 15, 2.5, "DOFM", 62, null, 0.0001, 4.3, "SF", 0.14, "exponential"],
    [4, 2.5, 16, 3, "DAM", 63, null, 0.0001, 15, "NO", 0.16, "exponential"],
    [5, 3, 17, 3.5, "DCHM", 64, 65.5, 0.0001, 9, "KO", 0.18, "exponential"],
    [6, 3.5, 18, 3.5, "DOFM", 65, null, 0.0001, 5.2, "SP", 0.2, "cosineSquared"],
    [7, 1.2, 29, 3, "DAM", 66, null, 0.0001, 15.5, "KO", 0.09, "cosineSquared"],
    [8, 2.7, 30, 2.5, "DCHM", 67, 68.8, 0.0001, 9.5, "NO", 0.11, "cosineSquared"],
    [9, 2.2, 31, 2, "DOFM", 68, null, 0.0001, 4.6, "SF", 0.13, "cosineSquared"],
    [10, 2.7, 32, 1.5, "DAM", 69, null, 0.0001, 16, "NO", 0.15, "cosineSquared"],
    [11, 3.2, 33, 1.5, "DCHM", 70, 71.5, 0.0001, 10, "KO", 0.17, "cosineSquared"],
    [12, 3.7, 34, 2, "DOFM", 71, null, 0.0001, 4.9, "SP", 0.19, "cosineSquared"],
    [13, 1.4, 17, 2.5, "DAM", 72, null, 0.0001, 16.5, "KO", 0.1, "cosineSquared"],
    [14, 1.9, 18, 3, "DCHM", 73, 74.5, 0.0001, 10.5, "NO", 0.12, "cosineSquared"],
    [15, 2.4, 19, 3.5, "DOFM", 74, null, 0.0001, 5.5, "SF", 0.14, "cosineSquared"],
    [16, 2.9, 20, 3.5, "DAM", 75, null, 0.0001, 17, "NO", 0.16, "cosineSquared"],
    [17, 3.4, 21, 3, "DCHM", 76, 77.5, 0.0001, 11, "KO", 0.18, "sinc"],
    [18, 3.9, 22, 2.5, "DOFM", 77, null, 0.0001, 5.8, "SP", 0.2, "sinc"],
    [19, 4, 5, 2, "DAM", 78, null, 0.0001, 17.5, "KO", 0.09, "sinc"],
    [20, 4.2, 6, 1.5, "DCHM", 79, 80.5, 0.0001, 11.5, "NO", 0.11, "sinc"],
    [21, 4.4, 7, 1.5, "DOFM", 80, null, 0.0001, 6.1, "SF", 0.13, "sincSquared"],
    [22, 4.6, 8, 2, "DAM", 81, null, 0.0001, 18, "NO", 0.15, "sincSquared"],
    [23, 4.8, 9, 2.5, "DCHM", 82, 83.5, 0.0001, 12, "KO", 0.17, "sincSquared"],
    [24, 5, 10, 3, "DOFM", 83, null, 0.0001, 6.4, "SP", 0.19, "sincSquared"],
    [25, 3.8, 13, 3.5, "DAM", 84, null, 0.0001, 18.5, "KO", 0.1, "sincSquared"],
    [26, 3.3, 14, 3.5, "DCHM", 85, 86.5, 0.0001, 12.5, "NO", 0.12, "cosineRatio"],
    [27, 2.8, 15, 3, "DOFM", 86, null, 0.0001, 6.7, "SF", 0.14, "cosineRatio"],
    [28, 2.3, 16, 2.5, "DAM", 87, null, 0.0001, 19, "NO", 0.16, "cosineRatio"],
    [29, 1.8, 17, 2, "DCHM", 88, 89.5, 0.0001, 13, "KO", 0.18, "cosineRatio"],
    [30, 1.3, 18, 1.5, "DOFM", 89, null, 0.0001, 7, "SP", 0.2, "cosineRatio"],
    [31, 3.6, 7, 1.5, "DAM", 90, null, 0.0001, 19.5, "KO", 0.09, "cosineLimited"],
    [32, 3.1, 8, 2, "DCHM", 91, 92.5, 0.0001, 13.5, "NO", 0.11, "cosineLimited"],
    [33, 2.6, 9, 2.5, "DOFM", 92, null, 0.0001, 7.3, "SF", 0.13, "cosineLimited"],
    [34, 2.1, 10, 3, "DAM", 93, null, 0.0001, 20, "NO", 0.15, "cosineLimited"],
    [35, 1.6, 11, 3.5, "DCHM", 94, 95.5, 0.0001, 14, "KO", 0.17, "cosineLimited"],
    [36, 1.1, 12, 3.5, "DOFM", 95, null, 0.0001, 7.6, "SP", 0.19, "exponentialLinear"],
    [37, 1.2, 6, 3, "DAM", 96, null, 0.0001, 8, "NO", 0.12, "exponentialLinear"],
    [38, 1.5, 9, 2.5, "DCHM", 97, 98.5, 0.0001, 10, "KO", 0.13, "exponentialLinear"],
    [39, 1.7, 12, 2, "DOFM", 98, null, 0.0001, 12, "SF", 0.14, "exponentialLinear"],
    [40, 1.9, 15, 1.5, "DAM", 99, null, 0.0001, 15, "KO", 0.15, "exponentialLinear"],
  ].map(([number, signalPower, beta, samplingIncrease, modulation, primaryFrequency, secondaryFrequency, noiseDensity, signalNoiseRatio, reception, acceptableError, correlation]) => ({
    number, signalPower, beta, bandwidthFactor: correlationGroups[correlation].bandwidthFactor,
    signalBandwidth: beta * correlationGroups[correlation].bandwidthFactor,
    samplingIncrease, modulation, primaryFrequency, secondaryFrequency, noiseDensity,
    signalNoiseRatio, reception, acceptableError, correlationFunction: correlationGroups[correlation].latex,
  }));

  const receptionDescriptions = {
    KO: "Когерентный приём: детектор использует синхронное опорное колебание.",
    NO: "Некогерентный приём: детектор выделяет огибающую сигнала.",
    SF: "Сравнение фаз: приёмник сопоставляет фазы текущей и предыдущей посылок.",
    SP: "Сравнение полярностей: приёмник сопоставляет полярности продетектированных посылок.",
  };

  const parameterLabels = {
    signalPower: ["P<sub>g</sub>", "В²"], beta: ["β", "мс⁻¹"], signalBandwidth: ["Δf<sub>g</sub>", ""],
    samplingIncrease: ["α", ""], noiseDensity: ["N<sub>0</sub>", "мВт/Гц"], signalNoiseRatio: ["h<sup>2</sup>", ""],
    acceptableError: ["δ<sub>доп</sub><sup>2</sup>", ""],
  };

  // Вспомогательные функции
  function getStage(stageId) { return stages.find((s) => s.id === stageId) ?? stages[0]; }
  function getParameters() { return Object.fromEntries(new FormData(parametersForm)); }
  function formatNumber(value) { return Number.isFinite(value) ? String(Number(value.toFixed(10))) : ""; }
  function toLatexNumber(value) { return String(value).replace(".", "{,}"); }
  function setFormula(element, latex) { element.textContent = `\\[${latex}\\]`; }

  function createSummaryItem(label, value, unit = "") {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.innerHTML = label;
    description.textContent = `${value}${unit ? ` ${unit}` : ""}`;
    wrapper.append(term, description);
    return wrapper;
  }

  // Вспомогательные функции для SVG
  function createSVGHelpers() {
    const W = 1000, H = 360, N = SignalData.N;
    const yMin = SignalData.yMin, yMax = SignalData.yMax;
    const getY = (val) => H - ((val - yMin) / (yMax - yMin)) * H;
    const getX = (idx) => (idx / (N - 1)) * W;
    const yZero = getY(0);
    const getLocalY = (val, h, minO = yMin, maxO = yMax) => h - ((val - minO) / (maxO - minO)) * h;

    const drawCurveSVG = (data, color, lineWidth, alpha = 1) => {
      let d = `M 0 ${getY(data[0])}`;
      for (let i = 1; i < data.length; i++) d += ` L ${getX(i)} ${getY(data[i])}`;
      return `<path d="${d}" stroke="${color}" stroke-width="${lineWidth}" fill="none" stroke-opacity="${alpha}" stroke-linejoin="round" />`;
    };

    const drawStemsSVG = (indices, values, color, alpha = 1) => {
      let paths = "";
      for (let i = 0; i < indices.length; i++) paths += `M ${getX(indices[i])} ${yZero} L ${getX(indices[i])} ${getY(values[i])} `;
      return `<path d="${paths}" stroke="${color}" stroke-width="2.5" fill="none" stroke-opacity="${alpha}" />`;
    };

    const drawDimX = (x1, x2, y, label) => `
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#62716b" stroke-width="1.5" />
      <path d="M ${x1+6} ${y-4} L ${x1} ${y} L ${x1+6} ${y+4}" fill="none" stroke="#62716b" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M ${x2-6} ${y-4} L ${x2} ${y} L ${x2-6} ${y+4}" fill="none" stroke="#62716b" stroke-width="1.5" stroke-linejoin="round" />
      <text x="${(x1+x2)/2}" y="${y-8}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="middle">${label}</text>`;

    const drawDimY = (x, y1, y2, label) => {
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      return `<line x1="${x}" y1="${minY}" x2="${x}" y2="${maxY}" stroke="#62716b" stroke-width="1.5" />
        <path d="M ${x-4} ${minY+6} L ${x} ${minY} L ${x+4} ${minY+6}" fill="none" stroke="#62716b" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M ${x-4} ${maxY-6} L ${x} ${maxY} L ${x+4} ${maxY-6}" fill="none" stroke="#62716b" stroke-width="1.5" stroke-linejoin="round" />
        <text x="${x+8}" y="${(minY+maxY)/2 + 4}" fill="#62716b" font-family="monospace" font-size="14" text-anchor="start">${label}</text>`;
    };

    return { W, H, N, yMin, yMax, getY, getX, yZero, getLocalY, drawCurveSVG, drawStemsSVG, drawDimX, drawDimY };
  }

  // Обработка данных для всех этапов последовательно
  function processAllStages(params) {
    const stageIds = ["source", "tx-filter", "sampler", "quantizer", "encoder", "modulator", "channel", "detector", "decoder", "recipient"];
    for (const id of stageIds) {
      const handler = window.StageHandlers[id];
      if (handler && handler.process) {
        handler.process(params, SignalData);
      }
    }
  }

  // Рендер панели этапа
  function renderPanel(stage) {
    const params = getParameters();
    const helpers = createSVGHelpers();

    // Обрабатываем данные для всех этапов
    processAllStages(params);

    // Получаем теорию и формулы из обработчика этапа
    let theory = "", formulas = "";
    const handler = window.StageHandlers[stage.id];
    if (handler && handler.renderTheory) {
      const result = handler.renderTheory(stage, params, toLatexNumber);
      theory = result.theory || "";
      formulas = result.formulas || "";
    }

    // Получаем SVG из обработчика этапа
    let svgContent = "";
    if (handler && handler.renderSVG) {
      svgContent = handler.renderSVG(stage.id, params, helpers, SignalData);
    }

    // Формируем HTML
    let html = `<div class="stage-panel__left">`;
    html += `<div class="stage-panel__content">`;
    html += `<p class="eyebrow">Этап обработки</p><h2>${stage.title}</h2><span class="stage-panel__signal">${stage.signal}</span>`;
    if (theory) html += `<p class="stage-panel__theory">${theory}</p>`;
    html += `</div>`;
    if (formulas) {
      html += `<div class="stage-panel__content stage-panel__content--formulas">${formulas}</div>`;
    } else {
      html += `<div class="stage-panel__content"></div>`;
    }
    html += `</div>`;

    if (svgContent) {
      html += `<div class="stage-panel__visuals">${svgContent}</div>`;
    } else {
      html += `<div class="stage-panel__placeholder"><div><strong>Область будущей визуализации</strong><p>Здесь появится график изменения сигнала на выбранном этапе.</p></div></div>`;
    }

    panel.innerHTML = html;
    renderMath();
  }

  function renderMath() {
    clearTimeout(mathRenderTimeout);
    mathRenderTimeout = setTimeout(() => {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== "function") return;
      const elements = [correlationPreview, summaryCorrelationFormula, summaryBandwidthFormula].filter(Boolean);
      // Рендерим все формулы внутри панели этапа
      const panelContent = document.querySelector('.stage-panel');
      if (panelContent) {
        elements.push(panelContent);
      }
      window.MathJax.typesetClear(elements);
      window.MathJax.typesetPromise(elements).catch((err) => console.warn('MathJax error:', err));
    }, 100);
  }

  function createStageCard(stage, index) {
    const card = document.createElement("button");
    card.className = "stage-card"; card.type = "button";
    card.dataset.stageId = stage.id; card.dataset.group = stage.group;
    card.setAttribute("aria-pressed", "false");
    card.innerHTML = `<span class="stage-card__index">${String(index + 1).padStart(2, "0")}</span><strong class="stage-card__title">${stage.title}</strong><span class="stage-card__signal">${stage.signal}</span><span class="stage-card__status">Ожидает исследования</span>`;
    card.addEventListener("click", () => selectStage(stage.id));
    return card;
  }

  function renderRoute() {
    const fragment = document.createDocumentFragment();
    stages.forEach((stage, index) => { fragment.append(createStageCard(stage, index)); });
    route.replaceChildren(fragment);
  }

  function renderVariantOptions() {
    variantPreset.append(...variants.map(({ number }) => {
      const option = document.createElement("option");
      option.value = String(number); option.textContent = `Вариант ${number}`;
      return option;
    }));
  }

  function applyVariant(variantNumber) {
    const variant = variants.find(({ number }) => number === Number(variantNumber));
    if (!variant) return;
    isApplyingVariant = true;
    Object.entries(variant).forEach(([name, value]) => {
      if (name === "number" || value === null) return;
      if (parametersForm.elements[name]) parametersForm.elements[name].value = String(value);
    });
    updateConditionalFields(); updateDerivedFields();
    parametersForm.elements.reception.value = variant.reception;
    renderParametersSummary();
    // Перерендериваем текущий этап с новыми параметрами варианта
    const currentStage = getStage(currentStageId);
    renderPanel(currentStage);
    isApplyingVariant = false;
  }

  function updateDerivedFields() {
    const beta = Number(parametersForm.elements.beta.value);
    const bandwidthFactor = Number(parametersForm.elements.bandwidthFactor.value);
    parametersForm.elements.signalBandwidth.value = formatNumber(beta * bandwidthFactor);
  }

  function renderReceptionOptions(modulation) {
    const reception = parametersForm.elements.reception;
    const preferredValue = reception.value || reception.dataset.initialValue;
    const options = modulationOptions[modulation].receptions;
    reception.replaceChildren(...options.map(([value, label]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = label; return option;
    }));
    if (options.some(([value]) => value === preferredValue)) reception.value = preferredValue;
    delete reception.dataset.initialValue;
  }

  function updateConditionalFields() {
    const modulation = parametersForm.elements.modulation.value;
    const isDchm = modulation === "DCHM";
    primaryFrequencyLabel.innerHTML = modulationOptions[modulation].primaryFrequencyLabel;
    primaryFrequencyDescription.textContent = modulationOptions[modulation].primaryFrequencyDescription;
    secondaryFrequencyField.hidden = !isDchm;
    secondaryFrequencyField.querySelector("input").disabled = !isDchm;
    renderReceptionOptions(modulation);
  }

  function renderParametersSummary() {
    const values = getParameters();
    const modulation = modulationOptions[values.modulation];
    const receptionLabel = parametersForm.elements.reception.selectedOptions[0]?.textContent ?? "—";
    summaryTitle.textContent = modulation.title;
    summaryDescription.textContent = modulation.description;
    receptionDescription.textContent = receptionDescriptions[values.reception];
    summaryReceptionDescription.textContent = receptionDescriptions[values.reception];
    setFormula(correlationPreview, values.correlationFunction);
    setFormula(summaryCorrelationFormula, values.correlationFunction);
    setFormula(summaryBandwidthFormula, String.raw`\Delta f_g = ${toLatexNumber(values.bandwidthFactor)}\beta = ${toLatexNumber(values.signalBandwidth)}`);
    summary.replaceChildren(
      createSummaryItem("Режим", values.variantPreset === "custom" ? "Ручной ввод" : `Вариант ${values.variantPreset}`),
      ...Object.entries(parameterLabels).map(([key, [label, unit]]) => createSummaryItem(label, values[key], unit)),
      createSummaryItem(values.modulation === "DCHM" ? "f<sub>2</sub>" : "f<sub>0</sub>", values.primaryFrequency, "МГц"),
      ...(values.modulation === "DCHM" ? [createSummaryItem("f<sub>1</sub>", values.secondaryFrequency, "МГц")] : []),
      createSummaryItem("Приём", receptionLabel)
    );
    renderMath();
  }

  function handleParametersChange(event) {
    if (event.target.name === "variantPreset") { applyVariant(event.target.value); return; }
    if (!isApplyingVariant) variantPreset.value = "custom";
    if (event.target.name === "modulation") updateConditionalFields();
    if (["beta", "bandwidthFactor"].includes(event.target.name)) updateDerivedFields();
    renderParametersSummary();
    // Перерендериваем текущий этап с новыми параметрами
    const currentStage = getStage(currentStageId);
    renderPanel(currentStage);
  }

  function selectStage(stageId) {
    currentStageId = stageId; // Сохраняем текущий выбранный этап
    const stage = getStage(stageId);
    document.querySelectorAll(".stage-card").forEach((card) => {
      const isActive = card.dataset.stageId === stage.id;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-pressed", String(isActive));
    });
    renderPanel(stage);
  }

  function init() {
    renderVariantOptions(); updateConditionalFields(); updateDerivedFields();
    renderParametersSummary(); renderRoute(); selectStage(stages[0].id);
    year.textContent = new Date().getFullYear();
    parametersForm.addEventListener("input", handleParametersChange);
    parametersForm.addEventListener("change", handleParametersChange);
    window.addEventListener("load", renderMath);
  }

  init();
})();