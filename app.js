// app.js - Основной файл приложения
(function() {
  'use strict';

  // Глобальный объект для обработчиков этапов (заполняется из файлов 01-10)
  window.StageHandlers = window.StageHandlers || {};

  function formula(latex) {
    const value = String(latex).trim();
    const math = value.startsWith("\\(") || value.startsWith("\\[") ? value : `\\(${value}\\)`;
    return `<span class="formula-inline">${math}</span>`;
  }

  const stages = [
    { id: "source", title: "Источник и первичный преобразователь", group: "source", signal: `${formula(String.raw`c(t)`)} → ${formula(String.raw`g(t)`)}` },
    { id: "tx-filter", title: "ФНЧ передающего устройства", group: "tx", signal: `${formula(String.raw`g(t)`)} → ${formula(String.raw`x(t)`)}` },
    { id: "sampler", title: "Дискретизатор АЦП", group: "tx", signal: `${formula(String.raw`x(t)`)} → ${formula(String.raw`x(k\Delta t)`)}` },
    { id: "quantizer", title: "Квантователь АЦП", group: "tx", signal: `${formula(String.raw`x(k\Delta t)`)} → ${formula(String.raw`v_k^j`)}` },
    { id: "encoder", title: "Кодер АЦП", group: "tx", signal: `${formula(String.raw`v_k^j`)} → ${formula(String.raw`b_k^\mu`)}` },
    { id: "modulator", title: "Модулятор и выход ПДУ", group: "tx", signal: `${formula(String.raw`b_k^\mu`)} + ${formula(String.raw`u_{н}(t)`)} → ${formula(String.raw`s(t,b_k^\mu)`)} → ${formula(String.raw`S(t)`)}` },
    { id: "channel", title: "Непрерывный канал связи", group: "channel", signal: `${formula(String.raw`S(t)`)} → ${formula(String.raw`z(t)=\chi S(t)+n(t)`)}` },
    { id: "detector", title: "Вход ПРУ, детектор и РУ", group: "rx", signal: `${formula(String.raw`z(t)`)} → ${formula(String.raw`\hat s(t,b_k^\mu)`)} → ${formula(String.raw`U_k`)} → ${formula(String.raw`\hat b_k^\mu`)}` },
    { id: "decoder", title: "Декодер и интерполятор ЦАП", group: "rx", signal: `${formula(String.raw`\hat b_k^\mu`)} → ${formula(String.raw`\hat v_k^j`)} → ${formula(String.raw`\hat x(t)`)}` },
    { id: "recipient", title: "Приёмный ФНЧ и получатель", group: "rx", signal: `${formula(String.raw`\hat x(t)`)} → ${formula(String.raw`\hat g(t)`)} → ${formula(String.raw`\hat c(t)`)}` },
  ];

  const stageGuides = {
    source: {
      input: `исходное сообщение ${formula(String.raw`c(t)`)}`,
      action: `синтезируем ${formula(String.raw`g(t)`)} как сумму 96 гармоник, заданных спектральной плотностью ${formula(String.raw`G_g(f)`)}`,
      output: `первичный сигнал ${formula(String.raw`g(t)`)}`,
      points: [
        `Цепочка построения: ${formula(String.raw`B_c(\tau)`)} → ${formula(String.raw`G_g(f)`)} → частоты и амплитуды 96 косинусоид → их сумма ${formula(String.raw`g_0(t)`)}`,
        `После синтеза из реализации вычитается выборочное среднее, затем она масштабируется так, чтобы ${formula(String.raw`M\{g\}=0`)} и ${formula(String.raw`D_g=P_g`)}`,
        `Четыре графика показывают одну и ту же модель с разных сторон: реализацию, корреляцию, спектр и распределение значений.`,
        `Временной фрагмент синхронизирован с последующими сквозными графиками, поэтому форму ${formula(String.raw`g(t)`)} можно сопоставлять с фильтрацией, отсчётами и восстановлением.`,
      ],
    },
    "tx-filter": {
      input: `первичный сигнал ${formula(String.raw`g(t)`)}`,
      action: "идеальный ФНЧ оставляет полезную полосу и срезает спектральный хвост",
      output: `ограниченный по спектру сигнал ${formula(String.raw`x(t)`)}`,
      points: [
        "Во времени фильтр выглядит как сглаживание резких изменений.",
        `В частотной области видно главное: всё за пределами ${formula(String.raw`\Delta f_g`)} превращается в ошибку фильтрации.`,
      ],
    },
    sampler: {
      input: `непрерывный сигнал ${formula(String.raw`x(t)`)}`,
      action: `берём отсчёты через ${formula(String.raw`\Delta t`)} по теореме Котельникова`,
      output: `последовательность ${formula(String.raw`x(k\Delta t)`)}`,
      points: [
        `Чем больше ${formula(String.raw`\alpha`)}, тем плотнее стоят отсчёты.`,
        `Этот же шаг ${formula(String.raw`\Delta t`)} дальше задаёт длительность ступеней ЦАП, поэтому дискретизация связывает начало и конец системы.`,
      ],
    },
    quantizer: {
      input: `отсчёты ${formula(String.raw`x(k\Delta t)`)}`,
      action: "заменяем каждый отсчёт ближайшим разрешённым уровнем",
      output: `уровни квантования ${formula(String.raw`v_k^j`)}`,
      points: [
        "Первый график показывает потерю точности на каждом отсчёте.",
        "Лесенка квантователя объясняет правило замены амплитуды уровнем.",
        "Гистограмма показывает, какие уровни чаще появляются у гауссовского сигнала.",
      ],
    },
    encoder: {
      input: `уровни ${formula(String.raw`v_k^j`)}`,
      action: `каждый уровень заменяется ${formula(String.raw`\mu`)}-битной кодовой комбинацией рассчитанной разрядности`,
      output: `цифровой поток ${formula(String.raw`b_k^\mu`)}`,
      points: [
        "Сначала сопоставь уровень и кодовое слово.",
        "Потом смотри меандр b(t): именно он управляет радиомодулятором.",
        "Синхронная лупа дальше повторяется в модуляторе, канале и детекторе.",
      ],
    },
    modulator: {
      input: `цифровой поток ${formula(String.raw`b_k^\mu`)} и несущая ${formula(String.raw`u_{н}(t)`)}`,
      action: "код управляет одним свойством несущей",
      output: `радиосигнал ${formula(String.raw`S(t)`)}`,
      points: [
        "В ДАМ меняется амплитуда: бит 0 гасит или ослабляет посылку, бит 1 включает её.",
        "В ДЧМ меняется частота: разные биты передаются разными несущими f1 и f2.",
        "В ДОФМ меняется относительная фаза: смысл несёт скачок фазы между соседними посылками.",
      ],
    },
    channel: {
      input: `передаваемый сигнал ${formula(String.raw`S(t)`)}`,
      action: "к сигналу добавляется аддитивный гауссовский шум",
      output: `принятая смесь ${formula(String.raw`z(t)`)}`,
      points: [
        "Сравни три раскрываемых фрагмента сверху вниз: чистый сигнал, отдельный шум, сумма на входе приёмника.",
        `${formula(String.raw`N_0`)} меняет мощность шума, а ${formula(String.raw`h^2`)} задаёт требуемую мощность сигнала для выбранной полосы.`,
      ],
    },
    detector: {
      input: `смесь ${formula(String.raw`z(t)`)}`,
      action: "приёмник выбирает бит по правилу, зависящему от модуляции и способа приёма",
      output: `оценка битов ${formula(String.raw`\hat b_k^\mu`)}`,
      points: [
        "Для ДАМ важен порог амплитуды.",
        "Для ДЧМ сравнивается энергия в двух частотных ветках.",
        "Для ДОФМ решение связано с фазой или полярностью соседних посылок.",
      ],
    },
    decoder: {
      input: `принятые биты ${formula(String.raw`\hat b_k^\mu`)}`,
      action: "кодовые слова снова переводятся в амплитудные уровни",
      output: `восстановленные уровни ${formula(String.raw`\hat v_k^j`)}`,
      points: [
        "Если бит ошибся, кодовое слово может попасть в другой уровень.",
        "Красная область показывает уже не радиошум, а шум передачи после декодирования.",
      ],
    },
    recipient: {
      input: `ступенчатый сигнал ${formula(String.raw`\hat x(t)`)}`,
      action: "интерполяция и приёмный ФНЧ сглаживают уровни",
      output: `оценка исходного сообщения ${formula(String.raw`\hat c(t)`)}`,
      points: [
        "Сравни исходную кривую и восстановленную: это итог всей цепочки.",
        `Финальная ${formula(String.raw`\delta_\Sigma^2`)} собирает три причины потерь: фильтрацию, квантование и ошибки передачи.`,
      ],
    },
  };

  const stageBridges = {
    source: {
      chain: formula(String.raw`B_c(\tau)\to G_g(f)\to\Delta f_g`),
      text: `Корреляционная функция объясняет форму спектра, а спектр задаёт рабочую полосу ${formula(String.raw`\Delta f_g`)}.`,
    },
    "tx-filter": {
      chain: formula(String.raw`\Delta f_g\to f_{\text{ср}}\to\xi_{\text{ф}}^2`),
      text: `ФНЧ пропускает полосу ${formula(String.raw`\Delta f_g`)} и отсекает спектральный хвост; отсечённая энергия становится ошибкой фильтрации.`,
    },
    sampler: {
      chain: formula(String.raw`\Delta f_g,\alpha\to f_{\text{д}}\to\Delta t`),
      text: `Чем шире спектр и больше запас ${formula(String.raw`\alpha`)}, тем чаще нужно брать отсчёты.`,
    },
    quantizer: {
      chain: formula(String.raw`W_g(x)\to p_j\to\Delta U,\mu\to\xi_{\text{кв}}^2`),
      text: `Распределение амплитуд объясняет вероятности уровней, а шаг ${formula(String.raw`\Delta U`)} определяет шум квантования.`,
    },
    encoder: {
      chain: formula(String.raw`\mu\to\tau_{\text{сим}}\to\Delta f_{\text{ц}}\to\Delta f_s`),
      text: `Чем больше бит в кодовом слове, тем короче битовый символ и шире цифровой/модулированный спектр.`,
    },
    modulator: {
      chain: formula(String.raw`\mu\to\tau_{\text{сим}}\to\Delta f_{\text{ц}}\to\Delta f_s`),
      text: `Длительность битового символа задаёт цифровую полосу, а вид модуляции превращает её в ${formula(String.raw`\Delta f_s`)}.`,
    },
    channel: {
      chain: formula(String.raw`\Delta f_s\to P_{\text{ш}}=N_0\Delta f_s\to P_s=h^2P_{\text{ш}}\to U_m`),
      text: `Полоса сигнала определяет, сколько шума попадёт в приёмник, а через ${formula(String.raw`h^2`)} задаётся требуемая мощность сигнала для выбранной полосы.`,
    },
    detector: {
      chain: formula(String.raw`z(t)\to\text{отклик}\to U_k\to\hat b_k^\mu`),
      text: `Приёмник берёт отсчёт отклика и сравнивает его с порогом или откликом другого канала.`,
    },
    decoder: {
      chain: formula(String.raw`\hat b_k^\mu\to\hat v_k^j\to\xi_{\text{п}}^2\to\delta_\Sigma^2`),
      text: `Ошибочный бит превращается в неправильный уровень, который входит в шум передачи и итоговую ошибку.`,
    },
    recipient: {
      chain: formula(String.raw`\hat b_k^\mu\to\hat v_k^j\to\xi_{\text{п}}^2\to\delta_\Sigma^2`),
      text: `Ошибки восстановленных уровней вместе с фильтрацией и квантованием образуют итоговую ошибку.`,
    },
  };

  // DOM элементы
  const route = document.querySelector("[data-signal-route]");
  const panel = document.querySelector("[data-stage-panel]");
  const workspaceLayout = document.querySelector(".workspace-layout");
  const workspaceShell = workspaceLayout?.parentElement;
  let structuralScheme = null;
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
    DAM: { title: "ДАМ · дискретная амплитудная модуляция", description: "Двоичный код управляет амплитудой гармонической несущей.", primaryFrequencyLabel: formula(String.raw`f_0`), primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DCHM: { title: "ДЧМ · дискретная частотная модуляция", description: "Двоичный код переключает несущую между частотами f₁ и f₂.", primaryFrequencyLabel: formula(String.raw`f_2`), primaryFrequencyDescription: "Нижняя несущая частота, МГц", receptions: [["KO", "КО · когерентный приём"], ["NO", "НО · некогерентный приём"]] },
    DOFM: { title: "ДОФМ · дискретная относительная фазовая модуляция", description: "Двоичный код управляет относительным изменением фазы несущей.", primaryFrequencyLabel: formula(String.raw`f_0`), primaryFrequencyDescription: "Несущая частота, МГц", receptions: [["SF", "СФ · сравнение фаз"], ["SP", "СП · сравнение полярностей"]] },
  };

  // === Единое описание сигналов структурной схемы методички ===
  // Используется только для одинаковых обозначений, кратких названий
  // и классификации. Расчёты и массивы остаются в SignalData.
  const SIGNAL_META = {
    c:         { symbol: formula(String.raw`c(t)`), name: "Сообщение источника", type: "Непрерывное сообщение" },
    g:         { symbol: formula(String.raw`g(t)`), name: "Первичный электрический сигнал сообщения", type: "Непрерывный случайный сигнал" },
    x:         { symbol: formula(String.raw`x(t)`), name: "Сигнал сообщения с ограниченным спектром", type: "Непрерывный по времени и уровню" },
    sampled:   { symbol: formula(String.raw`x(k\Delta t)`), name: "Дискретизированный сигнал сообщения", type: "Дискретный по времени, непрерывный по уровню" },
    quantized: { symbol: formula(String.raw`v_k^j`), name: "Квантованное значение сигнала", type: "Дискретный по времени и уровню" },
    encoded:   { symbol: formula(String.raw`b_k^\mu`), name: "μ-разрядная кодовая комбинация", type: "Цифровой сигнал" },
    carrier:   { symbol: formula(String.raw`u_{н}(t)`), name: "Несущее гармоническое колебание", type: "Непрерывное периодическое колебание" },
    modulated: { symbol: formula(String.raw`s(t,b_k^\mu)`), name: "Несущее колебание, модулированное сообщением", type: "Непрерывный физический сигнал" },
    transmitted:{ symbol: formula(String.raw`S(t)`), name: "Сигнал, передаваемый по линии связи", type: "Непрерывный физический сигнал" },
    noise:     { symbol: formula(String.raw`n(t)`), name: "Помеха в линии связи", type: "Непрерывный случайный процесс" },
    received:  { symbol: formula(String.raw`z(t)`), name: "Сигнал на входе приёмника", type: "Непрерывный случайный сигнал" },
    detected:  { symbol: formula(String.raw`\hat s(t,b_k^\mu)`), name: "Принятый модулированный сигнал на выходе входного устройства ПРУ", type: "Непрерывный сигнал" },
    b_hat:     { symbol: formula(String.raw`\hat b_k^\mu`), name: "Принятая кодовая комбинация", type: "Цифровой сигнал" },
    v_hat:     { symbol: formula(String.raw`\hat v_k^j`), name: "Восстановленный квантованный уровень", type: "Дискретный по времени и уровню" },
    x_hat:     { symbol: formula(String.raw`\hat x(t)`), name: "Восстановленный сигнал после интерполяции", type: "Непрерывный по времени, дискретный по уровню" },
    g_hat:     { symbol: formula(String.raw`\hat g(t)`), name: "Восстановленный электрический сигнал сообщения", type: "Непрерывный по времени и уровню" },
    c_hat:     { symbol: formula(String.raw`\hat c(t)`), name: "Принятое сообщение после выходного преобразователя", type: "Непрерывное сообщение" },
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
      signalChange: `Форма сигнала сохраняется, но составляющие за пределами ${formula(String.raw`\Delta f_g`)} подавляются.`,
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
      signalChange: `Номер уровня превращается в ${formula(String.raw`\mu`)}-битное двоичное слово. Сигнал становится цифровым.`,
    },
    modulator: {
      inputSignals: ["encoded", "carrier"], outputSignals: ["modulated", "transmitted"],
      dependsOn: ["digitalBandwidth", "signalNoiseRatio"], affects: ["modulatedBandwidth", "Um"],
      signalChange: "Цифровой код управляет одним из параметров несущей. Форма зависит от вида модуляции.",
      miniTract: [
        { node: SIGNAL_META.encoded.symbol, label: "Модулятор", out: SIGNAL_META.modulated.symbol },
        { node: null, label: "Выход ПДУ", out: SIGNAL_META.transmitted.symbol },
      ],
      extraInput: SIGNAL_META.carrier.symbol,
    },
    channel: {
      inputSignals: ["transmitted"], outputSignals: ["received"],
      dependsOn: ["modulatedBandwidth", "noiseDensity"], affects: ["noisePower", "signalPower"],
      signalChange: `Сигнал смешивается с аддитивным гауссовским шумом; принято ${formula(String.raw`\chi=1`)}.`,
      miniTract: [
        { node: SIGNAL_META.transmitted.symbol, label: "Ослабление", out: formula(String.raw`\chi S(t)`) },
        { node: null, label: "+ шум", out: SIGNAL_META.received.symbol },
      ],
      extraInput: SIGNAL_META.noise.symbol,
    },
    detector: {
      inputSignals: ["received"], outputSignals: ["b_hat"],
      dependsOn: ["signalPower", "noisePower", "signalNoiseRatio"], affects: ["errorProbability"],
      signalChange: "Детектор формирует отклик, из которого решающее устройство восстанавливает биты.",
      miniTract: [
        { node: SIGNAL_META.received.symbol, label: "Вход ПРУ", out: SIGNAL_META.detected.symbol },
        { node: null, label: "Детектор и РУ", out: SIGNAL_META.b_hat.symbol },
      ],
    },
    decoder: {
      inputSignals: ["b_hat"], outputSignals: ["v_hat", "x_hat"],
      dependsOn: ["mu", "errorProbability"], affects: ["transmissionNoise"],
      signalChange: "Кодовые слова переводятся обратно в уровни, затем интерполятор формирует ступенчатый сигнал.",
      miniTract: [
        { node: SIGNAL_META.b_hat.symbol, label: "Декодер", out: SIGNAL_META.v_hat.symbol },
        { node: null, label: "Интерполятор", out: SIGNAL_META.x_hat.symbol },
      ],
    },
    recipient: {
      inputSignals: ["x_hat"], outputSignals: ["g_hat", "c_hat"],
      dependsOn: ["filterError", "quantizationNoise", "transmissionNoise"], affects: ["totalError"],
      signalChange: "Ступенчатый сигнал сглаживается приёмным ФНЧ, образуя непрерывную оценку сообщения.",
      miniTract: [
        { node: SIGNAL_META.x_hat.symbol, label: "Приёмный ФНЧ", out: SIGNAL_META.g_hat.symbol },
        { node: null, label: "Выходной преобразователь", out: SIGNAL_META.c_hat.symbol },
      ],
    },
  };

  // Описание изменения параметров для подсветки (краткие физические пояснения)
  const PARAM_CHANGE_NOTES = {
    Pg: `Изменение мощности сигнала пересчитывает ${formula(String.raw`\sigma_g`)}, динамический диапазон и шаг квантования.`,
    beta: `Изменение ${formula(String.raw`\beta`)} меняет ширину спектра ${formula(String.raw`\Delta f_g`)}, что влияет на ошибку фильтрации и частоту дискретизации.`,
    signalBandwidth: `Полоса сигнала ${formula(String.raw`\Delta f_g`)} определяет ошибку фильтрации и частоту дискретизации.`,
    samplingIncrease: `Изменение ${formula(String.raw`\alpha`)} меняет частоту дискретизации, интервал ${formula(String.raw`\Delta t`)}, поправку ${formula(String.raw`\eta`)} и разрядность ${formula(String.raw`\mu`)}.`,
    signalNoiseRatio: `Изменение ${formula(String.raw`h^2`)} пересчитывает мощность сигнала, амплитуду и вероятность ошибки.`,
    noiseDensity: `Изменение ${formula(String.raw`N_0`)} меняет мощность шума в полосе канала.`,
    mu: `Разрядность ${formula(String.raw`\mu`)} определяет число уровней, длительность символа и ширину цифрового спектра.`,
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
    signalPower: [formula(String.raw`P_g`), "В²"], beta: [formula(String.raw`\beta`), "мс⁻¹"], signalBandwidth: [formula(String.raw`\Delta f_g`), ""],
    samplingIncrease: [formula(String.raw`\alpha`), ""], noiseDensity: [formula(String.raw`N_0`), "мВт/Гц"], signalNoiseRatio: [formula(String.raw`h^2`), ""],
    acceptableError: [formula(String.raw`\delta_{\text{доп}}^2`), ""],
  };

  const stageControlMeta = {
    signalPower: { label: formula(String.raw`P_g`), min: 0.1, max: 6, step: 0.1, unit: "В²" },
    beta: { label: formula(String.raw`\beta`), min: 1, max: 40, step: 0.1, unit: "мс⁻¹" },
    bandwidthFactor: { label: formula(String.raw`k`), min: 0.5, max: 5, step: 0.1, unit: "" },
    samplingIncrease: { label: formula(String.raw`\alpha`), min: 1, max: 5, step: 0.1, unit: "" },
    primaryFrequency: { label: formula(String.raw`f_0/f_2`), min: 40, max: 120, step: 0.1, unit: "МГц" },
    secondaryFrequency: { label: formula(String.raw`f_1`), min: 40, max: 130, step: 0.1, unit: "МГц" },
    noiseDensity: { label: formula(String.raw`N_0`), min: 0.00001, max: 0.001, step: 0.00001, unit: "" },
    signalNoiseRatio: { label: formula(String.raw`h^2`), min: 1, max: 25, step: 0.1, unit: "" },
    acceptableError: { label: formula(String.raw`\delta_{\text{доп}}^2`), min: 0.01, max: 1, step: 0.01, unit: "" },
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
      DCHM: `Сейчас выбран ДЧМ: используются частоты ${formula(String.raw`f_1`)} и ${formula(String.raw`f_2`)}, а приёмник сравнивает две ветви.`,
      DOFM: `Сейчас выбран ДОФМ: используется несущая ${formula(String.raw`f_0`)}, а информация переносится относительным изменением фазы.`,
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
    html += `<div class="signal-flow-cell"><span class="signal-flow-label">Вход</span><span class="signal-flow-formula">${inputSymbols}</span></div>`;
    html += `<div class="signal-flow-arrow">→</div>`;
    html += `<div class="signal-flow-cell"><span class="signal-flow-label">Выход</span><span class="signal-flow-formula">${outputSymbols}</span></div>`;
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
      Pg: formula(String.raw`P_g`), beta: formula(String.raw`\beta`), signalBandwidth: formula(String.raw`\Delta f_g`),
      samplingIncrease: formula(String.raw`\alpha`), eta: formula(String.raw`\eta`), sigmaG: formula(String.raw`\sigma_g`), dfg: formula(String.raw`\Delta f_g`),
      filterError: formula(String.raw`\xi_{\text{ф}}^2`), samplingFrequency: formula(String.raw`f_{\text{д}}`),
      samplingInterval: formula(String.raw`\Delta t`), conditionalStep: formula(String.raw`\Delta u_{усл}`),
      mu: formula(String.raw`\mu`), levelCount: formula(String.raw`L`), bitDuration: formula(String.raw`\tau_{\text{сим}}`),
      digitalBandwidth: formula(String.raw`\Delta f_{\text{ц}}`), quantizationNoise: formula(String.raw`\xi_{\text{кв}}^2`),
      modulatedBandwidth: formula(String.raw`\Delta f_s`), noisePower: formula(String.raw`P_{\text{ш}}`),
      signalPower: formula(String.raw`P_s`), Um: formula(String.raw`U_m`),
      errorProbability: formula(String.raw`p_{\text{ош}}`), transmissionNoise: formula(String.raw`\xi_{\text{п}}^2`),
      totalError: formula(String.raw`\delta_\Sigma^2`), channelCapacity: formula(String.raw`C`),
      noiseDensity: formula(String.raw`N_0`), signalNoiseRatio: formula(String.raw`h^2`),
      Dg: formula(String.raw`D_g`), deltaU1: formula(String.raw`\Delta u_1`),
    };
    const formatParam = (p) => paramLabels[p] || escapeHtml(p);
    let html = `<details class="dependencies-block">`;
    html += `<summary>Параметры этапа</summary>`;
    if (dependsOn.length) {
      html += `<div class="dependencies-row"><span class="dependencies-label">Зависит от:</span><span class="dependencies-values">${dependsOn.map(formatParam).join(", ")}</span></div>`;
    }
    if (affects.length) {
      html += `<div class="dependencies-row"><span class="dependencies-label">Влияет на:</span><span class="dependencies-values">${affects.map(formatParam).join(", ")}</span></div>`;
    }
    html += `</details>`;
    return html;
  }

  // === Рендер краткого объяснения изменения параметра ===
  function renderChangeNote(changedParam) {
    const note = PARAM_CHANGE_NOTES[changedParam];
    if (!note) return "";
    return `<div class="change-note">${note}</div>`;
  }

  function renderLearningGuide(stage, params) {
    const guide = stageGuides[stage.id];
    if (!guide) return "";
    const modulationNote = ["modulator", "detector"].includes(stage.id) ? getModulationLearningNote(params) : "";
    return `<div class="stage-panel__content stage-panel__guide" data-group="${stage.group}">
      <p class="stage-panel__action"><strong>На этом этапе:</strong> ${guide.action}</p>
      ${modulationNote ? `<p class="stage-panel__guide-note">${modulationNote}</p>` : ""}
    </div>`;
  }

  function renderCausalBridge(stageId) {
    const bridge = stageBridges[stageId];
    if (!bridge) return "";
    return `<div class="stage-panel__content stage-causal-bridge">
      <strong>Куда это идёт дальше:</strong>
      <span class="stage-causal-bridge__chain">${bridge.chain}</span>
      <span>${bridge.text}</span>
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

  const PARAM_SIGNATURE_FIELDS = [
    "signalPower",
    "beta",
    "bandwidthFactor",
    "signalBandwidth",
    "samplingIncrease",
    "modulation",
    "primaryFrequency",
    "secondaryFrequency",
    "noiseDensity",
    "signalNoiseRatio",
    "reception",
    "acceptableError",
  ];

  function getParamsSignature(params) {
    return JSON.stringify(PARAM_SIGNATURE_FIELDS.map((name) => [name, params[name] ?? ""]));
  }

// Метки видов модуляции для пользовательского интерфейса.
  // Внутренние ключи DAM/DCHM/DOFM не переименовываются.
  const MOD_LABELS = { DAM: "ДАМ", DCHM: "ДЧМ", DOFM: "ДОФМ" };

  // Выбор главного временного окна по g(t) с учётом downstream-информативности.
  // Окно должно хорошо показывать не только g(t), но и дискретизацию, квантование,
  // кодирование и модуляцию. Возвращает { start, end } (end — не включительно).
  function chooseMainTimeWindow(SignalData, params) {
    const vm = window.VisualMath;
    if (!vm) return { start: 0, end: 0 };

    const g_t = SignalData.g_t || [];
    const N = g_t.length;
    if (!N) return { start: 0, end: 0 };

    const step = Math.max(1, SignalData.sampling_step_indices || 1);
    const targetSamples = Math.min(10, (SignalData.sampled_x_values || []).length || 10);
    const rawLength = Math.max(32, targetSamples * step);
    const length = Math.min(N, rawLength);

    if (length >= N) return { start: 0, end: N };

    const sampled_indices = SignalData.sampled_x_indices || [];
    const sampled_values = SignalData.sampled_x_values || [];
    const quantized_indices = SignalData.quantized_indices || [];
    const b_t = SignalData.b_t || [];
    const mu = SignalData.quantization_mu || 1;

    // Предрасчёт глобальных границ для нормировки
    let gMin = Infinity, gMax = -Infinity;
    for (let i = 0; i < N; i++) {
      if (g_t[i] < gMin) gMin = g_t[i];
      if (g_t[i] > gMax) gMax = g_t[i];
    }
    const gRange = Math.max(1e-9, gMax - gMin);

    const stride = Math.max(1, Math.floor(length / 16));
    const lastStart = N - length;
    let bestStart = 0;
    let bestScore = -Infinity;

    for (let start = 0; start <= lastStart; start += stride) {
      const end = start + length;

      // --- g(t) характеристики ---
      let wMin = Infinity, wMax = -Infinity;
      let variation = 0, turns = 0, prevDelta = 0, slopeEnergy = 0, zeroCross = 0;
      for (let i = start; i < end; i++) {
        const v = g_t[i];
        if (v < wMin) wMin = v;
        if (v > wMax) wMax = v;
        if (i > start) {
          const d = v - g_t[i - 1];
          variation += Math.abs(d);
          slopeEnergy += d * d;
          if (prevDelta && d && Math.sign(d) !== Math.sign(prevDelta)) turns++;
          if (d) prevDelta = d;
          if (Math.sign(g_t[i - 1]) !== Math.sign(v) && g_t[i - 1] !== 0) zeroCross++;
        }
      }
      const wRange = wMax - wMin;
      const normRange = wRange / gRange;
      const flatPenalty = wRange < gRange * 0.15 ? 1 : 0;

      // --- downstream: отсчёты внутри окна ---
      let sampleDiversity = 0, sampleCount = 0;
      if (sampled_indices.length) {
        for (let si = 0; si < sampled_indices.length; si++) {
          const idx = sampled_indices[si];
          if (idx >= start && idx < end) {
            sampleDiversity += Math.abs(sampled_values[si] || 0);
            sampleCount++;
          }
        }
        if (sampleCount > 1) sampleDiversity = sampleDiversity / sampleCount;
      }

      // --- downstream: квантованные уровни ---
      let quantDiversity = 0, uniqueLevels = {};
      if (quantized_indices.length && sampleCount > 0) {
        const kStart = Math.floor(start / step);
        const kEnd = Math.ceil(end / step);
        for (let k = kStart; k < kEnd && k < quantized_indices.length; k++) {
          uniqueLevels[quantized_indices[k]] = true;
        }
        quantDiversity = Object.keys(uniqueLevels).length;
      }

      // --- downstream: битовые переходы ---
      let bitTransitions = 0;
      if (b_t.length && sampleCount > 0) {
        const bitStart = Math.floor(start / step) * mu;
        const bitEnd = Math.ceil(end / step) * mu;
        for (let bi = bitStart + 1; bi < bitEnd && bi < b_t.length; bi++) {
          if (Math.sign(b_t[bi]) !== Math.sign(b_t[bi - 1])) bitTransitions++;
        }
      }

      const edgePenalty = (start < stride || end > N - stride) ? 1 : 0;

      const score =
        2.0 * normRange +
        1.5 * zeroCross +
        1.5 * (slopeEnergy / (length * gRange)) +
        2.0 * sampleDiversity +
        1.5 * quantDiversity +
        1.0 * bitTransitions -
        2.0 * edgePenalty -
        1.0 * flatPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }

    return { start: bestStart, end: bestStart + length };
  }

  // Состояние ручного выбора фрагмента: { mode: "auto"|"manual", timeStartMs, timeEndMs, visibleWordsOverride }
  // Хранится в SignalData.syncManual. При авто — берётся chooseMainTimeWindow.
  // При ручном — timeWindow рассчитывается из timeStartMs/timeEndMs через timeToIndex.
  function getSyncManual() {
    if (!SignalData.syncManual) SignalData.syncManual = { mode: "auto", timeStartMs: null, timeEndMs: null, visibleWordsOverride: null };
    return SignalData.syncManual;
  }

  // Вычисление всех синхронизированных осей и окон.
  // Вызывается после полного processAllStages — detectorTrace, delta_sum_components
  // и delta_sum_sq появляются только после detector/recipient.
  function computeSyncAxes(SignalData, params) {
    const vm = window.VisualMath;
    const sync = {};

    // ─── timeWindow (по g(t)) ───
    const g_t = SignalData.g_t || [];
    const N = SignalData.N || g_t.length;
    const syncManual = getSyncManual();

    let manualApplied = false;
    if (syncManual.mode === "manual" && Number.isFinite(syncManual.timeStartMs) && Number.isFinite(syncManual.timeEndMs) && N > 1 && vm && vm.timeToIndex) {
      const iStart = Math.max(0, Math.min(N - 1, Math.round(vm.timeToIndex(syncManual.timeStartMs, N, params))));
      let iEnd = Math.max(0, Math.min(N, Math.round(vm.timeToIndex(syncManual.timeEndMs, N, params))));
      if (iEnd <= iStart) iEnd = Math.min(N, iStart + 1);
      sync.timeWindow = { start: iStart, end: iEnd };
      manualApplied = true;
    }
    if (!manualApplied) {
      if (g_t.length) {
        sync.timeWindow = chooseMainTimeWindow(SignalData, params);
      } else if ((SignalData.sampled_x_values || []).length) {
        const step = Math.max(1, SignalData.sampling_step_indices || 1);
        const targetSamples = Math.min(10, SignalData.sampled_x_values.length);
        const refWin = vm ? vm.chooseDynamicWindow(SignalData.sampled_x_values, {
          minLength: Math.min(6, targetSamples),
          length: targetSamples,
          ignoreShared: true,
        }) : { start: 0, end: targetSamples };
        sync.timeWindow = {
          start: Math.min(N - 1, refWin.start * step),
          end: Math.min(N, Math.max(refWin.start * step + 2, refWin.end * step)),
        };
      } else {
        sync.timeWindow = { start: 0, end: N };
      }
    }

    const tw = sync.timeWindow;

    // ─── sampleWindow (через sampled_x_indices) ───
    const indices = SignalData.sampled_x_indices || [];
    if (indices.length) {
      let sampleStart = indices.findIndex(function(i) { return i >= tw.start; });
      let sampleEnd = indices.findIndex(function(i) { return i >= tw.end; });
      if (sampleStart < 0) sampleStart = 0;
      if (sampleEnd < 0) sampleEnd = indices.length;
      sync.sampleWindow = {
        start: Math.max(0, sampleStart),
        end: Math.max(sampleStart + 1, sampleEnd),
      };
    } else {
      // Fallback через step
      const step = Math.max(1, SignalData.sampling_step_indices || 1);
      sync.sampleWindow = {
        start: Math.floor(tw.start / step),
        end: Math.min((SignalData.sampled_x_values || []).length || 0, Math.ceil(tw.end / step)),
      };
      if (sync.sampleWindow.end <= sync.sampleWindow.start) {
        sync.sampleWindow.end = sync.sampleWindow.start + 1;
      }
    }

    // ─── wordWindow (= sampleWindow: 1 квантованное значение = 1 кодовое слово) ───
    sync.wordWindow = {
      start: sync.sampleWindow.start,
      end: sync.sampleWindow.end,
    };

    const mu = SignalData.quantization_mu || 1;
    const wordStart = sync.wordWindow.start;
    const wordEnd = sync.wordWindow.end;

    // ─── bitWindowFull (wordWindow × μ) ───
    sync.bitWindowFull = {
      start: wordStart * mu,
      end: Math.min((SignalData.b_t || []).length, wordEnd * mu),
    };

    // ─── bitWindowView (целые слова, ≤12 бит) ───
    // visibleWordsOverride — ручной выбор "показать слов" для модуляции/канала/детектора.
    const autoVisibleWords = Math.max(1, Math.floor(12 / mu));
    const visibleWords = (syncManual.mode === "manual" && syncManual.visibleWordsOverride)
      ? Math.max(1, Math.min(autoVisibleWords, Math.floor(syncManual.visibleWordsOverride)))
      : autoVisibleWords;
    sync.bitWindowView = {
      start: sync.bitWindowFull.start,
      end: Math.min(sync.bitWindowFull.start + visibleWords * mu, sync.bitWindowFull.end),
    };

    // ─── bitWindowContext (для ДОФМ: +1 бит слева как контекст) ───
    sync.bitWindowContext = {
      start: Math.max(0, sync.bitWindowView.start - 1),
      end: sync.bitWindowView.end,
    };

    // ─── radioWindow (от bitWindowView для ДАМ/ДЧМ, от bitWindowContext для ДОФМ) ───
    const isDOFM = params.modulation === "DOFM";
    const bitSrc = isDOFM ? sync.bitWindowContext : sync.bitWindowView;
    const radioN = SignalData.radio_N || SignalData.N || 0;
    const numBits = (SignalData.b_t || []).length || 1;
    const ppb = SignalData.radio_points_per_bit || (radioN / numBits);
    sync.radioWindow = {
      start: Math.floor(bitSrc.start * ppb),
      end: Math.min(radioN, Math.ceil(bitSrc.end * ppb)),
    };

    // ─── frequencyAxis ───
    const calc = SignalData.calculation || {};
    sync.frequencyAxis = {
      dfg: (calc.input || {}).dfg,
      fd: (calc.sampling || {}).fd,
      dfPcm: (calc.coding || {}).dfPcm,
      dfSignal: (calc.radio || {}).dfSignal,
      carrierMain: Number(params.primaryFrequency),
      carrierAlt: Number(params.secondaryFrequency),
      modulationKey: params.modulation,
      modulationLabel: MOD_LABELS[params.modulation] || params.modulation,
    };

    // ─── amplitudeAxis (signal / noise / received) ───
    const sigmaG = SignalData.source_sigma || 0;
    const noiseSigma = SignalData.noiseSigma || 0;
    let recvMin = Infinity, recvMax = -Infinity;
    const z_t = SignalData.z_t || [];
    const rw = sync.radioWindow;
    for (let i = rw.start; i < rw.end && i < z_t.length; i++) {
      if (z_t[i] < recvMin) recvMin = z_t[i];
      if (z_t[i] > recvMax) recvMax = z_t[i];
    }
    if (!isFinite(recvMin)) { recvMin = -1; recvMax = 1; }
    sync.amplitudeAxis = {
      signal: {
        sigma: sigmaG,
        min: SignalData.yMin != null ? SignalData.yMin : -4 * sigmaG,
        max: SignalData.yMax != null ? SignalData.yMax : 4 * sigmaG,
      },
      noise: {
        sigma: noiseSigma,
        min: -4 * noiseSigma,
        max: 4 * noiseSigma,
      },
      received: {
        min: recvMin,
        max: recvMax,
      },
    };

    // ─── levelAxis ───
    sync.levelAxis = {
      levels: SignalData.levels || [],
      thresholds: SignalData.thresholds || [],
      probabilities: SignalData.level_probabilities || [],
      cumulative: SignalData.level_cumulative || [],
      mu: mu,
    };

    // ─── responseAxis (по режиму модуляции) ───
    let responseMin = Infinity, responseMax = -Infinity;
    const modKey = params.modulation;
    const trace = SignalData.detectorTrace || [];
    const bwv = sync.bitWindowView;

    if (modKey === "DCHM") {
      // ДЧМ: оба канала
      const ch1 = SignalData.detector_channel1 || [];
      const ch2 = SignalData.detector_channel2 || [];
      for (let k = bwv.start; k < bwv.end; k++) {
        if (k < ch1.length) {
          if (ch1[k] < responseMin) responseMin = ch1[k];
          if (ch1[k] > responseMax) responseMax = ch1[k];
        }
        if (k < ch2.length) {
          if (ch2[k] < responseMin) responseMin = ch2[k];
          if (ch2[k] > responseMax) responseMax = ch2[k];
        }
      }
    } else if (modKey === "DOFM") {
      // ДОФМ-СП: coherent_detects; ДОФМ-СФ: detectorTrace
      const cd = SignalData.coherent_detects || [];
      if (cd.length) {
        for (let k = bwv.start; k < bwv.end; k++) {
          if (k < cd.length) {
            if (cd[k] < responseMin) responseMin = cd[k];
            if (cd[k] > responseMax) responseMax = cd[k];
          }
        }
      } else if (trace.length) {
        for (let k = bwv.start; k < bwv.end; k++) {
          if (k < trace.length) {
            const v = trace[k].val;
if (v < responseMin) responseMin = v;
          if (v > responseMax) responseMax = v;
          }
        }
      }
    } else {
      // ДАМ (и fallback): detectorTrace + u0
      for (let k = bwv.start; k < bwv.end; k++) {
        if (k < trace.length) {
          const v = trace[k].val;
          if (v < responseMin) responseMin = v;
          if (v > responseMax) responseMax = v;
        }
      }
    }

    // Учитываем порог u0 в диапазоне
    const u0 = SignalData.u0 != null ? SignalData.u0 : 0;
    if (u0 < responseMin) responseMin = u0;
    if (u0 > responseMax) responseMax = u0;

    if (!isFinite(responseMin)) { responseMin = -1; responseMax = 1; }
    sync.responseAxis = {
      threshold: u0,
      responseMin: responseMin,
      responseMax: responseMax,
      mode: MOD_LABELS[modKey] || modKey,
      receiverType: SignalData.receiver_type || "",
    };

    // ─── errorAxis ───
    const dsc = SignalData.delta_sum_components || {};
    sync.errorAxis = {
      filterAbs: dsc.filterAbs,
      quantAbs: dsc.quantAbs,
      transmissionAbs: dsc.transmissionAbs,
      deltaSumSq: SignalData.delta_sum_sq,
      acceptableError: params.acceptableError != null ? Number(params.acceptableError) : null,
    };

    return sync;
  }

  // Обработка данных для всех этапов последовательно
  function processAllStages(params) {
    const paramsSignature = getParamsSignature(params);
    if (SignalData.lastParamsString === paramsSignature && SignalData.g_hat_t) return;

    SignalData.resetDerived();
    SignalData.calculation = window.SystemCalculations.calculate(params);
    const stageIds = ["source", "tx-filter", "sampler", "quantizer", "encoder", "modulator", "channel", "detector", "decoder", "recipient"];
    for (const id of stageIds) {
      const handler = window.StageHandlers[id];
      if (handler && handler.process) {
        handler.process(params, SignalData);
      }
    }

    // Синхронизированные оси и окна — вычисляются один раз после всех stage.process()
    SignalData.sync = computeSyncAxes(SignalData, params);
    // Compatibility alias
    SignalData.shared_time_window = SignalData.sync.timeWindow;

SignalData.lastParamsString = paramsSignature;
  }

  // ─── Управление сквозным фрагментом ───────────────────────────────────────
  // Все контролы (главный в карточке 1 + локальные в 03/04/05/06/07/08/09)
  // модифицируют SignalData.syncManual и через applySyncChange пересчитывают
  // синхронизированные окна и оси (без пересчёта физики, если параметры те же).

  function applySyncChange(updater) {
    const sm = getSyncManual();
    updater(sm);
    const params = getParameters();
    SignalData.sync = computeSyncAxes(SignalData, params);
    SignalData.shared_time_window = SignalData.sync.timeWindow;

    // Точечное обновление: не пересоздаём всю панель, чтобы не сбросить
    // фокус и скролл. Обновляем только графики + summary/overview контрола.
    const stage = getStage(currentStageId);
    const handler = window.StageHandlers[stage.id];
    const helpers = createSVGHelpers();

    // 1) Перерисовываем графики (renderSVG читает обновлённый SignalData.sync).
    const svgHost = panel.querySelector("[data-sync-svg-host]");
    if (svgHost && handler && handler.renderSVG) {
      svgHost.innerHTML = handler.renderSVG(stage.id, params, helpers, SignalData);
      enhanceVisualLayers();
    }

    // 2) Обновляем summary и overview в контроле, не трогая поля ввода.
    const syncControl = panel.querySelector("[data-sync-control]");
    if (syncControl) {
      const summary = syncControl.querySelector(".sync-fragment-control__summary");
      if (summary) summary.textContent = syncInfoString();
      // Overview SVG обновляем только у главного контроля.
      const overviewWrap = syncControl.querySelector(".sync-overview");
      if (overviewWrap) {
        const newOverview = renderSyncOverviewSvg(params, SignalData);
        const oldSvg = overviewWrap.querySelector(".sync-overview__svg");
        if (oldSvg && newOverview) oldSvg.outerHTML = newOverview;
      }
    }

    renderMath();
  }

  // Текущие значения полей в мс (для предзаполнения input-ов в карточке 1).
  function currentSyncTimeWindowMs() {
    const tw = (SignalData.sync && SignalData.sync.timeWindow) || { start: 0, end: SignalData.N || 1 };
    const N = SignalData.N || (SignalData.g_t || []).length;
    if (!N) return { start: 0, end: 0 };
    const vm = window.VisualMath;
    return {
      start: vm.indexToTimeMs(tw.start, N, getParameters()),
      end: vm.indexToTimeMs(Math.max(tw.start, tw.end - 1), N, getParameters()),
    };
  }

  // Категория контроля по stageId.
  function syncControlKind(stageId) {
    if (stageId === "source") return "main";
    if (stageId === "tx-filter") return "info";
    if (["sampler", "quantizer", "encoder", "decoder"].includes(stageId)) return "samples";
    if (["modulator", "channel", "detector"].includes(stageId)) return "words";
    return null;
  }

  // overview g(t): тонкая min-max полоса с подсветкой выбранного окна.
  function renderSyncOverviewSvg(params, SignalData) {
    const vm = window.VisualMath;
    const g_t = SignalData.g_t || [];
    const N = g_t.length;
    if (!N) return "";
    const buckets = Math.min(700, N);
    const ds = vm.downsampleMinMax(g_t, buckets);
    const span = vm.getTimeSpanMs(params);
    const yMin = SignalData.yMin, yMax = SignalData.yMax;
    const W = 1000, H = 56;
    const xOf = (i) => (i / Math.max(1, N - 1)) * W;
    const yOf = (v) => H - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * (H - 4) - 2;
    let d = "";
    ds.forEach((b) => {
      const x = xOf(b.i);
      const yTop = yOf(b.max), yBot = yOf(b.min);
      d += `M ${x.toFixed(2)} ${yTop.toFixed(2)} L ${x.toFixed(2)} ${yBot.toFixed(2)} `;
    });
    const tw = (SignalData.sync && SignalData.sync.timeWindow) || { start: 0, end: N };
    const hx1 = xOf(tw.start), hx2 = xOf(Math.max(tw.start + 1, tw.end - 1));
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" class="sync-overview__svg" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" stroke="#287c9f" stroke-width="0.9" fill="none" opacity="0.85"/>
      <rect x="${hx1.toFixed(2)}" y="0" width="${(hx2 - hx1).toFixed(2)}" height="${H}" fill="#e74c3c" opacity="0.18" stroke="#e74c3c" stroke-width="1" stroke-opacity="0.5"/>
    </svg>`;
  }

  // Компактная информационная строка: t = ... мс, k = ..., биты r = ...
  function syncInfoString() {
    const sync = SignalData.sync || {};
    const tw = sync.timeWindow || { start: 0, end: 0 };
    const sw = sync.sampleWindow || { start: 0, end: 0 };
    const bwv = sync.bitWindowView || { start: 0, end: 0 };
    const params = getParameters();
    const vm = window.VisualMath;
    const N = SignalData.N || (SignalData.g_t || []).length;
    const tStart = N ? vm.indexToTimeMs(tw.start, N, params) : 0;
    const tEnd = N ? vm.indexToTimeMs(Math.max(tw.start + 1, tw.end - 1), N, params) : 0;
    return `t = ${tStart.toFixed(2)}…${tEnd.toFixed(2)} мс · k = ${sw.start}…${sw.end} · биты r = ${bwv.start}…${bwv.end}`;
  }

  // Главный контроль (карточка 1): Авто/Ручной + tStart/tEnd + overview g(t).
  function renderSyncMainControl(params, SignalData) {
    const sm = getSyncManual();
    const cur = currentSyncTimeWindowMs();
    const span = window.VisualMath.getTimeSpanMs(params);
    const tStartVal = Number.isFinite(sm.timeStartMs) ? sm.timeStartMs : cur.start;
    const tEndVal = Number.isFinite(sm.timeEndMs) ? sm.timeEndMs : cur.end;
    const isManual = sm.mode === "manual";
    const overview = renderSyncOverviewSvg(params, SignalData);
    return `<section class="sync-fragment-control sync-fragment-control--main" data-sync-control>
      <header class="sync-fragment-control__header">
        <span class="sync-fragment-control__title">Сквозной фрагмент</span>
        <span class="sync-mode-toggle" role="group" aria-label="Режим окна">
          <button type="button" class="sync-mode-toggle__btn${isManual ? "" : " is-active"}" data-sync-control-mode="auto">Авто</button>
          <button type="button" class="sync-mode-toggle__btn${isManual ? " is-active" : ""}" data-sync-control-mode="manual">Ручной</button>
        </span>
      </header>
      <div class="sync-fragment-control__fields">
        <label class="sync-field"><span>Начало t, мс</span>
          <input type="number" step="0.01" min="0" max="${span.toFixed(3)}" value="${tStartVal.toFixed(3)}" data-sync-control-input="timeStartMs" />
        </label>
        <label class="sync-field"><span>Конец t, мс</span>
          <input type="number" step="0.01" min="0" max="${span.toFixed(3)}" value="${tEndVal.toFixed(3)}" data-sync-control-input="timeEndMs" />
        </label>
      </div>
      <div class="sync-overview" aria-label="Полная реализация g(t) с подсвеченным фрагментом">
        <span class="sync-overview__label">Полная реализация g(t)</span>
        ${overview}
      </div>
      <p class="sync-fragment-control__summary">${syncInfoString()}</p>
    </section>`;
  }

  // Локальный контроль по отсчётам k (карточки 03/04/05/09).
  function renderSyncSamplesControl() {
    const sync = SignalData.sync || {};
    const sw = sync.sampleWindow || { start: 0, end: 0 };
    const maxK = (SignalData.sampled_x_indices || []).length || 0;
    return `<section class="sync-fragment-control sync-fragment-control--compact" data-sync-control>
      <header class="sync-fragment-control__header">
        <span class="sync-fragment-control__title">Сквозной фрагмент</span>
        <span class="sync-fragment-control__summary">${syncInfoString()}</span>
      </header>
      <div class="sync-fragment-control__fields">
        <label class="sync-field"><span>Отсчёт k нач</span>
          <input type="number" step="1" min="0" max="${Math.max(0, maxK - 1)}" value="${sw.start}" data-sync-control-input="kStart" />
        </label>
        <label class="sync-field"><span>Отсчёт k кон</span>
          <input type="number" step="1" min="1" max="${maxK}" value="${sw.end}" data-sync-control-input="kEnd" />
        </label>
      </div>
      <p class="sync-fragment-control__hint">Те же значения по оси времени в карточке 1.</p>
    </section>`;
  }

  // Локальный контроль по кодовым словам (карточки 06/07/08).
  function renderSyncWordsControl() {
    const sync = SignalData.sync || {};
    const sw = sync.sampleWindow || { start: 0, end: 0 };
    const maxK = (SignalData.sampled_x_indices || []).length || 0;
    const mu = SignalData.quantization_mu || 1;
    const autoVisible = Math.max(1, Math.floor(12 / mu));
    const sm = getSyncManual();
    const visN = (sm.mode === "manual" && sm.visibleWordsOverride) ? sm.visibleWordsOverride : autoVisible;
    const bwv = sync.bitWindowView || { start: 0, end: 0 };
    const opts = [1, 2, 3].map((n) => `<option value="${n}"${n === visN ? " selected" : ""}>${n}</option>`).join("");
    return `<section class="sync-fragment-control sync-fragment-control--compact" data-sync-control>
      <header class="sync-fragment-control__header">
        <span class="sync-fragment-control__title">Сквозной фрагмент</span>
        <span class="sync-fragment-control__summary">${syncInfoString()}</span>
      </header>
      <div class="sync-fragment-control__fields">
        <label class="sync-field"><span>Начальное слово k</span>
          <input type="number" step="1" min="0" max="${Math.max(0, maxK - 1)}" value="${sw.start}" data-sync-control-input="wordStartK" />
        </label>
        <label class="sync-field"><span>Показать слов</span>
          <select data-sync-control-input="visibleWords">${opts}</select>
        </label>
      </div>
      <p class="sync-fragment-control__hint">Биты r = ${bwv.start}…${bwv.end}. Управление идёт целыми кодовыми словами.</p>
    </section>`;
  }

  // Информационный блок без полей (например, для карточки 2).
  function renderSyncInfoOnly() {
    return `<section class="sync-fragment-control sync-fragment-control--compact" data-sync-control>
      <header class="sync-fragment-control__header">
        <span class="sync-fragment-control__title">Сквозной фрагмент</span>
        <span class="sync-fragment-control__summary">${syncInfoString()}</span>
      </header>
    </section>`;
  }

  // Возвращает HTML контроля для данного этапа или пустую строку.
  function renderSyncControl(stageId, params, SignalData) {
    const kind = syncControlKind(stageId);
    if (!kind) return "";
    if (kind === "main") return renderSyncMainControl(params, SignalData);
    if (kind === "info") return renderSyncInfoOnly();
    if (kind === "samples") return renderSyncSamplesControl();
    if (kind === "words") return renderSyncWordsControl();
    return "";
  }

  // Обработчик событий от контролов фрагмента.
  function handleSyncControlChange(event) {
    const target = event.target;
    const mode = target.dataset.syncControlMode;
    const inputKey = target.dataset.syncControlInput;
    if (!mode && !inputKey) return;

    // Кнопка режима
    if (mode === "auto") {
      applySyncChange((sm) => { sm.mode = "auto"; sm.visibleWordsOverride = null; });
      return;
    }
    if (mode === "manual") {
      // Резервное заполнение значений из текущего sync.timeWindow, если поля пусты.
      applySyncChange((sm) => {
        sm.mode = "manual";
        if (!Number.isFinite(sm.timeStartMs) || !Number.isFinite(sm.timeEndMs)) {
          const cur = currentSyncTimeWindowMs();
          sm.timeStartMs = sm.timeStartMs != null ? sm.timeStartMs : cur.start;
          sm.timeEndMs = sm.timeEndMs != null ? sm.timeEndMs : cur.end;
        }
      });
      return;
    }

    // Ввод значений — автоматически переключаемся в ручной режим.
    if (inputKey) {
      const vm = window.VisualMath;
      const N = SignalData.N || (SignalData.g_t || []).length;
      const indices = SignalData.sampled_x_indices || [];
      const value = target.value;

      if (inputKey === "timeStartMs" || inputKey === "timeEndMs") {
        const v = parseFloat(value);
        if (!Number.isFinite(v)) return;
        applySyncChange((sm) => {
          sm.mode = "manual";
          if (inputKey === "timeStartMs") sm.timeStartMs = v;
          else sm.timeEndMs = v;
          // Нормализуем: start ≤ end
          if (Number.isFinite(sm.timeStartMs) && Number.isFinite(sm.timeEndMs) && sm.timeStartMs > sm.timeEndMs) {
            const tmp = sm.timeStartMs; sm.timeStartMs = sm.timeEndMs; sm.timeEndMs = tmp;
          }
        });
      } else if (inputKey === "kStart" || inputKey === "kEnd") {
        const k = parseInt(value, 10);
        if (!Number.isFinite(k)) return;
        applySyncChange((sm) => {
          sm.mode = "manual";
          // Берём другой конец из текущего sampleWindow.
          const sw = (SignalData.sync && SignalData.sync.sampleWindow) || { start: 0, end: indices.length };
          let kStart = (inputKey === "kStart") ? k : sw.start;
          let kEnd = (inputKey === "kEnd") ? k : sw.end;
          if (kStart < 0) kStart = 0;
          if (kEnd > indices.length) kEnd = indices.length;
          if (kEnd <= kStart) kEnd = kStart + 1;
          const idxStart = indices[kStart] != null ? indices[kStart] : 0;
          const idxEnd = indices[kEnd] != null ? indices[kEnd] : (SignalData.N || (SignalData.g_t || []).length);
          const paramsLocal = getParameters();
          sm.timeStartMs = vm.indexToTimeMs(Math.min(N - 1, idxStart), N, paramsLocal);
          sm.timeEndMs = vm.indexToTimeMs(Math.min(N, idxEnd), N, paramsLocal);
        });
      } else if (inputKey === "wordStartK" || inputKey === "visibleWords") {
        let wordStartK = null, visN = null;
        if (inputKey === "wordStartK") wordStartK = parseInt(value, 10);
        if (inputKey === "visibleWords") visN = parseInt(value, 10);
        applySyncChange((sm) => {
          sm.mode = "manual";
          const sw = (SignalData.sync && SignalData.sync.sampleWindow) || { start: 0, end: indices.length };
          const wsK = (wordStartK != null) ? wordStartK : sw.start;
          const n = (visN != null) ? visN : (sm.visibleWordsOverride || Math.max(1, Math.floor(12 / (SignalData.quantization_mu || 1))));
          sm.visibleWordsOverride = Math.max(1, Math.min(3, n));
          const kStart = Math.max(0, Math.min(indices.length - 1, wsK));
          const kEnd = Math.min(indices.length, kStart + sm.visibleWordsOverride);
          const idxStart = indices[kStart] != null ? indices[kStart] : 0;
          const idxEnd = indices[kEnd] != null ? indices[kEnd] : (SignalData.N || (SignalData.g_t || []).length);
          const paramsLocal = getParameters();
          sm.timeStartMs = vm.indexToTimeMs(Math.min(N - 1, idxStart), N, paramsLocal);
          sm.timeEndMs = vm.indexToTimeMs(Math.min(N, idxEnd), N, paramsLocal);
        });
      }
    }
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
    // Контрол сквозного фрагмента — добавляется над visuals.
    const syncControlHtml = renderSyncControl(stage.id, params, SignalData);

    // Формируем HTML
    let html = `<div class="stage-panel__left">`;
    html += `<div class="stage-panel__content">`;
    html += `<p class="eyebrow">Этап обработки</p><h2>${stage.title}</h2>`;
    // Мини-тракт для объединённых карточек
    const miniTractHtml = renderMiniTract(stage.id);
    if (miniTractHtml) html += miniTractHtml;
    else html += `<span class="stage-panel__signal">${stage.signal}</span>`;
    html += `</div>`;
    // Блок «Вход → Выход» с классификацией сигналов
    const signalFlowHtml = renderSignalFlowBlock(stage.id);
    if (signalFlowHtml) html += `<div class="stage-panel__content">${signalFlowHtml}</div>`;
    html += renderLearningGuide(stage, params);
    html += renderCausalBridge(stage.id);
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
      html += `<div class="stage-panel__visuals">${syncControlHtml}<div class="stage-panel__visuals-content" data-sync-svg-host>${svgContent}</div></div>`;
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
      const elements = [correlationPreview, summaryCorrelationFormula, summaryBandwidthFormula, summary].filter(Boolean);
      if (route) elements.push(route);
      if (structuralScheme) elements.push(structuralScheme);
      if (parametersForm) elements.push(parametersForm);
      // Рендерим все формулы внутри панели этапа
      const panelContent = document.querySelector('.stage-panel');
      if (panelContent) {
        elements.push(panelContent);
      }
      window.MathJax.typesetClear(elements);
      window.MathJax.typesetPromise(elements).catch((err) => console.warn('MathJax error:', err));
    }, 100);
  }

  const structuralSchemeNodes = {
    source:    { stageId: "source",    group: "source",  highlightKey: "source",    label: "Источник сообщений",             signal: SIGNAL_META.c.symbol,           variant: "terminal" },
    pp:        { stageId: "source",    group: "tx",      highlightKey: "source",    label: "Первичный преобразователь",      signal: SIGNAL_META.g.symbol },
    txFilter:  { stageId: "tx-filter", group: "tx",      highlightKey: "tx-filter", label: "ФНЧ",                            signal: SIGNAL_META.x.symbol },
    sampler:   { stageId: "sampler",   group: "tx",      highlightKey: "sampler",   label: "Дискретизатор",                  signal: SIGNAL_META.sampled.symbol, sideInput: { label: "Генератор", signal: formula(String.raw`\delta(t)`) } },
    quantizer: { stageId: "quantizer", group: "tx",      highlightKey: "quantizer", label: "Квантователь",                   signal: SIGNAL_META.quantized.symbol },
    encoder:   { stageId: "encoder",   group: "tx",      highlightKey: "encoder",   label: "Кодер",                          signal: SIGNAL_META.encoded.symbol },
    modulator: { stageId: "modulator", group: "tx",      highlightKey: "modulator", label: "Модулятор",                      signal: SIGNAL_META.modulated.symbol, sideInput: { label: "Генератор", signal: SIGNAL_META.carrier.symbol } },
    pdu:       { stageId: "modulator", group: "tx",      highlightKey: "modulator", label: "Выходное устройство ПДУ",         signal: SIGNAL_META.transmitted.symbol },
    channel:   { stageId: "channel",   group: "channel", highlightKey: "channel",   label: "Линия связи / НКС",              signal: SIGNAL_META.received.symbol, sideInput: { label: "Источник помех", signal: SIGNAL_META.noise.symbol } },
    pru:       { stageId: "detector",  group: "rx",      highlightKey: "detector",  label: "Входное устройство ПРУ",         signal: SIGNAL_META.detected.symbol },
    detector:  { stageId: "detector",  group: "rx",      highlightKey: "detector",  label: "Детектор (РУ)",                  signal: SIGNAL_META.b_hat.symbol },
    decoder:   { stageId: "decoder",   group: "rx",      highlightKey: "decoder",   label: "Декодер",                        signal: SIGNAL_META.v_hat.symbol },
    interpol:  { stageId: "decoder",   group: "rx",      highlightKey: "decoder",   label: "Интерполятор",                   signal: SIGNAL_META.x_hat.symbol },
    rxFilter:  { stageId: "recipient", group: "rx",      highlightKey: "recipient", label: "ФНЧ",                            signal: SIGNAL_META.g_hat.symbol },
    output:    { stageId: "recipient", group: "rx",      highlightKey: "recipient", label: "Выходной преобразователь",        signal: SIGNAL_META.c_hat.symbol },
    recipient: { stageId: "recipient", group: "rx",      highlightKey: "recipient", label: "Получатель",                     signal: SIGNAL_META.c_hat.symbol,       variant: "terminal" },
  };

  function renderStructuralScheme() {
    if (!workspaceLayout || !workspaceShell) return;
    structuralScheme = document.createElement("section");
    structuralScheme.id = "scheme";
    structuralScheme.className = "spi-structure";
    structuralScheme.innerHTML = `<div class="spi-structure__summary">
      <span><small>Опорная схема системы</small><strong>Структурная схема СПИ</strong></span>
    </div>
    <div class="spi-structure__body">
      <div class="spi-structure__legend" aria-label="Группы структурной схемы">
        <span data-group="source"><i></i>Источник</span>
        <span data-group="tx"><i></i>ПДУ</span>
        <span data-group="channel"><i></i>НКС</span>
        <span data-group="rx"><i></i>ПРУ</span>
      </div>
      <div class="spi-structure__scroll" aria-label="Структурная схема">
        <div class="spi-structure__canvas" role="list"></div>
      </div>
      <p class="spi-structure__hint">Нажмите на блок, чтобы перейти к его карточке. Подсвеченные блоки соответствуют выбранному этапу.</p>
    </div>`;

    const canvas = structuralScheme.querySelector(".spi-structure__canvas");

    const setHighlightData = (el, key, group) => {
      el.dataset.highlightKey = key;
      if (group) el.dataset.group = group;
      return el;
    };

    const createNode = (node) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = "spi-node" + (node.variant ? ` spi-node--${node.variant}` : "");
      block.dataset.stageId = node.stageId;
      block.dataset.group = node.group;
      block.dataset.highlightKey = node.highlightKey;
      block.setAttribute("role", "listitem");
      block.setAttribute("aria-label", `${node.label}. Открыть этап.`);
      block.innerHTML = `<span class="spi-node__label">${node.label}</span>`;
      block.addEventListener("click", () => selectStage(node.stageId));
      return block;
    };

    const createAuxNode = (node, side) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = "spi-node spi-node--aux";
      block.dataset.stageId = node.stageId;
      block.dataset.group = node.group;
      block.dataset.highlightKey = node.highlightKey;
      block.setAttribute("aria-label", `${side.label}. Входной сигнал.`);
      block.innerHTML = `<span class="spi-node__label">${side.label}</span>`;
      block.addEventListener("click", () => selectStage(node.stageId));
      return block;
    };

    const createConnector = (signal, arrow, vertical, options = {}) => {
      const connector = document.createElement("span");
      connector.className = "spi-connector" + (vertical ? " spi-connector--vertical" : "") + (options.reverse ? " spi-connector--reverse" : "");
      connector.setAttribute("aria-hidden", "true");
      connector.innerHTML = `<span>${signal || ""}</span><i>${arrow}</i>`;
      if (options.highlightKey) setHighlightData(connector, options.highlightKey, options.group);
      return connector;
    };

    const createSideStack = (node) => {
      const stack = document.createElement("div");
      stack.className = "spi-node-stack";
      stack.append(createAuxNode(node, node.sideInput));
      stack.append(createConnector(node.sideInput.signal, "↓", true, { highlightKey: node.highlightKey, group: node.group }));
      stack.append(createNode(node));
      return stack;
    };

    const createGroupBox = (nodes, key, label, rtl) => {
      const group = document.createElement("div");
      group.className = `spi-group-box spi-group-box--${key}`;
      group.dataset.group = nodes[0].group;
      group.dataset.zone = key;
      const sharedHighlightKey = nodes.every((node) => node.highlightKey === nodes[0].highlightKey) ? nodes[0].highlightKey : "";
      if (sharedHighlightKey) group.dataset.highlightKey = sharedHighlightKey;
      if (label) {
        const lbl = document.createElement("span");
        lbl.className = "spi-group-box__label";
        lbl.textContent = label;
        group.append(lbl);
      }
      const inner = document.createElement("div");
      inner.className = "spi-group-box__inner";
      const ordered = rtl ? nodes.slice().reverse() : nodes;
      ordered.forEach((n, i) => {
        inner.append(n.sideInput ? createSideStack(n) : createNode(n));
        if (i < ordered.length - 1) {
          const signalSource = rtl ? ordered[i + 1] : ordered[i];
          inner.append(createConnector(signalSource.signal, rtl ? "←" : "→", false, {
            highlightKey: signalSource.highlightKey,
            group: signalSource.group,
            reverse: rtl,
          }));
        }
      });
      group.append(inner);
      return group;
    };

    const createZone = (key, label, group) => {
      const zone = document.createElement("div");
      zone.className = `spi-zone spi-zone--${key}`;
      zone.dataset.group = group;
      zone.setAttribute("aria-hidden", "true");
      zone.innerHTML = `<span>${label}</span>`;
      return zone;
    };

    const place = (el, row, col, rowSpan, colSpan) => {
      el.style.gridRow = `${row} / span ${rowSpan || 1}`;
      el.style.gridColumn = `${col} / span ${colSpan || 1}`;
      canvas.append(el);
    };

    const n = structuralSchemeNodes;

    place(createZone("pdu-zone", "ПДУ", "tx"), 1, 4, 2, 21);
    place(createZone("nks", "НКС", "channel"), 3, 22, 3, 5);
    place(createZone("pru-zone", "ПРУ", "rx"), 5, 6, 2, 19);

    // Верхняя ветвь: Источник -> ПП -> ФНЧ -> АЦП -> Модулятор -> ПДУ.
    place(createNode(n.source), 2, 1, 1, 2);
    place(createConnector(n.source.signal, "→", false, { highlightKey: n.source.highlightKey, group: n.source.group }), 2, 3);
    place(createNode(n.pp), 2, 4, 1, 2);
    place(createConnector(n.pp.signal, "→", false, { highlightKey: n.source.highlightKey, group: n.pp.group }), 2, 6);
    place(createNode(n.txFilter), 2, 7, 1, 2);
    place(createConnector(n.txFilter.signal, "→", false, { highlightKey: n.txFilter.highlightKey, group: n.txFilter.group }), 2, 9);
    place(createGroupBox([n.sampler, n.quantizer, n.encoder], "adc", "АЦП", false), 1, 10, 2, 8);
    place(createConnector(n.encoder.signal, "→", false, { highlightKey: n.encoder.highlightKey, group: n.encoder.group }), 2, 18);
    place(createGroupBox([n.modulator, n.pdu], "pdu", "", false), 1, 19, 2, 6);

    // Правый вертикальный канал: ПДУ -> S(t) -> линия связи / НКС -> z(t) -> ПРУ.
    place(createConnector(n.pdu.signal, "↓", true, { highlightKey: n.channel.highlightKey, group: n.channel.group }), 3, 23);
    place(createNode(n.channel), 4, 23, 1, 2);
    place(createConnector(n.channel.signal, "↓", true, { highlightKey: n.channel.highlightKey, group: n.channel.group }), 5, 23);
    place(createNode(n.pru), 6, 23, 1, 2);
    place(createConnector(n.channel.sideInput.signal, "←", false, { highlightKey: n.channel.highlightKey, group: n.channel.group, reverse: true }), 4, 25);
    place(createAuxNode(n.channel, n.channel.sideInput), 4, 26);

    // Нижняя ветвь читается справа налево: ПРУ -> детектор -> ЦАП -> ФНЧ -> преобразователь -> получатель.
    place(createNode(n.recipient), 6, 3, 1, 2);
    place(createConnector(n.output.signal, "←", false, { highlightKey: n.recipient.highlightKey, group: n.recipient.group, reverse: true }), 6, 5);
    place(createNode(n.output), 6, 6, 1, 2);
    place(createConnector(n.rxFilter.signal, "←", false, { highlightKey: n.recipient.highlightKey, group: n.recipient.group, reverse: true }), 6, 8);
    place(createNode(n.rxFilter), 6, 9, 1, 2);
    place(createConnector(n.interpol.signal, "←", false, { highlightKey: n.decoder.highlightKey, group: n.decoder.group, reverse: true }), 6, 11);
    place(createGroupBox([n.decoder, n.interpol], "dac", "ЦАП", true), 6, 12, 1, 6);
    place(createConnector(n.detector.signal, "←", false, { highlightKey: n.detector.highlightKey, group: n.detector.group, reverse: true }), 6, 18);
    place(createNode(n.detector), 6, 19, 1, 3);
    place(createConnector(n.pru.signal, "←", false, { highlightKey: n.detector.highlightKey, group: n.detector.group, reverse: true }), 6, 22);

    workspaceShell.insertBefore(structuralScheme, workspaceLayout);
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
    SignalData.lastParamsString = null;
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
      createSummaryItem(values.modulation === "DCHM" ? formula(String.raw`f_2`) : formula(String.raw`f_0`), values.primaryFrequency, "МГц"),
      ...(values.modulation === "DCHM" ? [createSummaryItem(formula(String.raw`f_1`), values.secondaryFrequency, "МГц")] : []),
      createSummaryItem("Приём", receptionLabel)
    );
    renderMath();
  }

