// app.js - Основной файл приложения
(function() {
  'use strict';

  // Глобальный объект для обработчиков этапов (заполняется из файлов 01-10)
  window.StageHandlers = window.StageHandlers || {};

  const stages = [
    { id: "source", title: "Источник и первичный преобразователь", group: "source", signal: "c(t) → g(t)" },
    { id: "tx-filter", title: "Передающий ФНЧ", group: "tx", signal: "g(t) → x(t)" },
    { id: "sampler", title: "Дискретизатор АЦП", group: "tx", signal: "x(t) → x(kΔt)" },
    { id: "quantizer", title: "Квантователь АЦП", group: "tx", signal: "x(kΔt) → vₖʲ" },
    { id: "encoder", title: "Кодер АЦП", group: "tx", signal: "vₖʲ → bₖ<sup>μ</sup>" },
    { id: "modulator", title: "Модулятор и выход ПДУ", group: "tx", signal: "bₖ<sup>μ</sup> + u<sub>н</sub>(t) → s(t,bₖ<sup>μ</sup>) → S(t)" },
    { id: "channel", title: "Непрерывный канал связи", group: "channel", signal: "S(t) → z(t)=χS(t)+n(t) (χ=1)" },
    { id: "detector", title: "Вход ПРУ, детектор и РУ", group: "rx", signal: "z(t) → b̂ₖ<sup>μ</sup>" },
    { id: "decoder", title: "Декодер и интерполятор ЦАП", group: "rx", signal: "b̂ₖ<sup>μ</sup> → x̂(t)" },
    { id: "recipient", title: "Приёмный ФНЧ и получатель", group: "rx", signal: "x̂(t) → ĝ(t) → ĉ(t)" },
  ];

  const stageGuides = {
    source: {
      input: "исходное сообщение c(t)",
      action: "превращаем сообщение в электрический случайный процесс g(t)",
      output: "первичный сигнал g(t)",
      points: [
        "Сначала смотри временную реализацию: это один возможный вид сообщения.",
        "Затем связывай её с Bc(τ): корреляция показывает, как быстро сигнал забывает прошлые значения.",
        "После этого переходи к Gg(f): спектр объясняет, какую полосу должен пропустить тракт.",
      ],
    },
    "tx-filter": {
      input: "первичный сигнал g(t)",
      action: "идеальный ФНЧ оставляет полезную полосу и срезает спектральный хвост",
      output: "ограниченный по спектру сигнал x(t)",
      points: [
        "Во времени фильтр выглядит как сглаживание резких изменений.",
        "В частотной области видно главное: всё за пределами Δfg превращается в ошибку фильтрации.",
      ],
    },
    sampler: {
      input: "непрерывный сигнал x(t)",
      action: "берём отсчёты через Δt по теореме Котельникова",
      output: "последовательность x(k·Δt)",
      points: [
        "Чем больше α, тем плотнее стоят отсчёты.",
        "Этот же шаг Δt дальше задаёт длительность ступеней ЦАП, поэтому дискретизация связывает начало и конец тракта.",
      ],
    },
    quantizer: {
      input: "отсчёты x(k·Δt)",
      action: "заменяем каждый отсчёт ближайшим разрешённым уровнем",
      output: "уровни квантования vₖʲ",
      points: [
        "Первый график показывает потерю точности на каждом отсчёте.",
        "Лесенка квантователя объясняет правило замены амплитуды уровнем.",
        "Гистограмма показывает, какие уровни чаще появляются у гауссовского сигнала.",
      ],
    },
    encoder: {
      input: "уровни vₖʲ",
      action: "каждый уровень заменяется μ-битной кодовой комбинацией рассчитанной разрядности",
      output: "цифровой поток bₖ<sup>μ</sup>",
      points: [
        "Сначала сопоставь уровень и кодовое слово.",
        "Потом смотри меандр b(t): именно он управляет радиомодулятором.",
        "Синхронная лупа дальше повторяется в модуляторе, канале и детекторе.",
      ],
    },
    modulator: {
      input: "цифровой поток bₖ<sup>μ</sup> и несущая u<sub>н</sub>(t)",
      action: "код управляет одним свойством несущей",
      output: "радиосигнал S(t)",
      points: [
        "В ДАМ меняется амплитуда: бит 0 гасит или ослабляет посылку, бит 1 включает её.",
        "В ДЧМ меняется частота: разные биты передаются разными несущими f1 и f2.",
        "В ДОФМ меняется относительная фаза: смысл несёт скачок фазы между соседними посылками.",
      ],
    },
    channel: {
      input: "передаваемый сигнал S(t)",
      action: "к сигналу добавляется аддитивный гауссовский шум",
      output: "принятая смесь z(t)",
      points: [
        "Сравни три раскрываемых фрагмента сверху вниз: чистый сигнал, отдельный шум, сумма на входе приёмника.",
        "N0 меняет мощность шума, а h² задаёт требуемую мощность сигнала для выбранной полосы.",
      ],
    },
    detector: {
      input: "смесь z(t)",
      action: "приёмник выбирает бит по правилу, зависящему от модуляции и способа приёма",
      output: "оценка битов b̂ₖ<sup>μ</sup>",
      points: [
        "Для ДАМ важен порог амплитуды.",
        "Для ДЧМ сравнивается энергия в двух частотных ветках.",
        "Для ДОФМ решение связано с фазой или полярностью соседних посылок.",
      ],
    },
    decoder: {
      input: "принятые биты b̂ₖ<sup>μ</sup>",
      action: "кодовые слова снова переводятся в амплитудные уровни",
      output: "восстановленные уровни x̂(t)",
      points: [
        "Если бит ошибся, кодовое слово может попасть в другой уровень.",
        "Красная область показывает уже не радиошум, а шум передачи после декодирования.",
      ],
    },
    recipient: {
      input: "ступенчатый сигнал x̂(t)",
      action: "интерполяция и приёмный ФНЧ сглаживают уровни",
      output: "оценка исходного сообщения ĉ(t)",
      points: [
        "Сравни исходную кривую и восстановленную: это итог всей цепочки.",
        "Финальная δ²Σ собирает три причины потерь: фильтрацию, квантование и ошибки передачи.",
      ],
    },
  };

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
  let lastChangedParam = null; // Последний изменённый параметр для подсветки зависимостей

  // Используем SignalData из data.js (глобальный объект window.SignalData)
  const SignalData = window.SignalData;

  const modulationOptions = {
    DAM: { title: "ДАМ · дискретная амплитудная модуляция", description: "Двоичный код управляет амплитудой гармонической несущей.", primaryFrequencyLabel: "f<sub>0</sub>", primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DCHM: { title: "ДЧМ · дискретная частотная модуляция", description: "Двоичный код переключает несущую между частотами f₁ и f₂.", primaryFrequencyLabel: "f<sub>2</sub>", primaryFrequencyDescription: "Нижняя несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DOFM: { title: "ДОФМ · дискретная относительная фазовая модуляция", description: "Двоичный код управляет относительным изменением фазы несущей.", primaryFrequencyLabel: "f<sub>0</sub>", primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["SF", "СФ · сравнение фаз"], ["SP", "СП · сравнение полярностей"]] },
  };

  // === Единое описание сигналов структурной схемы методички ===
  // Используется только для одинаковых обозначений, кратких названий
  // и классификации. Расчёты и массивы остаются в SignalData.
  const SIGNAL_META = {
    c:         { symbol: "c(t)",          name: "Сообщение источника",                       type: "Непрерывное сообщение" },
    g:         { symbol: "g(t)",          name: "Первичный электрический сигнал сообщения",  type: "Непрерывный случайный сигнал" },
    x:         { symbol: "x(t)",          name: "Сигнал сообщения с ограниченным спектром",  type: "Непрерывный по времени и уровню" },
    sampled:   { symbol: "x(kΔt)",        name: "Дискретизированный сигнал сообщения",       type: "Дискретный по времени, непрерывный по уровню" },
    quantized: { symbol: "vₖʲ",           name: "Квантованное значение сигнала",             type: "Дискретный по времени и уровню" },
    encoded:   { symbol: "bₖ<sup>μ</sup>", name: "μ-разрядная кодовая комбинация",           type: "Цифровой сигнал" },
    carrier:   { symbol: "u<sub>н</sub>(t)", name: "Несущее гармоническое колебание",         type: "Непрерывное периодическое колебание" },
    modulated: { symbol: "s(t,bₖ<sup>μ</sup>)", name: "Несущее колебание, модулированное сообщением", type: "Непрерывный физический сигнал" },
    transmitted:{ symbol: "S(t)",         name: "Сигнал, передаваемый по линии связи",       type: "Непрерывный физический сигнал" },
    noise:     { symbol: "n(t)",          name: "Помеха в линии связи",                      type: "Непрерывный случайный процесс" },
    received:  { symbol: "z(t)",          name: "Сигнал на входе приёмника",                 type: "Непрерывный случайный сигнал" },
    detected:  { symbol: "ŝ(t,bₖ<sup>μ</sup>)", name: "Принятый модулированный сигнал на выходе входного устройства ПРУ", type: "Непрерывный сигнал" },
    b_hat:     { symbol: "b̂ₖ<sup>μ</sup>", name: "Принятая кодовая комбинация",              type: "Цифровой сигнал" },
    v_hat:     { symbol: "v̂ₖʲ",          name: "Восстановленный квантованный уровень",      type: "Дискретный по времени и уровню" },
    x_hat:     { symbol: "x̂(t)",          name: "Восстановленный сигнал после интерполяции", type: "Непрерывный по времени, дискретный по уровню" },
    g_hat:     { symbol: "ĝ(t)",          name: "Восстановленный электрический сигнал сообщения", type: "Непрерывный по времени и уровню" },
    c_hat:     { symbol: "ĉ(t)",          name: "Принятое сообщение после выходного преобразователя", type: "Непрерывное сообщение" },
  };

  // === Граф зависимостей параметров (только для подсветки и пояснения) ===
  // Не выполняет расчёты — они остаются в этапах и calculations.js.
  // Ключ — имя параметра, значение — массив непосредственно зависимых параметров.
  const DEPENDENCIES = {
    // Цепочка 1: Источник и спектр
    Pg:          ["sigmaG", "Dg", "deltaU1"],
    beta:        ["signalBandwidth", "filterError"],
    signalBandwidth: ["filterError", "samplingFrequency"],
    // Цепочка 2: Дискретизация
    samplingIncrease: ["samplingFrequency", "eta", "samplingInterval"],
    samplingFrequency: ["samplingInterval"],
    samplingInterval: ["bitDuration"],
    // Цепочка 3: Квантование и кодирование
    eta:         ["conditionalStep", "mu"],
    conditionalStep: ["mu"],
    mu:          ["levelCount", "bitDuration", "digitalBandwidth", "quantizationNoise"],
    bitDuration: ["digitalBandwidth"],
    digitalBandwidth: ["modulatedBandwidth"],
    // Цепочка 4: Модуляция и канал
    modulatedBandwidth: ["noisePower", "channelCapacity", "signalPower", "Um"],
    noiseDensity: ["noisePower"],
    signalNoiseRatio: ["signalPower", "errorProbability"],
    // Цепочка 5: Помехоустойчивость и восстановление
    errorProbability: ["transmissionNoise"],
    transmissionNoise: ["totalError"],
    filterError:   ["totalError"],
    quantizationNoise: ["totalError"],
    totalError:    [],
  };

  // Метаданные этапов: сигналы, зависимости, мини-тракты
  const STAGE_META = {
    source: {
      inputSignals: ["c"], outputSignals: ["g"],
      dependsOn: ["Pg", "beta"], affects: ["sigmaG", "dfg"],
      signalChange: "Сообщение превращается в электрический случайный процесс. Форма сохраняет информацию, но физическая природа меняется.",
    },
    "tx-filter": {
      inputSignals: ["g"], outputSignals: ["x"],
      dependsOn: ["beta", "signalBandwidth"], affects: ["filterError"],
      signalChange: "Форма сигнала сохраняется, но высокочастотные составляющие спектра за пределами Δfg подавляются.",
    },
    sampler: {
      inputSignals: ["x"], outputSignals: ["sampled"],
      dependsOn: ["signalBandwidth", "samplingIncrease"], affects: ["samplingFrequency", "samplingInterval"],
      signalChange: "Непрерывный сигнал превращается в последовательность отсчётов. Информация сохраняется при выполнении теоремы Котельникова.",
    },
    quantizer: {
      inputSignals: ["sampled"], outputSignals: ["quantized"],
      dependsOn: ["Pg", "eta"], affects: ["mu", "levelCount", "quantizationNoise"],
      signalChange: "Отсчёты с произвольными значениями амплитуды заменяются ближайшими разрешёнными уровнями.",
    },
    encoder: {
      inputSignals: ["quantized"], outputSignals: ["encoded"],
      dependsOn: ["mu"], affects: ["bitDuration", "digitalBandwidth"],
      signalChange: "Номер уровня превращается в μ-битное двоичное слово. Сигнал становится цифровым.",
    },
    modulator: {
      inputSignals: ["encoded", "carrier"], outputSignals: ["modulated", "transmitted"],
      dependsOn: ["digitalBandwidth", "signalNoiseRatio"], affects: ["modulatedBandwidth", "Um"],
      signalChange: "Цифровой код управляет одним из параметров несущей. Форма зависит от вида модуляции.",
      miniTract: [
        { node: "bₖ<sup>μ</sup>", label: "Модулятор", out: "s(t,bₖ<sup>μ</sup>)" },
        { node: null, label: "Выход ПДУ", out: "S(t)" },
      ],
      extraInput: "u<sub>н</sub>(t)",
    },
    channel: {
      inputSignals: ["transmitted"], outputSignals: ["received"],
      dependsOn: ["modulatedBandwidth", "noiseDensity"], affects: ["noisePower", "signalPower"],
      signalChange: "Сигнал проходит через линию связи и смешивается с аддитивным гауссовским шумом. В расчётах принято χ=1.",
      miniTract: [
        { node: "S(t)", label: "Ослабление χ", out: "χS(t)" },
        { node: null, label: "+ n(t)", out: "z(t)" },
      ],
      extraInput: "n(t)",
    },
    detector: {
      inputSignals: ["received"], outputSignals: ["b_hat"],
      dependsOn: ["signalPower", "noisePower", "signalNoiseRatio"], affects: ["errorProbability"],
      signalChange: "Детектор формирует отклик, из которого решающее устройство восстанавливает биты.",
      miniTract: [
        { node: "z(t)", label: "Вход ПРУ", out: "ŝ(t,bₖ<sup>μ</sup>)" },
        { node: null, label: "Детектор → РУ", out: "b̂ₖ<sup>μ</sup>" },
      ],
    },
    decoder: {
      inputSignals: ["b_hat"], outputSignals: ["v_hat", "x_hat"],
      dependsOn: ["mu", "errorProbability"], affects: ["transmissionNoise"],
      signalChange: "Кодовые слова переводятся обратно в уровни, затем интерполятор формирует ступенчатый сигнал.",
      miniTract: [
        { node: "b̂ₖ<sup>μ</sup>", label: "Декодер", out: "v̂ₖʲ" },
        { node: null, label: "Интерполятор", out: "x̂(t)" },
      ],
    },
    recipient: {
      inputSignals: ["x_hat"], outputSignals: ["g_hat", "c_hat"],
      dependsOn: ["filterError", "quantizationNoise", "transmissionNoise"], affects: ["totalError"],
      signalChange: "Ступенчатый сигнал сглаживается приёмным ФНЧ, образуя непрерывную оценку сообщения.",
      miniTract: [
        { node: "x̂(t)", label: "Приёмный ФНЧ", out: "ĝ(t)" },
        { node: null, label: "Выходной преобразователь", out: "ĉ(t)" },
      ],
    },
  };

  // Описание изменения параметров для подсветки (краткие физические пояснения)
  const PARAM_CHANGE_NOTES = {
    Pg: "Изменение мощности сигнала пересчитывает σg, динамический диапазон и шаг квантования.",
    beta: "Изменение β меняет ширину спектра Δfg, что влияет на ошибку фильтрации и частоту дискретизации.",
    signalBandwidth: "Полоса сигнала определяет ошибку фильтрации и частоту дискретизации.",
    samplingIncrease: "Изменение α меняет частоту дискретизации, интервал Δt, поправку η и разрядность μ.",
    signalNoiseRatio: "Изменение h² пересчитывает мощность сигнала, амплитуду и вероятность ошибки.",
    noiseDensity: "Изменение N0 меняет мощность шума в полосе канала.",
    mu: "Разрядность определяет число уровней, длительность символа и ширину цифрового спектра.",
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
    // N0 — из таблицы методички (мВт·с = мВт/Гц). Корреляционные функции — из последнего столбца таблицы.
    // Варианты 1–5: Pg·e^(-β|τ|), Δfg = 2β → exponential
    [1, 1.0, 13, 1.5, "DAM", 60, null, 0.0001, 14.5, "KO", 0.1, "exponential"],
    [2, 1.5, 14, 2.0, "DCHM", 61, 62.5, 0.001, 8.5, "NO", 0.12, "exponential"],
    [3, 2.0, 15, 2.5, "DOFM", 62, null, 0.0028, 4.3, "SF", 0.14, "exponential"],
    [4, 2.5, 16, 3.0, "DAM", 63, null, 0.0002, 15.0, "NO", 0.16, "exponential"],
    [5, 3.0, 17, 3.5, "DCHM", 64, 65.5, 0.0011, 9.0, "KO", 0.18, "exponential"],
    // Варианты 6–12: Pg·cos²(πβτ), Δfg = 1.5β → cosineSquared
    [6, 3.5, 18, 3.5, "DOFM", 65, null, 0.0029, 5.2, "SP", 0.2, "cosineSquared"],
    [7, 1.2, 29, 3.0, "DAM", 66, null, 0.0003, 15.5, "KO", 0.09, "cosineSquared"],
    [8, 2.7, 30, 2.5, "DCHM", 67, 68.8, 0.0012, 9.5, "NO", 0.11, "cosineSquared"],
    [9, 2.2, 31, 2.0, "DOFM", 68, null, 0.003, 4.6, "SF", 0.13, "cosineSquared"],
    [10, 2.7, 32, 1.5, "DAM", 69, null, 0.0004, 16.0, "NO", 0.15, "cosineSquared"],
    [11, 3.2, 33, 1.5, "DCHM", 70, 71.5, 0.0013, 10.0, "KO", 0.17, "cosineSquared"],
    [12, 3.7, 34, 2.0, "DOFM", 71, null, 0.0004, 4.9, "SP", 0.19, "cosineSquared"],
    // Варианты 13–17: Pg·e^(-0.5β²τ²), Δfg = β → gaussian
    [13, 1.4, 17, 2.5, "DAM", 72, null, 0.0005, 16.5, "KO", 0.1, "gaussian"],
    [14, 1.9, 18, 3.0, "DCHM", 73, 74.5, 0.0014, 10.5, "NO", 0.12, "gaussian"],
    [15, 2.4, 19, 3.5, "DOFM", 74, null, 0.0032, 5.5, "SF", 0.14, "gaussian"],
    [16, 2.9, 20, 3.5, "DAM", 75, null, 0.0006, 17.0, "NO", 0.16, "gaussian"],
    [17, 3.4, 21, 3.0, "DCHM", 76, 77.5, 0.0015, 11.0, "KO", 0.18, "gaussian"],
    // Варианты 18–20: Pg·sin(2πβτ)/(2πβτ), Δfg = β → sinc
    [18, 3.9, 22, 2.5, "DOFM", 77, null, 0.0006, 5.8, "SP", 0.2, "sinc"],
    [19, 4.0, 5, 2.0, "DAM", 78, null, 0.0001, 17.5, "KO", 0.09, "sinc"],
    [20, 4.2, 6, 1.5, "DCHM", 79, 80.5, 0.0007, 11.5, "NO", 0.11, "sinc"],
    // Варианты 21–25: [Pg·sin(2πβτ)/(2πβτ)]², Δfg = β → sincSquared
    [21, 4.4, 7, 1.5, "DOFM", 80, null, 0.0022, 6.1, "SF", 0.13, "sincSquared"],
    [22, 4.6, 8, 2.0, "DAM", 81, null, 0.0008, 18.0, "NO", 0.15, "sincSquared"],
    [23, 4.8, 9, 2.5, "DCHM", 82, 83.5, 0.0017, 12.0, "KO", 0.17, "sincSquared"],
    [24, 5.0, 10, 3.0, "DOFM", 83, null, 0.0023, 6.4, "SP", 0.19, "sincSquared"],
    [25, 3.8, 13, 3.5, "DAM", 84, null, 0.0009, 18.5, "KO", 0.1, "sincSquared"],
    // Варианты 26–30: Pg·cos(2πβτ)/(1-(4βτ)²), Δfg = 4β → cosineRatio
    [26, 3.3, 14, 3.5, "DCHM", 85, 86.5, 0.0018, 12.5, "NO", 0.12, "cosineRatio"],
    [27, 2.8, 15, 3.0, "DOFM", 86, null, 0.0024, 6.7, "SF", 0.14, "cosineRatio"],
    [28, 2.3, 16, 2.5, "DAM", 87, null, 0.0004, 19.0, "NO", 0.16, "cosineRatio"],
    [29, 1.8, 17, 2.0, "DCHM", 88, 89.5, 0.0019, 13.0, "KO", 0.18, "cosineRatio"],
    [30, 1.3, 18, 1.5, "DOFM", 89, null, 0.0025, 7.0, "SP", 0.2, "cosineRatio"],
    // Варианты 31–35: Pg·cos(2πβτ), |τ| ≤ 1/(4β), Δfg = 3β → cosineLimited
    [31, 3.6, 7, 1.5, "DAM", 90, null, 0.0005, 19.5, "KO", 0.09, "cosineLimited"],
    [32, 3.1, 8, 2.0, "DCHM", 91, 92.5, 0.002, 13.5, "NO", 0.11, "cosineLimited"],
    [33, 2.6, 9, 2.5, "DOFM", 92, null, 0.0026, 7.3, "SF", 0.13, "cosineLimited"],
    [34, 2.1, 10, 3.0, "DAM", 93, null, 0.0006, 20.0, "NO", 0.15, "cosineLimited"],
    [35, 1.6, 11, 3.5, "DCHM", 94, 95.5, 0.0021, 14.0, "KO", 0.17, "cosineLimited"],
    // Варианты 36–40: Pg·(1-β|τ|)·e^(-β|τ|), Δfg = 2β → exponentialLinear
    [36, 1.1, 12, 3.5, "DOFM", 95, null, 0.0027, 7.6, "SP", 0.19, "exponentialLinear"],
    [37, 1.2, 6, 3.0, "DAM", 96, null, 0.0009, 8.0, "NO", 0.12, "exponentialLinear"],
    [38, 1.5, 9, 2.5, "DCHM", 97, 98.5, 0.0011, 10.0, "KO", 0.13, "exponentialLinear"],
    [39, 1.7, 12, 2.0, "DOFM", 98, null, 0.0015, 12.0, "SF", 0.14, "exponentialLinear"],
    [40, 1.9, 15, 1.5, "DAM", 99, null, 0.0018, 15.0, "KO", 0.15, "exponentialLinear"],
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

  const stageControlMeta = {
    signalPower: { label: "P_g", min: 0.1, max: 6, step: 0.1, unit: "В²" },
    beta: { label: "β", min: 1, max: 40, step: 0.1, unit: "мс⁻¹" },
    bandwidthFactor: { label: "k", min: 0.5, max: 5, step: 0.1, unit: "" },
    samplingIncrease: { label: "α", min: 1, max: 5, step: 0.1, unit: "" },
    primaryFrequency: { label: "f0/f2", min: 40, max: 120, step: 0.1, unit: "МГц" },
    secondaryFrequency: { label: "f1", min: 40, max: 130, step: 0.1, unit: "МГц" },
    noiseDensity: { label: "N0", min: 0.00001, max: 0.001, step: 0.00001, unit: "" },
    signalNoiseRatio: { label: "h²", min: 1, max: 25, step: 0.1, unit: "" },
    acceptableError: { label: "δ²доп", min: 0.01, max: 1, step: 0.01, unit: "" },
  };

  const stageControlMap = {
    source: ["signalPower", "beta", "bandwidthFactor"],
    "tx-filter": ["beta", "bandwidthFactor"],
    sampler: ["samplingIncrease", "beta", "bandwidthFactor"],
    quantizer: ["signalPower", "samplingIncrease"],
    encoder: ["samplingIncrease"],
    modulator: ["primaryFrequency", "secondaryFrequency", "signalNoiseRatio", "noiseDensity"],
    channel: ["noiseDensity", "signalNoiseRatio"],
    detector: ["signalNoiseRatio"],
    decoder: ["signalNoiseRatio"],
    recipient: ["acceptableError", "signalPower"],
  };

  // Вспомогательные функции
  function getStage(stageId) { return stages.find((s) => s.id === stageId) ?? stages[0]; }
  function getParameters() { return Object.fromEntries(new FormData(parametersForm)); }
  function formatNumber(value) { return Number.isFinite(value) ? String(Number(value.toFixed(10))) : ""; }
  function toLatexNumber(value) { return String(value).replace(".", "{,}"); }
  function setFormula(element, latex) { element.textContent = `\\[${latex}\\]`; }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function getModulationLearningNote(params) {
    const notes = {
      DAM: "Сейчас выбран ДАМ: форма должна менять амплитуду несущей, а приёмник работает по амплитудному правилу.",
      DCHM: "Сейчас выбран ДЧМ: форма использует две частоты f2 и f1, а приёмник сравнивает частотные ветви.",
      DOFM: "Сейчас выбран ДОФМ: форма использует одну несущую f0, а информация переносится относительным изменением фазы.",
    };
    return notes[params.modulation] || "";
  }

  // === Рендер мини-тракта для объединённых карточек ===
  function renderMiniTract(stageId) {
    const meta = STAGE_META[stageId];
    if (!meta || !meta.miniTract) return "";
    const tract = meta.miniTract;
    let html = `<div class="mini-tract">`;
    // Входной сигнал
    const firstNode = tract[0];
    html += `<span class="mini-tract__signal">${firstNode.node}</span>`;
    for (let i = 0; i < tract.length; i++) {
      const step = tract[i];
      html += `<span class="mini-tract__arrow">→</span>`;
      html += `<span class="mini-tract__box">${escapeHtml(step.label)}</span>`;
      html += `<span class="mini-tract__arrow">→</span>`;
      html += `<span class="mini-tract__signal">${step.out}</span>`;
    }
    if (meta.extraInput) {
      html += `<span class="mini-tract__extra">↓ ${meta.extraInput}</span>`;
    }
    html += `</div>`;
    return html;
  }

  // === Рендер блока «Вход → Преобразование → Выход» с классификацией сигналов ===
  function renderSignalFlowBlock(stageId) {
    const meta = STAGE_META[stageId];
    if (!meta) return "";
    const inputs = meta.inputSignals.map((key) => SIGNAL_META[key]).filter(Boolean);
    const outputs = meta.outputSignals.map((key) => SIGNAL_META[key]).filter(Boolean);
    const inputSymbols = inputs.map((s) => s.symbol).join(", ");
    const outputSymbols = outputs.map((s) => s.symbol).join(", ");
    const inputTypes = inputs.map((s) => s.type).join("; ");
    const outputTypes = outputs.map((s) => s.type).join("; ");
    let html = `<div class="signal-flow-block">`;
    html += `<div class="signal-flow-row">`;
    html += `<div class="signal-flow-cell"><span>Вход</span><strong>${inputSymbols}</strong></div>`;
    html += `<div class="signal-flow-arrow">→</div>`;
    html += `<div class="signal-flow-cell"><span>Выход</span><strong>${outputSymbols}</strong></div>`;
    html += `</div>`;
    html += `<div class="signal-flow-types"><span><em>Вход:</em> ${escapeHtml(inputTypes)}</span><span><em>Выход:</em> ${escapeHtml(outputTypes)}</span></div>`;
    html += `</div>`;
    return html;
  }

  // === Рендер блока «Зависит от / Влияет на» ===
  function renderDependenciesBlock(stageId) {
    const meta = STAGE_META[stageId];
    if (!meta) return "";
    const dependsOn = meta.dependsOn || [];
    const affects = meta.affects || [];
    if (!dependsOn.length && !affects.length) return "";
    const paramLabels = {
      Pg: "P<sub>g</sub>", beta: "β", signalBandwidth: "Δf<sub>g</sub>",
      samplingIncrease: "α", eta: "η", sigmaG: "σ<sub>g</sub>", dfg: "Δf<sub>g</sub>",
      filterError: "ξ<sub>ф</sub>²", samplingFrequency: "f<sub>д</sub>",
      samplingInterval: "Δt", conditionalStep: "Δu<sub>усл</sub>",
      mu: "μ", levelCount: "L", bitDuration: "τ<sub>сим</sub>",
      digitalBandwidth: "Δf<sub>ц</sub>", quantizationNoise: "ξ<sub>кв</sub>²",
      modulatedBandwidth: "Δf<sub>s</sub>", noisePower: "P<sub>ш</sub>",
      signalPower: "P<sub>s</sub>", Um: "U<sub>m</sub>",
      errorProbability: "p<sub>ош</sub>", transmissionNoise: "ξ<sub>п</sub>²",
      totalError: "δ<sub>Σ</sub>²", channelCapacity: "C",
      noiseDensity: "N<sub>0</sub>", signalNoiseRatio: "h²",
      Dg: "D<sub>g</sub>", deltaU1: "Δu<sub>1</sub>",
    };
    const formatParam = (p) => paramLabels[p] || escapeHtml(p);
    let html = `<div class="dependencies-block">`;
    if (dependsOn.length) {
      html += `<div class="dependencies-row"><span class="dependencies-label">Зависит от:</span><span class="dependencies-values">${dependsOn.map(formatParam).join(", ")}</span></div>`;
    }
    if (affects.length) {
      html += `<div class="dependencies-row"><span class="dependencies-label">Влияет на:</span><span class="dependencies-values">${affects.map(formatParam).join(", ")}</span></div>`;
    }
    html += `</div>`;
    return html;
  }

  // === Рендер краткого объяснения изменения параметра ===
  function renderChangeNote(changedParam) {
    const note = PARAM_CHANGE_NOTES[changedParam];
    if (!note) return "";
    return `<div class="change-note">${escapeHtml(note)}</div>`;
  }

  function renderLearningGuide(stage, params) {
    const guide = stageGuides[stage.id];
    if (!guide) return "";
    const modulationNote = ["modulator", "detector"].includes(stage.id) ? getModulationLearningNote(params) : "";
    return `<div class="stage-panel__content stage-panel__guide" data-group="${stage.group}">
      <p class="stage-panel__action"><strong>Что изменилось:</strong> ${escapeHtml(guide.action)}</p>
      ${modulationNote ? `<p class="stage-panel__guide-note">${escapeHtml(modulationNote)}</p>` : ""}
    </div>`;
  }

  function createSummaryItem(label, value, unit = "") {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.innerHTML = label;
    description.textContent = `${value}${unit ? ` ${unit}` : ""}`;
    wrapper.append(term, description);
    return wrapper;
  }

  function getStageControlNames(stageId, values) {
    const names = stageControlMap[stageId] || [];
    return names.filter((name) => name !== "secondaryFrequency" || values.modulation === "DCHM");
  }

  function renderStageControls(stageId, values) {
    const names = getStageControlNames(stageId, values);
    if (!names.length) return "";

    const controls = names.map((name) => {
      const meta = stageControlMeta[name];
      const value = Number(values[name] || 0);
      const displayValue = Number.isFinite(value) ? value : 0;
      return `<label class="stage-control">
        <span>${meta.label}${meta.unit ? ` <em>${meta.unit}</em>` : ""}</span>
        <input type="range" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${displayValue}" data-stage-param="${name}">
        <input type="number" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${displayValue}" data-stage-param="${name}">
      </label>`;
    }).join("");

    return `<div class="stage-panel__content stage-panel__controls">
      <p class="eyebrow">Живые параметры этапа</p>
      <div class="stage-controls-grid">${controls}</div>
    </div>`;
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

  function getParamsSignature(params) {
    return JSON.stringify(Object.keys(params).sort().map((key) => [key, params[key]]));
  }

  // Обработка данных для всех этапов последовательно
  function processAllStages(params) {
    const paramsSignature = getParamsSignature(params);
    if (SignalData.lastParamsString === paramsSignature && SignalData.g_hat_t) return;

    SignalData.calculation = window.SystemCalculations.calculate(params);
    const stageIds = ["source", "tx-filter", "sampler", "quantizer", "encoder", "modulator", "channel", "detector", "decoder", "recipient"];
    for (const id of stageIds) {
      const handler = window.StageHandlers[id];
      if (handler && handler.process) {
        handler.process(params, SignalData);
      }
    }
    SignalData.lastParamsString = paramsSignature;
  }

  // Рендер панели этапа
  function renderPanel(stage) {
    const params = getParameters();

    // Обрабатываем данные для всех этапов
    processAllStages(params);
    const helpers = createSVGHelpers();

    // Получаем теорию и формулы из обработчика этапа
    let theory = "", formulas = "";
    const handler = window.StageHandlers[stage.id];
    if (handler && handler.renderTheory) {
      const result = handler.renderTheory(stage, params, toLatexNumber, SignalData);
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
    // Мини-тракт для объединённых карточек
    const miniTractHtml = renderMiniTract(stage.id);
    if (miniTractHtml) html += miniTractHtml;
    html += `</div>`;
    // Блок «Вход → Выход» с классификацией сигналов
    const signalFlowHtml = renderSignalFlowBlock(stage.id);
    if (signalFlowHtml) html += `<div class="stage-panel__content">${signalFlowHtml}</div>`;
    html += renderLearningGuide(stage, params);
    html += renderStageControls(stage.id, params);
    // Блок зависимостей
    const depsHtml = renderDependenciesBlock(stage.id);
    if (depsHtml) html += `<div class="stage-panel__content">${depsHtml}</div>`;
    // Объяснение последнего изменения параметра (если есть)
    if (lastChangedParam) {
      const changeNoteHtml = renderChangeNote(lastChangedParam);
      if (changeNoteHtml) html += `<div class="stage-panel__content">${changeNoteHtml}</div>`;
    }
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
    enhanceVisualLayers();
    renderMath();
  }

  function enhanceVisualLayers() {
    const layers = panel.querySelectorAll(".stage-panel__visuals-layer");
    layers.forEach((layer, index) => {
      if (layer.closest(".visual-step")) return;
      const header = layer.querySelector(".stage-panel__visuals-header");
      const title = header?.textContent.trim() || `Фрагмент ${index + 1}`;
      if (header) header.remove();

      const details = document.createElement("details");
      details.className = "visual-step";
      details.open = true;

      const summary = document.createElement("summary");
      summary.className = "visual-step__summary";
      summary.innerHTML = `<span>Шаг ${index + 1}</span><strong>${escapeHtml(title)}</strong>`;

      const body = document.createElement("div");
      body.className = "visual-step__body";
      while (layer.firstChild) body.append(layer.firstChild);

      details.append(summary, body);
      layer.append(details);
    });
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
    card.innerHTML = `<span class="stage-card__index">${String(index + 1).padStart(2, "0")}</span><strong class="stage-card__title">${stage.title}</strong><span class="stage-card__signal">${stage.signal}</span>`;
    card.addEventListener("click", () => selectStage(stage.id));
    return card;
  }

  function renderRoute() {
    const groupTitles = {
      source: "Источник",
      tx: "Передача и АЦП",
      channel: "Канал связи",
      rx: "Приём и ЦАП",
    };
    const fragment = document.createDocumentFragment();
    Object.entries(groupTitles).forEach(([group, title]) => {
      const groupStages = stages.filter((stage) => stage.group === group);
      if (!groupStages.length) return;
      const wrapper = document.createElement("section");
      wrapper.className = "signal-route__group";
      wrapper.dataset.group = group;
      wrapper.innerHTML = `<h3><span></span>${title}</h3>`;
      groupStages.forEach((stage) => {
        const index = stages.indexOf(stage);
        wrapper.append(createStageCard(stage, index));
      });
      fragment.append(wrapper);
    });
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
    // Запоминаем изменённый параметр для подсветки зависимостей
    if (!isApplyingVariant && event.target.name) {
      lastChangedParam = event.target.name;
    }
    renderParametersSummary();
    // Перерендериваем текущий этап с новыми параметрами
    const currentStage = getStage(currentStageId);
    renderPanel(currentStage);
  }

  function applyParameterValue(name, value) {
    if (!parametersForm.elements[name]) return;
    parametersForm.elements[name].value = value;
    if (!isApplyingVariant) variantPreset.value = "custom";
    if (name === "modulation") updateConditionalFields();
    if (["beta", "bandwidthFactor"].includes(name)) updateDerivedFields();
    if (!isApplyingVariant) lastChangedParam = name;
    renderParametersSummary();
    renderPanel(getStage(currentStageId));
  }

  function handleStageControlChange(event) {
    const name = event.target.dataset.stageParam;
    if (!name) return;
    applyParameterValue(name, event.target.value);
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
    panel.addEventListener("input", handleStageControlChange);
    panel.addEventListener("change", handleStageControlChange);
    window.addEventListener("load", renderMath);
  }

  init();
})();
