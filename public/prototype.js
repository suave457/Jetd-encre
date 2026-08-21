(() => {
  "use strict";

  const FRAME_NAMES = {
    studio: {
      desktop: "W03_01_ADM_StudioContenus_D_1440x900",
      tablet: "W03_01_ADM_StudioContenus_T_1024x768",
    },
    library: {
      desktop: "W03_02_ADM_Bibliotheque_D_1440x900",
      tablet: "W03_02_ADM_Bibliotheque_T_1024x768",
    },
  };

  const RECORD_SELECTOR =
    '[data-pencil-name^="Ligne contenu"], [data-pencil-name^="Carte contenu tablette"]';
  const state = {
    view: "library",
    query: "",
    status: "Tous",
    filters: {
      type: "Tous",
      audience: "Toutes",
      level: "Tous",
    },
    sort: "Dernière modification",
    sortTouched: false,
    page: 1,
    selected: new Set(),
    copyCounter: 0,
    toastTimer: null,
    openPopover: null,
  };

  const STATUS_OPTIONS = ["Tous", "Brouillons", "En revue", "Planifiés", "Publiés", "Archivés"];
  const SORT_OPTIONS = ["Dernière modification", "Plus ancienne", "Titre A–Z", "Titre Z–A"];
  const STATUS_STYLES = {
    Brouillons: { label: "Brouillon", background: "#FFF1D5", color: "#B66A2C" },
    "En revue": { label: "En revue", background: "#EAF0F6", color: "#2E5F86" },
    Planifiés: { label: "Planifié", background: "#FFF1D5", color: "#051223" },
    Publiés: { label: "Publié", background: "#E8F3F1", color: "#2F7563" },
    Archivés: { label: "Archivé", background: "#F0ECE8", color: "#6B6258" },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pencilName = (element) => element?.getAttribute("data-pencil-name") || "";

  function stripAccents(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizeStatus(value) {
    const normalized = stripAccents(value);
    if (normalized.includes("brouillon")) return "Brouillons";
    if (normalized.includes("revue")) return "En revue";
    if (normalized.includes("planifi")) return "Planifiés";
    if (normalized.includes("publie")) return "Publiés";
    if (normalized.includes("archive")) return "Archivés";
    return "Tous";
  }

  function recordIdFrom(value) {
    const match = String(value || "").match(/\b(?:DOC|POD|BLOG|JEU|EBOOK|VID|COPY)-[A-Z0-9-]+\b/i);
    return match?.[0] || "";
  }

  function getRecordId(record) {
    return record?.dataset.prototypeRecordId || recordIdFrom(pencilName(record));
  }

  function getRecordTitle(record) {
    if (!record) return "ce contenu";
    const id = getRecordId(record);
    const exact = id
      ? $(`[data-pencil-name="Titre contenu ${CSS.escape(id)}"], [data-pencil-name="Titre carte tablette ${CSS.escape(id)}"]`, record)
      : null;
    const fallback = $('[data-pencil-name^="Titre contenu"], [data-pencil-name^="Titre carte tablette"]', record);
    return (exact || fallback)?.textContent?.trim() || "ce contenu";
  }

  function getRecordStatus(record) {
    if (!record) return "Tous";
    if (record.dataset.prototypeStatus) return record.dataset.prototypeStatus;
    const label = $('[data-pencil-name^="Libellé statut"]', record);
    return normalizeStatus(label?.textContent || record.textContent);
  }

  function compactText(element) {
    return element?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function extractLevel(value) {
    const text = compactText({ textContent: value });
    if (/tous niveaux/i.test(text)) return "Tous niveaux";
    const aep = text.match(/\b([1-6]e(?:\s*[–-]\s*[1-6]e)?\s*AEP)\b/i);
    if (aep) return aep[1].replace(/\s*[–-]\s*/g, "–").replace(/\s+/g, " ");
    const cycle = text.match(/\b(Collège|Lycée|Préscolaire)\b/i);
    return cycle ? cycle[1] : "Tous niveaux";
  }

  function extractAudiences(value) {
    const normalized = stripAccents(value);
    return ["Élèves", "Enseignants", "Parents"].filter((audience) =>
      normalized.includes(stripAccents(audience)),
    );
  }

  function parseFrenchDate(value) {
    const normalized = stripAccents(value).replace(/·/g, " ");
    const months = {
      janvier: 0,
      fevrier: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      aout: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      decembre: 11,
    };
    const match = normalized.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
    const time = normalized.match(/(\d{1,2})\s*h\s*(\d{1,2})?/);
    if (!match || !(match[2] in months)) return 0;
    return new Date(
      Number(match[3] || 2026),
      months[match[2]],
      Number(match[1]),
      Number(time?.[1] || 0),
      Number(time?.[2] || 0),
    ).getTime();
  }

  function recordMetadata(record) {
    const type = compactText(
      $('[data-pencil-name^="Valeur type "], [data-pencil-name^="Libellé type carte tablette "]', record),
    );
    const audienceText = compactText(
      $('[data-pencil-name^="Valeur audience "], [data-pencil-name^="Valeur Audience carte tablette "]', record),
    );
    const dateText = compactText(
      $('[data-pencil-name^="Valeur modification "], [data-pencil-name^="Valeur Date carte tablette "]', record),
    );
    return {
      type: type || "Autre",
      audiences: extractAudiences(audienceText),
      level: extractLevel(audienceText),
      timestamp: parseFrenchDate(dateText),
    };
  }

  function statusForId(id) {
    const record = $$(RECORD_SELECTOR).find((candidate) => getRecordId(candidate) === id);
    return getRecordStatus(record);
  }

  function getDevice() {
    return window.innerWidth >= 1200 ? "desktop" : "tablet";
  }

  function getFrame(view = state.view, device = getDevice()) {
    return $(`[data-pencil-name="${FRAME_NAMES[view][device]}"]`);
  }

  function resizeStage() {
    const device = getDevice();
    const width = device === "desktop" ? 1440 : 1024;
    const height = device === "desktop" ? 900 : 768;
    const scale = Math.min(1, window.innerWidth / width, window.innerHeight / height);
    document.documentElement.style.setProperty("--prototype-width", `${width}px`);
    document.documentElement.style.setProperty("--prototype-height", `${height}px`);
    document.documentElement.style.setProperty("--prototype-scale", String(Math.max(0.25, scale)));
  }

  function renderFrame() {
    $$('[data-pencil-name^="W03_"]').forEach((frame) => {
      frame.classList.toggle("prototype-active", frame === getFrame());
      frame.setAttribute("aria-hidden", frame === getFrame() ? "false" : "true");
    });
    resizeStage();
    syncInputs();
    renderTabs();
    renderFilterControls();
    renderPagination();
    renderSelection();
    document.title =
      state.view === "library"
        ? "Bibliothèque de contenus — Jet d’Encre"
        : "Studio de contenus — Jet d’Encre";
  }

  function setView(view, editorContext = null) {
    state.view = view;
    if (view === "studio") updateStudio(editorContext || { mode: "new" });
    renderFrame();
    window.location.hash = view === "library" ? "bibliotheque" : "studio";
  }

  function rememberOriginalText(element) {
    if (element && !element.dataset.prototypeOriginalText) {
      element.dataset.prototypeOriginalText = element.textContent.trim();
    }
  }

  function updateStudio(context) {
    const mode = context?.mode || "new";
    const title = context?.title || "Les voix du Maroc · Épisode 01";
    const status = context?.status || "Brouillons";

    const headings = [
      $('[data-pencil-name="Titre Créer un contenu"]'),
      $('[data-pencil-name="Titre Studio tablette"]'),
    ].filter(Boolean);
    const contentTitles = [
      $('[data-pencil-name="Titre contenu Podcast"]'),
      $('[data-pencil-name="Valeur titre public Podcast"]'),
      $('[data-pencil-name="Titre Podcast tablette"]'),
      $('[data-pencil-name="Valeur titre Podcast tablette"]'),
    ].filter(Boolean);

    [...headings, ...contentTitles].forEach(rememberOriginalText);

    headings.forEach((heading) => {
      if (mode === "new") {
        heading.textContent = heading.dataset.prototypeOriginalText;
      } else {
        heading.textContent = "Modifier un contenu";
      }
    });
    contentTitles.forEach((element) => {
      element.textContent = mode === "new" ? element.dataset.prototypeOriginalText : title;
    });

    const statusLabel = normalizeStatus(status).replace(/s$/, "").toUpperCase();
    $$('[data-pencil-name="Texte statut Brouillon"], [data-pencil-name="Texte Brouillon tablette"]').forEach(
      (element) => {
        rememberOriginalText(element);
        element.textContent = mode === "new" ? element.dataset.prototypeOriginalText : statusLabel;
      },
    );
  }

  function makeInteractive(element, label, role = "button") {
    if (!element) return;
    element.classList.add("prototype-interactive");
    element.setAttribute("role", role);
    element.setAttribute("tabindex", "0");
    if (label) {
      element.setAttribute("aria-label", label);
      element.setAttribute("title", label);
    }
    $$('svg', element).forEach((icon) => icon.setAttribute("aria-hidden", "true"));
  }

  function setupAccessibleControls() {
    document.documentElement.lang = "fr";

    const labels = [
      ['[data-pencil-name="Navigation Admin · Bibliothèque"]', "Ouvrir la Bibliothèque"],
      ['[data-pencil-name="Rail Admin · Bibliothèque"]', "Ouvrir la Bibliothèque"],
      ['[data-pencil-name="Navigation Admin · Studio de contenus"]', "Ouvrir le Studio de contenus"],
      ['[data-pencil-name="Rail Admin · Studio"]', "Ouvrir le Studio de contenus"],
      ['[data-pencil-name="Action Nouveau contenu"]', "Créer un nouveau contenu"],
      ['[data-pencil-name="Action Nouveau contenu tablette"]', "Créer un nouveau contenu"],
      ['[data-pencil-name="Action Importer des contenus"]', "Importer des contenus"],
      ['[data-pencil-name="Action Importer tablette"]', "Importer des contenus"],
      ['[data-pencil-name="Action Filtres tablette"]', "Afficher les filtres"],
      ['[data-pencil-name="Topbar/Notifications"]', "Consulter les notifications"],
      ['[data-pencil-name="Topbar/Profil"]', "Ouvrir le profil administrateur"],
    ];
    labels.forEach(([selector, label]) => $$(selector).forEach((element) => makeInteractive(element, label)));

    $$('[data-pencil-name^="Action Modifier"], [data-pencil-name^="Action tablette Modifier"]').forEach(
      (element) => {
        if (!element.closest(RECORD_SELECTOR)) return;
        makeInteractive(element, `Modifier ${recordIdFrom(pencilName(element))}`);
      },
    );
    $$('[data-pencil-name^="Action Dupliquer"], [data-pencil-name^="Action tablette Dupliquer"]').forEach(
      (element) => makeInteractive(element, `Dupliquer ${recordIdFrom(pencilName(element))}`),
    );
    $$('[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]').forEach(
      (element) => {
        const record = element.closest(RECORD_SELECTOR);
        const archived = record && getRecordStatus(record) === "Archivés";
        makeInteractive(
          element,
          `${archived ? "Restaurer" : "Archiver"} ${recordIdFrom(pencilName(element))}`,
        );
      },
    );
    $$('[data-pencil-name^="Filtre statut ·"], [data-pencil-name^="Filtre tablette ·"]').forEach(
      (element) => {
        const status = pencilName(element).split("·").pop().trim();
        element.dataset.prototypeStatusFilter = status;
        makeInteractive(element, `Filtrer par statut : ${status}`);
      },
    );
    $$('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]').forEach((element) => {
      const suffix = pencilName(element).split(" ").pop();
      if (suffix !== "…") makeInteractive(element, `Aller à la page ${suffix}`);
    });
  }

  function updateArchiveAction(record) {
    const archived = getRecordStatus(record) === "Archivés";
    const id = getRecordId(record);
    const action = $(
      '[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]',
      record,
    );
    if (!action) return;
    action.dataset.prototypeArchiveMode = archived ? "restore" : "archive";
    action.setAttribute("aria-label", `${archived ? "Restaurer" : "Archiver"} ${id}`);
    action.setAttribute("title", `${archived ? "Restaurer" : "Archiver"} ${id}`);
    const label = $('[data-pencil-name^="Libellé action tablette Archiver"]', action);
    if (label) {
      label.textContent = archived ? "Restaurer" : "Archiver";
      label.style.color = archived ? "#2F7563" : "#BA6544";
    }
    $$('path', action).forEach((path) => path.setAttribute("fill", archived ? "#2F7563" : "#BA6544"));
  }

  function setRecordStatus(record, status) {
    const normalized = normalizeStatus(status);
    const visual = STATUS_STYLES[normalized] || STATUS_STYLES.Brouillons;
    record.dataset.prototypeStatus = normalized;
    record.dataset.prototypeArchived = normalized === "Archivés" ? "true" : "false";
    record.classList.remove("prototype-archived");
    const label = $('[data-pencil-name^="Libellé statut"]', record);
    if (label) {
      label.textContent = visual.label;
      label.style.color = visual.color;
    }
    const container = $('[data-pencil-name^="Statut "]', record);
    if (container) container.style.backgroundColor = visual.background;
    $$('[data-pencil-name^="Icône statut"] path', record).forEach((path) =>
      path.setAttribute("fill", visual.color),
    );
    updateArchiveAction(record);
    record.dataset.prototypeSearchText = stripAccents(record.textContent);
    record.setAttribute("aria-label", `${getRecordTitle(record)}, ${normalized}`);
  }

  function annotateRecord(record) {
    const id = getRecordId(record);
    if (!id) return;
    record.dataset.prototypeRecordId = id;
    record.dataset.prototypeStatus = getRecordStatus(record);
    const metadata = recordMetadata(record);
    record.dataset.prototypeType = metadata.type;
    record.dataset.prototypeAudiences = metadata.audiences.join("|");
    record.dataset.prototypeLevel = metadata.level;
    record.dataset.prototypeTimestamp = String(metadata.timestamp || 0);
    if (!record.dataset.prototypeOriginalOrder) {
      record.dataset.prototypeOriginalOrder = String($$(RECORD_SELECTOR).indexOf(record));
    }
    record.dataset.prototypeSearchText = stripAccents(record.textContent);
    const title = getRecordTitle(record);
    record.setAttribute("aria-label", `${title}, ${record.dataset.prototypeStatus}`);

    const isTablet = pencilName(record).startsWith("Carte contenu tablette");
    const checkbox = isTablet
      ? $('[data-pencil-name="Case à cocher sélection carte tablette"]', record)
      : $('[data-pencil-name^="Case à cocher "]', record);
    if (checkbox) {
      checkbox.classList.add("prototype-select-toggle");
      checkbox.dataset.prototypeSelectId = id;
      makeInteractive(checkbox, `Sélectionner ${title}`, "checkbox");
      checkbox.setAttribute("aria-checked", "false");
    }
    if (record.dataset.prototypeStatus === "Archivés" && !record.dataset.prototypePreviousStatus) {
      record.dataset.prototypePreviousStatus = "Brouillons";
    }
    updateArchiveAction(record);
  }

  function setupRecords() {
    $$(RECORD_SELECTOR).forEach(annotateRecord);
    const selectAll = $('[data-pencil-name="Sélectionner tous les contenus"]');
    if (selectAll) {
      selectAll.classList.add("prototype-select-toggle");
      makeInteractive(selectAll, "Sélectionner tous les contenus visibles", "checkbox");
      selectAll.setAttribute("aria-checked", "false");
    }
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function filterOptions(kind) {
    const source = $$(RECORD_SELECTOR, getFrame("library", "desktop"));
    if (kind === "type") return ["Tous", ...uniqueValues(source.map((record) => record.dataset.prototypeType))];
    if (kind === "audience") {
      const available = new Set(source.flatMap((record) => record.dataset.prototypeAudiences.split("|").filter(Boolean)));
      return ["Toutes", ...["Élèves", "Enseignants", "Parents"].filter((value) => available.has(value))];
    }
    if (kind === "level") {
      return ["Tous", ...uniqueValues(source.map((record) => record.dataset.prototypeLevel))];
    }
    if (kind === "status") return STATUS_OPTIONS;
    return SORT_OPTIONS;
  }

  function currentFilterValue(kind) {
    if (kind === "status") return state.status;
    if (kind === "sort") return state.sort;
    return state.filters[kind];
  }

  function setStatusFilter(status, apply = true) {
    state.status = STATUS_OPTIONS.includes(status) ? status : "Tous";
    state.page = 1;
    renderTabs();
    renderFilterControls();
    renderPagination();
    if (apply) applyFilters();
  }

  function applyFilterValue(kind, value) {
    if (kind === "status") {
      setStatusFilter(value);
      return;
    }
    if (kind === "sort") {
      state.sort = value;
      state.sortTouched = true;
    }
    else state.filters[kind] = value;
    state.page = 1;
    renderFilterControls();
    renderPagination();
    applyFilters();
  }

  function closeDesktopPopover(restoreFocus = false) {
    const popover = state.openPopover;
    if (!popover) return;
    const control = popover.parentElement;
    popover.remove();
    state.openPopover = null;
    control?.setAttribute("aria-expanded", "false");
    if (restoreFocus) control?.focus();
  }

  function openDesktopPopover(control, kind) {
    const wasOpen = state.openPopover?.parentElement === control;
    closeDesktopPopover();
    if (wasOpen) return;
    const popover = document.createElement("div");
    popover.className = `prototype-filter-popover${kind === "sort" ? " prototype-filter-popover--right" : ""}`;
    popover.setAttribute("role", "listbox");
    popover.setAttribute("aria-label", control.getAttribute("aria-label") || "Options de filtre");
    filterOptions(kind).forEach((value) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "prototype-filter-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", currentFilterValue(kind) === value ? "true" : "false");
      option.textContent = value;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        applyFilterValue(kind, value);
        closeDesktopPopover(true);
      });
      popover.appendChild(option);
    });
    control.appendChild(popover);
    control.setAttribute("aria-expanded", "true");
    state.openPopover = popover;
    $("button", popover)?.focus();
  }

  function setupDesktopFilters() {
    const controls = [
      ['[data-pencil-name="Filtre Type"]', "type", "Filtrer par type"],
      ['[data-pencil-name="Filtre Statut"]', "status", "Filtrer par statut"],
      ['[data-pencil-name="Filtre Audience"]', "audience", "Filtrer par audience"],
      ['[data-pencil-name="Filtre Niveau"]', "level", "Filtrer par niveau"],
      ['[data-pencil-name="Tri Bibliothèque"]', "sort", "Trier les contenus"],
    ];
    controls.forEach(([selector, kind, label]) => {
      const control = $(selector, getFrame("library", "desktop"));
      if (!control || control.dataset.prototypeFilterKind) return;
      control.dataset.prototypeFilterKind = kind;
      control.classList.add("prototype-filter-control");
      makeInteractive(control, label);
      control.setAttribute("aria-haspopup", "listbox");
      control.setAttribute("aria-expanded", "false");
      control.addEventListener("click", (event) => {
        if (event.target.closest(".prototype-filter-option")) return;
        event.stopPropagation();
        openDesktopPopover(control, kind);
      });
    });
    document.addEventListener("click", () => closeDesktopPopover());
    renderFilterControls();
  }

  function renderFilterControls() {
    const labels = {
      type: state.filters.type === "Tous" ? "Type" : state.filters.type,
      status: state.status === "Tous" ? "Statut" : state.status,
      audience: state.filters.audience === "Toutes" ? "Audience" : state.filters.audience,
      level: state.filters.level === "Tous" ? "Niveau" : state.filters.level,
      sort: state.sort,
    };
    $$('[data-prototype-filter-kind]').forEach((control) => {
      const kind = control.dataset.prototypeFilterKind;
      const label = $(
        '[data-pencil-name^="Libellé filtre"], [data-pencil-name="Libellé tri Bibliothèque"]',
        control,
      );
      if (label) label.textContent = labels[kind];
      const active = kind !== "sort" && !["Tous", "Toutes"].includes(currentFilterValue(kind));
      control.classList.toggle("prototype-filter-control--active", active);
      control.setAttribute("aria-label", `${kind === "sort" ? "Tri" : "Filtre"} : ${labels[kind]}`);
      control.setAttribute("title", `${kind === "sort" ? "Tri" : "Filtre"} : ${labels[kind]}`);
    });

    const activeCount =
      Number(state.filters.type !== "Tous") +
      Number(state.filters.audience !== "Toutes") +
      Number(state.filters.level !== "Tous") +
      Number(state.status !== "Tous");
    $$('[data-pencil-name="Action Filtres tablette"]').forEach((button) => {
      button.setAttribute("aria-label", `Afficher les filtres${activeCount ? `, ${activeCount} actif${activeCount > 1 ? "s" : ""}` : ""}`);
      button.setAttribute("aria-expanded", $(".prototype-filter-drawer") ? "true" : "false");
      const label = $('[data-pencil-name="Libellé Filtres tablette"]', button);
      if (label) label.textContent = activeCount ? `Filtres · ${activeCount}` : "Filtres";
      button.classList.toggle("prototype-filter-control--active", activeCount > 0);
    });
  }

  function appendSelectField(form, name, labelText, options, value) {
    const field = document.createElement("label");
    field.className = "prototype-drawer__field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.name = name;
    select.setAttribute("aria-label", labelText);
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      select.appendChild(option);
    });
    select.value = value;
    field.append(label, select);
    form.appendChild(field);
    return select;
  }

  function openFilterDrawer() {
    $(".prototype-filter-drawer-backdrop")?.remove();
    const previous = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "prototype-filter-drawer-backdrop";
    backdrop.innerHTML = `
      <aside class="prototype-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="prototype-filter-drawer-title">
        <header class="prototype-drawer__header">
          <div>
            <p>Bibliothèque</p>
            <h2 id="prototype-filter-drawer-title">Filtrer les contenus</h2>
          </div>
          <button class="prototype-drawer__close" type="button">Fermer</button>
        </header>
        <form class="prototype-drawer__form"></form>
        <footer class="prototype-drawer__actions">
          <button class="prototype-drawer__reset" type="button">Réinitialiser</button>
          <button class="prototype-drawer__apply" type="button">Appliquer les filtres</button>
        </footer>
      </aside>
    `;
    const form = $(".prototype-drawer__form", backdrop);
    const selects = {
      type: appendSelectField(form, "type", "Type", filterOptions("type"), state.filters.type),
      audience: appendSelectField(
        form,
        "audience",
        "Audience",
        filterOptions("audience"),
        state.filters.audience,
      ),
      level: appendSelectField(form, "level", "Niveau", filterOptions("level"), state.filters.level),
      status: appendSelectField(form, "status", "Statut", STATUS_OPTIONS, state.status),
    };
    const close = () => {
      backdrop.remove();
      renderFilterControls();
      previous?.focus?.();
    };
    $(".prototype-drawer__close", backdrop).addEventListener("click", close);
    $(".prototype-drawer__reset", backdrop).addEventListener("click", () => {
      selects.type.value = "Tous";
      selects.audience.value = "Toutes";
      selects.level.value = "Tous";
      selects.status.value = "Tous";
      selects.type.focus();
    });
    $(".prototype-drawer__apply", backdrop).addEventListener("click", () => {
      state.filters.type = selects.type.value;
      state.filters.audience = selects.audience.value;
      state.filters.level = selects.level.value;
      setStatusFilter(selects.status.value, false);
      state.page = 1;
      close();
      renderPagination();
      applyFilters();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = $$('button, select', backdrop).filter((element) => !element.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.body.appendChild(backdrop);
    renderFilterControls();
    selects.type.focus();
  }

  function setupSearch() {
    $$('[data-pencil-name="Recherche Bibliothèque"], [data-pencil-name="Recherche Bibliothèque tablette"]').forEach(
      (container, index) => {
        container.setAttribute("role", "search");
        let input = $(".prototype-search-input", container);
        if (!input) {
          input = document.createElement("input");
          input.className = "prototype-search-input";
          input.type = "search";
          input.placeholder = "Rechercher par titre, type, auteur ou identifiant…";
          input.autocomplete = "off";
          input.setAttribute("aria-label", "Rechercher dans la bibliothèque de contenus");
          input.id = `prototype-search-${index + 1}`;
          container.appendChild(input);
          input.addEventListener("input", () => {
            state.query = input.value;
            state.page = 1;
            syncInputs(input);
            applyFilters();
            renderPagination();
          });
        }
      },
    );
  }

  function syncInputs(source = null) {
    $$(".prototype-search-input").forEach((input) => {
      if (input !== source && input.value !== state.query) input.value = state.query;
    });
  }

  function renderTabs() {
    $$('[data-prototype-status-filter]').forEach((tab) => {
      const active = tab.dataset.prototypeStatusFilter === state.status;
      tab.setAttribute("aria-pressed", active ? "true" : "false");
      tab.style.backgroundColor = active ? "#051223" : "#FFFFFF00";
      $$('div[data-pencil-name^="Libellé statut"], div[data-pencil-name^="Libellé filtre"]', tab).forEach(
        (label) => {
          label.style.color = active ? "#FAF7F3" : "#2B3548";
        },
      );
      $$('div[data-pencil-name^="Valeur compteur"]', tab).forEach((counter) => {
        counter.style.color = active ? "#D4B27A" : "#5A616F";
      });
    });
  }

  function renderPagination() {
    $$('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]').forEach((page) => {
      const suffix = pencilName(page).split(" ").pop();
      const pageNumber = Number.parseInt(suffix, 10);
      page.classList.toggle("prototype-page-active", Number.isFinite(pageNumber) && pageNumber === state.page);
      if (Number.isFinite(pageNumber)) page.setAttribute("aria-current", pageNumber === state.page ? "page" : "false");
    });
  }

  function updateTabletRowVisibility() {
    $$('[data-pencil-name^="Rangée cartes Bibliothèque tablette"], .prototype-generated-row').forEach((row) => {
      const cards = $$('[data-pencil-name^="Carte contenu tablette"]', row);
      const hasVisibleCard = cards.some(
        (card) =>
          !card.classList.contains("prototype-filtered") &&
          !card.classList.contains("prototype-paged-out"),
      );
      row.style.display = hasVisibleCard ? "flex" : "none";
    });
  }

  function sortRecords(records) {
    return [...records].sort((left, right) => {
      if (state.sort === "Titre A–Z") {
        return getRecordTitle(left).localeCompare(getRecordTitle(right), "fr", { sensitivity: "base" });
      }
      if (state.sort === "Titre Z–A") {
        return getRecordTitle(right).localeCompare(getRecordTitle(left), "fr", { sensitivity: "base" });
      }
      const leftDate = Number(left.dataset.prototypeTimestamp || 0);
      const rightDate = Number(right.dataset.prototypeTimestamp || 0);
      if (leftDate !== rightDate) return state.sort === "Plus ancienne" ? leftDate - rightDate : rightDate - leftDate;
      return Number(left.dataset.prototypeOriginalOrder || 0) - Number(right.dataset.prototypeOriginalOrder || 0);
    });
  }

  function applySort() {
    if (!state.sortTouched) return;
    const desktop = getFrame("library", "desktop");
    const desktopMarker = $('[data-pencil-name="Espace flexible Table Bibliothèque"]', desktop);
    if (desktopMarker) {
      sortRecords($$(RECORD_SELECTOR, desktop)).forEach((record) => desktopMarker.before(record));
    }

    const tablet = getFrame("library", "tablet");
    const firstRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 1"]', tablet);
    const secondRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 2"]', tablet);
    if (firstRow && secondRow) {
      sortRecords($$(RECORD_SELECTOR, tablet)).forEach((record, index) => {
        (index < 2 ? firstRow : secondRow).appendChild(record);
      });
    }
  }

  function paginateFilteredRecords() {
    [
      [getFrame("library", "desktop"), 6],
      [getFrame("library", "tablet"), 4],
    ].forEach(([frame, limit]) => {
      const matches = $$(RECORD_SELECTOR, frame).filter((record) => !record.classList.contains("prototype-filtered"));
      $$(RECORD_SELECTOR, frame).forEach((record) => record.classList.remove("prototype-paged-out"));
      matches.slice(limit).forEach((record) => record.classList.add("prototype-paged-out"));
    });
  }

  function updateEmptyStates() {
    [
      [getFrame("library", "desktop"), '[data-pencil-name="Table Bibliothèque de contenus"]'],
      [getFrame("library", "tablet"), '[data-pencil-name="Grille cartes Bibliothèque tablette"]'],
    ].forEach(([frame, containerSelector]) => {
      const container = $(containerSelector, frame);
      if (!container) return;
      container.classList.add("prototype-results-container");
      let empty = $(".prototype-empty-state", container);
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "prototype-empty-state";
        empty.setAttribute("role", "status");
        container.appendChild(empty);
      }
      const visible = $$(RECORD_SELECTOR, frame).some(
        (record) =>
          !record.classList.contains("prototype-filtered") && !record.classList.contains("prototype-paged-out"),
      );
      empty.hidden = visible;
      empty.textContent =
        state.status === "Archivés"
          ? "Aucun contenu archivé ne correspond à ces filtres."
          : "Aucun contenu ne correspond à ces filtres.";
    });
  }

  function applyFilters() {
    applySort();
    const query = stripAccents(state.query);
    $$(RECORD_SELECTOR).forEach((record) => {
      const text = record.dataset.prototypeSearchText || stripAccents(record.textContent);
      const matchesQuery = !query || text.includes(query);
      const status = getRecordStatus(record);
      const matchesStatus =
        state.status === "Archivés"
          ? status === "Archivés"
          : status !== "Archivés" && (state.status === "Tous" || status === state.status);
      const matchesType =
        state.filters.type === "Tous" ||
        stripAccents(record.dataset.prototypeType) === stripAccents(state.filters.type);
      const audiences = record.dataset.prototypeAudiences.split("|").filter(Boolean);
      const matchesAudience =
        state.filters.audience === "Toutes" || audiences.includes(state.filters.audience);
      const matchesLevel =
        state.filters.level === "Tous" ||
        stripAccents(record.dataset.prototypeLevel) === stripAccents(state.filters.level);
      record.classList.toggle(
        "prototype-filtered",
        !(matchesQuery && matchesStatus && matchesType && matchesAudience && matchesLevel),
      );
    });
    paginateFilteredRecords();
    updateTabletRowVisibility();
    updateEmptyStates();
    renderSelection();
  }

  function renderCheckbox(box, checked, indeterminate = false) {
    if (!box) return;
    box.setAttribute("aria-checked", indeterminate ? "mixed" : checked ? "true" : "false");
    box.style.alignItems = "center";
    box.style.backgroundColor = checked ? "#051223" : indeterminate ? "#D4B27A" : "#FFFFFF";
    box.style.color = "#FFFFFF";
    box.style.justifyContent = "center";
    box.style.outlineColor = checked || indeterminate ? "#051223" : "#9F927F";
    box.replaceChildren();
    if (checked) {
      const icon = $('svg[data-icon-name="check"]')?.cloneNode(true);
      if (icon) {
        icon.removeAttribute("data-pencil-name");
        icon.style.height = "11px";
        icon.style.width = "11px";
        $$('path', icon).forEach((path) => path.setAttribute("fill", "#FFFFFF"));
        box.appendChild(icon);
      }
    }
  }

  function visibleRecordIds() {
    const active = getFrame("library");
    if (!active) return [];
    return $$(RECORD_SELECTOR, active)
      .filter(
        (record) =>
          !record.classList.contains("prototype-filtered") &&
          !record.classList.contains("prototype-paged-out"),
      )
      .map(getRecordId)
      .filter(Boolean);
  }

  function renderSelection() {
    $$(RECORD_SELECTOR).forEach((record) => {
      const id = getRecordId(record);
      const checked = state.selected.has(id);
      record.classList.toggle("prototype-selected", checked);
      $$('[data-prototype-select-id]', record).forEach((box) => renderCheckbox(box, checked));
    });

    const visible = visibleRecordIds();
    const selectedVisible = visible.filter((id) => state.selected.has(id));
    const selectAll = $('[data-pencil-name="Sélectionner tous les contenus"]');
    renderCheckbox(selectAll, visible.length > 0 && selectedVisible.length === visible.length, selectedVisible.length > 0 && selectedVisible.length < visible.length);

    const bar = ensureSelectionBar();
    const count = state.selected.size;
    bar.hidden = count === 0 || state.view !== "library";
    $(".prototype-selection-bar__count", bar).textContent =
      count > 1 ? `${count} contenus sélectionnés` : "1 contenu sélectionné";
    const allArchived = count > 0 && Array.from(state.selected).every((id) => statusForId(id) === "Archivés");
    const primaryAction = $(".prototype-selection-bar__archive", bar);
    primaryAction.textContent = allArchived ? "Restaurer" : "Archiver";
    primaryAction.classList.toggle("prototype-selection-bar__archive--restore", allArchived);
  }

  function ensureSelectionBar() {
    let bar = $(".prototype-selection-bar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "prototype-selection-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Actions sur la sélection");
    bar.innerHTML = `
      <span class="prototype-selection-bar__count" aria-live="polite">0 contenu sélectionné</span>
      <button class="prototype-selection-bar__archive" type="button">Archiver</button>
      <button class="prototype-selection-bar__clear" type="button">Effacer la sélection</button>
    `;
    bar.hidden = true;
    $(".prototype-selection-bar__archive", bar).addEventListener("click", archiveSelection);
    $(".prototype-selection-bar__clear", bar).addEventListener("click", () => {
      state.selected.clear();
      renderSelection();
    });
    document.body.appendChild(bar);
    return bar;
  }

  function toggleSelection(id) {
    if (!id) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    renderSelection();
  }

  function toggleSelectAll() {
    const visible = visibleRecordIds();
    const allSelected = visible.length > 0 && visible.every((id) => state.selected.has(id));
    visible.forEach((id) => {
      if (allSelected) state.selected.delete(id);
      else state.selected.add(id);
    });
    renderSelection();
  }

  function showDialog({ title, message, confirmLabel, danger = false, onConfirm }) {
    const previous = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "prototype-dialog-backdrop";
    backdrop.innerHTML = `
      <section class="prototype-dialog" role="dialog" aria-modal="true" aria-labelledby="prototype-dialog-title" aria-describedby="prototype-dialog-description">
        <p class="prototype-dialog__eyebrow">Jet d’Encre · Administration</p>
        <h2 id="prototype-dialog-title"></h2>
        <p id="prototype-dialog-description"></p>
        <div class="prototype-dialog__actions">
          <button class="prototype-dialog__cancel" type="button">Annuler</button>
          <button class="prototype-dialog__confirm${danger ? " prototype-dialog__confirm--danger" : ""}" type="button"></button>
        </div>
      </section>
    `;
    $("#prototype-dialog-title", backdrop).textContent = title;
    $("#prototype-dialog-description", backdrop).textContent = message;
    $(".prototype-dialog__confirm", backdrop).textContent = confirmLabel;

    const close = () => {
      backdrop.remove();
      previous?.focus?.();
    };
    $(".prototype-dialog__cancel", backdrop).addEventListener("click", close);
    $(".prototype-dialog__confirm", backdrop).addEventListener("click", () => {
      close();
      onConfirm();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    document.body.appendChild(backdrop);
    $(".prototype-dialog__confirm", backdrop).focus();
  }

  function showToast(message, action = null) {
    clearTimeout(state.toastTimer);
    $(".prototype-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "prototype-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        toast.remove();
        action.run();
      });
      toast.appendChild(button);
    }
    document.body.appendChild(toast);
    state.toastTimer = window.setTimeout(() => toast.remove(), 5000);
  }

  function archiveIds(ids) {
    const previousStatuses = new Map();
    ids.forEach((id) => {
      const records = $$(RECORD_SELECTOR).filter((record) => getRecordId(record) === id);
      const previousStatus = records.map(getRecordStatus).find((status) => status !== "Archivés");
      if (!previousStatus) return;
      previousStatuses.set(id, previousStatus);
      records.forEach((record) => {
        record.dataset.prototypePreviousStatus = previousStatus;
        setRecordStatus(record, "Archivés");
      });
      state.selected.delete(id);
    });
    applyFilters();
    const archivedCount = previousStatuses.size;
    if (!archivedCount) return;
    showToast(archivedCount > 1 ? `${archivedCount} contenus archivés.` : "Contenu archivé.", {
      label: "Annuler",
      run: () => {
        restoreIds(Array.from(previousStatuses.keys()), previousStatuses, false);
        showToast(archivedCount > 1 ? "Archivage des contenus annulé." : "Archivage annulé.");
      },
    });
  }

  function restoreIds(ids, statusSnapshot = null, announce = true) {
    let restoredCount = 0;
    ids.forEach((id) => {
      const records = $$(RECORD_SELECTOR).filter((record) => getRecordId(record) === id);
      if (!records.length || !records.some((record) => getRecordStatus(record) === "Archivés")) return;
      const restoredStatus =
        statusSnapshot?.get(id) ||
        records.map((record) => record.dataset.prototypePreviousStatus).find(Boolean) ||
        "Brouillons";
      records.forEach((record) => {
        setRecordStatus(record, restoredStatus);
        delete record.dataset.prototypePreviousStatus;
      });
      state.selected.delete(id);
      restoredCount += 1;
    });
    applyFilters();
    if (announce && restoredCount) {
      showToast(restoredCount > 1 ? `${restoredCount} contenus restaurés.` : "Contenu restauré.");
    }
  }

  function archiveRecord(record) {
    const id = getRecordId(record);
    const title = getRecordTitle(record);
    if (getRecordStatus(record) === "Archivés") {
      restoreIds([id]);
      return;
    }
    showDialog({
      title: "Archiver ce contenu ?",
      message: `« ${title} » sera déplacé dans l’onglet Archivés. Vous pourrez annuler juste après l’action.`,
      confirmLabel: "Archiver",
      danger: true,
      onConfirm: () => archiveIds([id]),
    });
  }

  function archiveSelection() {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    if (ids.every((id) => statusForId(id) === "Archivés")) {
      restoreIds(ids);
      return;
    }
    showDialog({
      title: `Archiver ${ids.length} contenu${ids.length > 1 ? "s" : ""} ?`,
      message: "La sélection sera déplacée dans l’onglet Archivés. Cette action reste annulable immédiatement.",
      confirmLabel: "Archiver la sélection",
      danger: true,
      onConfirm: () => archiveIds(ids),
    });
  }

  function updateNamesAndMetadata(clone, sourceId, copyId, title) {
    [clone, ...$$('[data-pencil-name]', clone)].forEach((element) => {
      const name = pencilName(element);
      if (name.includes(sourceId)) element.setAttribute("data-pencil-name", name.replaceAll(sourceId, copyId));
      if (element.childElementCount === 0 && element.textContent.trim() === sourceId) element.textContent = copyId;
    });
    clone.dataset.prototypeRecordId = copyId;
    clone.dataset.prototypeStatus = "Brouillons";
    clone.dataset.prototypeSearchText = stripAccents(`${title} ${copyId} Brouillon`);
    clone.classList.add("prototype-generated-copy");
    clone.classList.remove("prototype-filtered", "prototype-paged-out", "prototype-selected", "prototype-archived");
    clone.removeAttribute("aria-label");
    delete clone.dataset.prototypePreviousStatus;

    $('[data-pencil-name^="Titre contenu"], [data-pencil-name^="Titre carte tablette"]', clone)?.replaceChildren(title);
    const now = new Date();
    const month = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ][now.getMonth()];
    const dateLabel = `${now.getDate()} ${month} · ${String(now.getHours()).padStart(2, "0")} h ${String(now.getMinutes()).padStart(2, "0")}`;
    $$('[data-pencil-name^="Valeur modification "], [data-pencil-name^="Valeur Date carte tablette "]', clone).forEach(
      (element) => {
        element.textContent = dateLabel;
      },
    );
    annotateRecord(clone);
    clone.dataset.prototypeTimestamp = String(Date.now());
    setRecordStatus(clone, "Brouillons");
    setupAccessibleControls();
  }

  function addDesktopCopy(sourceId, copyId, title) {
    const frame = getFrame("library", "desktop");
    const source = $(`[data-prototype-record-id="${CSS.escape(sourceId)}"]`, frame);
    if (!source) return;
    const clone = source.cloneNode(true);
    updateNamesAndMetadata(clone, sourceId, copyId, title);
    const firstRow = $(RECORD_SELECTOR, frame);
    firstRow?.before(clone);
    const visibleRows = $$(RECORD_SELECTOR, frame).filter((row) => !row.classList.contains("prototype-paged-out"));
    if (visibleRows.length > 6) visibleRows.at(-1).classList.add("prototype-paged-out");
  }

  function addTabletCopy(sourceId, copyId, title) {
    const frame = getFrame("library", "tablet");
    const source = $(`[data-prototype-record-id="${CSS.escape(sourceId)}"]`, frame);
    if (!source) return;
    const clone = source.cloneNode(true);
    updateNamesAndMetadata(clone, sourceId, copyId, title);

    const firstRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 1"]', frame);
    const secondRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 2"]', frame);
    if (!firstRow || !secondRow) return;
    firstRow.prepend(clone);
    const firstVisible = $$(RECORD_SELECTOR, firstRow).filter((card) => !card.classList.contains("prototype-paged-out"));
    if (firstVisible.length > 2) secondRow.prepend(firstVisible.at(-1));
    const allVisible = $$(RECORD_SELECTOR, frame).filter((card) => !card.classList.contains("prototype-paged-out"));
    if (allVisible.length > 4) allVisible.at(-1).classList.add("prototype-paged-out");
  }

  function duplicateRecord(record) {
    const sourceId = getRecordId(record);
    const sourceTitle = getRecordTitle(record);
    showDialog({
      title: "Dupliquer ce contenu ?",
      message: `Une copie de « ${sourceTitle} » sera créée avec le statut Brouillon.`,
      confirmLabel: "Créer la copie",
      onConfirm: () => {
        state.copyCounter += 1;
        const copyId = `COPY-${Date.now().toString().slice(-6)}-${state.copyCounter}`;
        const copyTitle = `Copie de ${sourceTitle}`;
        addDesktopCopy(sourceId, copyId, copyTitle);
        addTabletCopy(sourceId, copyId, copyTitle);
        applyFilters();
        setView("studio", { mode: "duplicate", title: copyTitle, status: "Brouillons" });
        showToast("Copie ajoutée aux Brouillons et ouverte dans le Studio.", {
          label: "Bibliothèque",
          run: () => setView("library"),
        });
      },
    });
  }

  function setupImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.multiple = true;
    input.accept = ".pdf,.epub,.doc,.docx,.mp3,.wav,.mp4,.webm,.jpg,.jpeg,.png";
    input.setAttribute("aria-label", "Choisir des contenus à importer");
    input.addEventListener("change", () => {
      const count = input.files?.length || 0;
      if (count) showToast(`${count} fichier${count > 1 ? "s" : ""} prêt${count > 1 ? "s" : ""} à être importé${count > 1 ? "s" : ""}.`);
      input.value = "";
    });
    document.body.appendChild(input);
    return input;
  }

  function recordFromAction(action) {
    return action?.closest(RECORD_SELECTOR) || null;
  }

  function setupEvents(importInput) {
    document.addEventListener("click", (event) => {
      const selectAll = event.target.closest('[data-pencil-name="Sélectionner tous les contenus"]');
      if (selectAll) {
        event.preventDefault();
        toggleSelectAll();
        return;
      }

      const checkbox = event.target.closest('[data-prototype-select-id]');
      if (checkbox) {
        event.preventDefault();
        event.stopPropagation();
        toggleSelection(checkbox.dataset.prototypeSelectId);
        return;
      }

      if (
        event.target.closest('[data-pencil-name="Navigation Admin · Bibliothèque"], [data-pencil-name="Rail Admin · Bibliothèque"]')
      ) {
        setView("library");
        return;
      }
      if (
        event.target.closest('[data-pencil-name="Navigation Admin · Studio de contenus"], [data-pencil-name="Rail Admin · Studio"]')
      ) {
        setView("studio", { mode: "new" });
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Nouveau contenu"], [data-pencil-name="Action Nouveau contenu tablette"]')) {
        setView("studio", { mode: "new" });
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Importer des contenus"], [data-pencil-name="Action Importer tablette"]')) {
        importInput.click();
        return;
      }

      const tab = event.target.closest('[data-prototype-status-filter]');
      if (tab) {
        setStatusFilter(tab.dataset.prototypeStatusFilter);
        return;
      }

      const modify = event.target.closest('[data-pencil-name^="Action Modifier"], [data-pencil-name^="Action tablette Modifier"]');
      if (modify) {
        const record = recordFromAction(modify);
        if (!record) return;
        setView("studio", {
          mode: "edit",
          title: getRecordTitle(record),
          status: getRecordStatus(record),
        });
        return;
      }

      const duplicate = event.target.closest('[data-pencil-name^="Action Dupliquer"], [data-pencil-name^="Action tablette Dupliquer"]');
      if (duplicate) {
        duplicateRecord(recordFromAction(duplicate));
        return;
      }

      const archive = event.target.closest('[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]');
      if (archive) {
        archiveRecord(recordFromAction(archive));
        return;
      }

      const page = event.target.closest('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]');
      if (page) {
        const suffix = pencilName(page).split(" ").pop();
        if (suffix === "…") return;
        if (suffix === "‹") state.page = Math.max(1, state.page - 1);
        else if (suffix === "›") state.page += 1;
        else if (Number.isFinite(Number.parseInt(suffix, 10))) state.page = Number.parseInt(suffix, 10);
        renderPagination();
        showToast(`Page ${state.page} sélectionnée.`);
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Filtres tablette"]')) {
        openFilterDrawer();
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (event.key === "Escape" && state.openPopover) {
        event.preventDefault();
        closeDesktopPopover(true);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && target.matches('[role="button"], [role="checkbox"]')) {
        event.preventDefault();
        target.click();
      }
    });

    window.addEventListener("resize", renderFrame, { passive: true });
  }

  function init() {
    setupAccessibleControls();
    setupRecords();
    setupDesktopFilters();
    setupSearch();
    ensureSelectionBar();
    const importInput = setupImport();
    setupEvents(importInput);
    applyFilters();
    renderFrame();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