function handleParametersChange(event) {
    if (event.target.name === "variantPreset") { applyVariant(event.target.value); return; }
    if (!isApplyingVariant) variantPreset.value = "custom";
    if (["modulation", "reception"].includes(event.target.name)) SignalData.lastParamsString = null;
    if (event.target.name === "modulation") updateConditionalFields();
    if (["beta", "bandwidthFactor"].includes(event.target.name)) updateDerivedFields();
    // При изменении физических параметров сбрасываем ручной выбор фрагмента в авто,
    // чтобы окно пересчиталось под новую реализацию g(t).
    if (SignalData.syncManual) { SignalData.syncManual.mode = "auto"; SignalData.syncManual.visibleWordsOverride = null; }
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
    const formControl = parametersForm.elements[name];
    if (!formControl) return;
    formControl.value = String(value);
    if (["modulation", "reception"].includes(name)) SignalData.lastParamsString = null;
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
    document.querySelectorAll(".spi-node").forEach((node) => {
      const activeKey = {
        source: "source",
        "tx-filter": "tx-filter",
        sampler: "sampler",
        quantizer: "quantizer",
        encoder: "encoder",
        modulator: "modulator",
        channel: "channel",
        detector: "detector",
        decoder: "decoder",
        recipient: "recipient",
      }[stage.id] || stage.id;
      const isActive = node.dataset.highlightKey === activeKey;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-pressed", String(isActive));
      if (isActive) {
        node.setAttribute("aria-current", "step");
      }
      else node.removeAttribute("aria-current");
    });
    document.querySelectorAll(".spi-connector, .spi-group-box").forEach((el) => {
      const activeKey = {
        source: "source",
        "tx-filter": "tx-filter",
        sampler: "sampler",
        quantizer: "quantizer",
        encoder: "encoder",
        modulator: "modulator",
        channel: "channel",
        detector: "detector",
        decoder: "decoder",
        recipient: "recipient",
      }[stage.id] || stage.id;
      el.classList.toggle("is-active", el.dataset.highlightKey === activeKey);
    });
    renderPanel(stage);
  }

  function init() {
    renderVariantOptions(); updateConditionalFields(); updateDerivedFields();
    renderParametersSummary(); renderRoute(); renderStructuralScheme(); selectStage(stages[0].id);
    year.textContent = new Date().getFullYear();
    parametersForm.addEventListener("input", handleParametersChange);
    parametersForm.addEventListener("change", handleParametersChange);
    panel.addEventListener("input", handleStageControlChange);
    panel.addEventListener("change", handleStageControlChange);
    panel.addEventListener("input", handleSyncControlChange);
    panel.addEventListener("change", handleSyncControlChange);
    panel.addEventListener("click", handleSyncControlChange);
    window.addEventListener("load", renderMath);
  }

  init();
})();
