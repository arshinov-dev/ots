const stages = [
  {
    id: "source",
    title: "Источник и первичный преобразователь",
    group: "source",
    signal: "c(t) → g(t)",
  },
  {
    id: "tx-filter",
    title: "Передающий ФНЧ",
    group: "tx",
    signal: "g(t) → x(t)",
  },
  {
    id: "sampler",
    title: "Дискретизатор АЦП",
    group: "tx",
    signal: "x(t) → x(k · Δt)",
  },
  {
    id: "quantizer",
    title: "Квантователь АЦП",
    group: "tx",
    signal: "x(k · Δt) → vₖʲ",
  },
  {
    id: "encoder",
    title: "Кодер АЦП",
    group: "tx",
    signal: "vₖʲ → bₖᵘ",
  },
  {
    id: "modulator",
    title: "Модулятор и выход ПДУ",
    group: "tx",
    signal: "bₖᵘ + uₙ(t) → S(t)",
  },
  {
    id: "channel",
    title: "Непрерывный канал связи",
    group: "channel",
    signal: "S(t) + n(t) → z(t)",
  },
  {
    id: "detector",
    title: "Вход ПРУ, детектор и РУ",
    group: "rx",
    signal: "z(t) → b̂ₖᵘ",
  },
  {
    id: "decoder",
    title: "Декодер и интерполятор ЦАП",
    group: "rx",
    signal: "b̂ₖᵘ → x̂(t)",
  },
  {
    id: "recipient",
    title: "Приёмный ФНЧ и получатель",
    group: "rx",
    signal: "x̂(t) → ĉ(t)",
  },
];

const route = document.querySelector("[data-signal-route]");
const panel = document.querySelector("[data-stage-panel]");
const year = document.querySelector("[data-current-year]");

function getStage(stageId) {
  return stages.find((stage) => stage.id === stageId) ?? stages[0];
}

function createStageCard(stage, index) {
  const card = document.createElement("button");
  card.className = "stage-card";
  card.type = "button";
  card.dataset.stageId = stage.id;
  card.dataset.group = stage.group;
  card.setAttribute("aria-pressed", "false");

  card.innerHTML = `
    <span class="stage-card__index">${String(index + 1).padStart(2, "0")}</span>
    <strong class="stage-card__title">${stage.title}</strong>
    <span class="stage-card__signal">${stage.signal}</span>
    <span class="stage-card__status">Ожидает исследования</span>
  `;

  card.addEventListener("click", () => selectStage(stage.id));
  return card;
}

function renderRoute() {
  const fragment = document.createDocumentFragment();

  stages.forEach((stage, index) => {
    fragment.append(createStageCard(stage, index));
  });

  route.replaceChildren(fragment);
}

function renderPanel(stage) {
  panel.dataset.group = stage.group;
  panel.innerHTML = `
    <div class="stage-panel__content">
      <p class="eyebrow">Выбранный этап</p>
      <h2>${stage.title}</h2>
      <span class="stage-panel__signal">${stage.signal}</span>
      <p>
        Этот блок пока не реализован. Перед началом работы нужно изучить
        относящиеся к нему разделы методических указаний, выписать формулы
        и определить обязательные графики преобразования сигнала.
      </p>
    </div>

    <div class="stage-panel__placeholder" aria-label="Место для будущего графика">
      <div>
        <strong>Область будущей визуализации</strong>
        <p>Здесь появится график изменения сигнала на выбранном этапе.</p>
      </div>
    </div>
  `;
}

function selectStage(stageId) {
  const stage = getStage(stageId);

  document.querySelectorAll(".stage-card").forEach((card) => {
    const isActive = card.dataset.stageId === stage.id;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
  });

  renderPanel(stage);
}

function init() {
  renderRoute();
  selectStage(stages[0].id);
  year.textContent = new Date().getFullYear();
}

init();
