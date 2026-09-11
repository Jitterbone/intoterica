export class IntotericaApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static get VERSION() {
    // Prefer the live module version (updated after server restart).
    // Fall back to the hardcoded string so the header always shows correctly.
    const liveVersion = game.modules?.get('intoterica')?.version;
    return (liveVersion && liveVersion !== '1.1.0') ? liveVersion : "1.5.0";
  }

  static DEFAULT_OPTIONS = {
    id: "intoterica",
    window: {
      title: "Intoterica",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 1000,
      height: 700
    },
    classes: ["intoterica"]
  };

  get title() {
    return `Intoterica (v${IntotericaApp.VERSION})`;
  }

  static PARTS = {
    main: {
      template: "modules/intoterica/templates/intoterica.hbs"
    }
  };

  static toggle() {
    if (IntotericaApp._instance?.rendered) {
      IntotericaApp._instance.close();
    } else {
      new IntotericaApp().render(true);
    }
  }

  static openTo(view) {
    if (IntotericaApp._instance?.rendered) {
      IntotericaApp._instance.currentView = view;
      IntotericaApp._instance.selectedFaction = null;
      IntotericaApp._instance.profileActorId = null;
      IntotericaApp._instance.render();
    } else {
      const app = new IntotericaApp();
      app.currentView = view;
      app.render(true);
    }
  }

  static _profileDebounceTimer = null;

  static openProfile(actorOrId) {
    if (IntotericaApp._profileDebounceTimer) {
      clearTimeout(IntotericaApp._profileDebounceTimer);
    }
    IntotericaApp._profileDebounceTimer = setTimeout(() => {
      IntotericaApp._profileDebounceTimer = null;
      IntotericaApp._executeOpenProfile(actorOrId);
    }, 40);
  }

  static _executeOpenProfile(target) {
    if (!target) return;
    let actor = null;
    let actorId = null;

    if (typeof target === 'string') {
      actorId = target;
      actor = game.actors.get(actorId) || canvas?.tokens?.placeables?.find(t => t.actor?.id === actorId || t.id === actorId || t.document?.actorId === actorId)?.actor;
    } else if (target.documentName === 'Actor' || (target.constructor && target.constructor.name === 'Actor')) {
      actor = target;
      actorId = target.id;
    } else if (target.actor) {
      // Target is Token or TokenDocument
      actor = target.actor;
      actorId = actor?.id || target.document?.actorId || target.actorId;
    } else if (target.document?.actor) {
      actor = target.document.actor;
      actorId = actor?.id;
    } else if (target.id) {
      actorId = target.id;
      actor = game.actors.get(actorId) || canvas?.tokens?.placeables?.find(t => t.actor?.id === actorId || t.id === actorId)?.actor;
    }

    if (!actor) return;
    actorId = actor.id || actorId;
    if (!actorId) return;

    const isGM = game.user.isGM;
    const isOwner = actor.isOwner || (game.user.character && game.user.character.id === actorId);

    // GMs can open profile for ANY token; players are restricted to tokens they own
    if (!isGM && !isOwner) {
      return;
    }

    let app = IntotericaApp._instance;
    if (!app || !app.rendered) {
      app = new IntotericaApp();
      IntotericaApp._instance = app;
    }
    app.currentView = 'dashboard';
    app.selectedFaction = null;
    app.profileActorId = actorId;
    app.render(true);
    if (typeof app.bringToTop === 'function') {
      try { app.bringToTop(); } catch (_e) { /* ignore */ }
    }
  }

  static getThemeClass() {
    const themeKey = game.settings.get('intoterica', 'theme') || 'default';
    const themeConfig = IntotericaApp.THEMES?.[themeKey] || IntotericaApp.THEMES?.['default'];
    return themeConfig?.class || 'theme-foundry';
  }

  static createDialog(dialogData, options = {}) {
    const themeClass = IntotericaApp.getThemeClass();
    const customClasses = options.classes || [];
    const classes = Array.from(new Set(["intoterica-dialog", themeClass, ...customClasses]));

    if (foundry.applications?.api?.DialogV2) {
      const buttons = Object.entries(dialogData.buttons || {}).map(([action, btn]) => {
        const iconClass = btn.icon?.match(/class=["']([^"']+)["']/)?.[1] || (typeof btn.icon === 'string' && !btn.icon.includes('<') ? btn.icon : "");
        return {
          action: action,
          label: btn.label || action,
          icon: iconClass || undefined,
          default: dialogData.default === action,
          callback: async (event, button, dialog) => {
            if (typeof btn.callback === 'function') {
              const $html = $(dialog.element);
              return await btn.callback($html, event, dialog);
            }
          }
        };
      });

      const dialogV2Options = {
        window: {
          title: dialogData.title || "",
          icon: dialogData.icon || undefined,
          classes: classes
        },
        classes: classes,
        content: dialogData.content || "",
        buttons,
        position: {
          width: options.width || 480
        },
        modal: options.modal ?? false,
        rejectClose: false
      };

      class IntotericaDialogV2 extends foundry.applications.api.DialogV2 {
        constructor(opts, customRender, customClose) {
          super(opts);
          this._customRender = customRender;
          this._customClose = customClose;
        }

        _onRender(context, renderOptions) {
          super._onRender(context, renderOptions);
          if (this.element) {
            this.element.classList.add('intoterica-dialog', themeClass);
          }
          if (typeof this._customRender === 'function') {
            this._customRender($(this.element));
          }
        }

        _onClose(closeOptions) {
          if (typeof this._customClose === 'function') {
            this._customClose($(this.element));
          }
          return super._onClose(closeOptions);
        }
      }

      return new IntotericaDialogV2(dialogV2Options, dialogData.render, dialogData.close);
    }

    // Fallback for V11 or older environments
    const defaultClasses = ["dialog", "intoterica-dialog", themeClass];
    const legacyClasses = Array.from(new Set([...defaultClasses, ...customClasses]));

    const mergedOptions = foundry.utils.mergeObject({
      classes: legacyClasses,
      jQuery: true
    }, options);

    return new Dialog(dialogData, mergedOptions);
  }

  static getFormData(html) {
    const root = html?.[0] || html;
    const formEl = (root?.tagName === 'FORM') ? root : (root?.querySelector?.('form') || $(root).find('form')[0] || root);
    if (!formEl) return { form: null, data: {} };
    try {
      const FormDataClass = foundry.data?.FormDataExtended || FormDataExtended;
      const data = new FormDataClass(formEl).object || {};
      return { form: formEl, data };
    } catch (_e) {
      const data = {};
      $(formEl).find('input, select, textarea').each((i, el) => {
        const name = el.name;
        if (!name) return;
        if (el.type === 'checkbox') {
          data[name] = el.checked;
        } else if (el.type === 'radio') {
          if (el.checked) data[name] = el.value;
        } else {
          data[name] = el.value;
        }
      });
      return { form: formEl, data };
    }
  }

  constructor(options = {}) {
    const savedState = game.settings.get('intoterica', 'windowState');
    if (savedState && !foundry.utils.isEmpty(savedState)) {
        options.position = foundry.utils.mergeObject(options.position || {}, savedState);
    }
    super(options);
    this.currentView = game.settings.get('intoterica', 'defaultView') || 'dashboard';
    this.selectedFaction = null;
    this.profileActorId = null;
    this.activeFactionTab = 'overview';
    this.isEditingRanks = false;
    this.isEditingMembers = false;
    this._idleSound = null;
    this.mailComposeData = null;
    this.mailViewSubject = null;
    this.questFilter = 'active';
    this.questSearch = '';
    this.questGiverFilter = '';
    this.questFactionFilter = '';
    this.questDifficultyFilter = '';
    this.questSort = 'default';
    this.showAdvancedFilters = false;
    this._preserveSearchFocus = false;
    this._questSearchTimer = null;
    this.expandedQuestIds = new Set();
    this._isClosing = false;
    IntotericaApp._instance = this;
  }

  static DIFFICULTY_SCALES = {
    "standard": [
      { id: "Easy", label: "Easy", color: "#2b8a3e", tier: 1 },
      { id: "Medium", label: "Medium", color: "#f59f00", tier: 2 },
      { id: "Hard", label: "Hard", color: "#c92a2a", tier: 3 },
      { id: "Epic", label: "Epic", color: "#b026ff", tier: 4 },
      { id: "Legendary", label: "Legendary", color: "#e03131", tier: 5 }
    ],
    "metal": [
      { id: "Copper Tier", label: "Copper Tier", color: "#b87333", tier: 1 },
      { id: "Bronze Tier", label: "Bronze Tier", color: "#cd7f32", tier: 2 },
      { id: "Silver Tier", label: "Silver Tier", color: "#a0aab2", tier: 3 },
      { id: "Gold Tier", label: "Gold Tier", color: "#f59f00", tier: 4 },
      { id: "Platinum Tier", label: "Platinum Tier", color: "#00d2d3", tier: 5 }
    ],
    "rank": [
      { id: "E-Rank", label: "E-Rank", color: "#6c757d", tier: 1 },
      { id: "D-Rank", label: "D-Rank", color: "#2b8a3e", tier: 2 },
      { id: "C-Rank", label: "C-Rank", color: "#1c7ed6", tier: 3 },
      { id: "B-Rank", label: "B-Rank", color: "#f59f00", tier: 4 },
      { id: "A-Rank", label: "A-Rank", color: "#c92a2a", tier: 5 },
      { id: "S-Rank", label: "S-Rank", color: "#b026ff", tier: 6 }
    ],
    "stars": [
      { id: "1-Star", label: "1-Star", color: "#2b8a3e", tier: 1 },
      { id: "2-Star", label: "2-Star", color: "#1c7ed6", tier: 2 },
      { id: "3-Star", label: "3-Star", color: "#f59f00", tier: 3 },
      { id: "4-Star", label: "4-Star", color: "#c92a2a", tier: 4 },
      { id: "5-Star", label: "5-Star", color: "#b026ff", tier: 5 }
    ],
    "numeric": [
      { id: "Tier I", label: "Tier I", color: "#2b8a3e", tier: 1 },
      { id: "Tier II", label: "Tier II", color: "#1c7ed6", tier: 2 },
      { id: "Tier III", label: "Tier III", color: "#f59f00", tier: 3 },
      { id: "Tier IV", label: "Tier IV", color: "#c92a2a", tier: 4 },
      { id: "Tier V", label: "Tier V", color: "#b026ff", tier: 5 }
    ]
  };

  static getActiveDifficultyScale() {
    const scaleKey = game.settings.get('intoterica', 'difficultyScale') || 'standard';
    return IntotericaApp.DIFFICULTY_SCALES[scaleKey] || IntotericaApp.DIFFICULTY_SCALES['standard'];
  }

  static getDifficultyInfo(diffName) {
    if (!diffName) return { id: "Medium", label: "Medium", color: "#f59f00", tier: 2 };
    const clean = String(diffName).trim();
    const activeList = IntotericaApp.getActiveDifficultyScale();
    
    // Check in active scale
    const directMatch = activeList.find(d => d.id.toLowerCase() === clean.toLowerCase() || d.label.toLowerCase() === clean.toLowerCase());
    if (directMatch) return directMatch;

    // Check across all defined scales
    for (const scale of Object.values(IntotericaApp.DIFFICULTY_SCALES)) {
      const match = scale.find(d => d.id.toLowerCase() === clean.toLowerCase() || d.label.toLowerCase() === clean.toLowerCase());
      if (match) return match;
    }

    return { id: clean, label: clean, color: "#f59f00", tier: 2 };
  }

  static getDifficultyOptions(selectedDiff = "") {
    const activeList = IntotericaApp.getActiveDifficultyScale();
    const selectedClean = String(selectedDiff || '').trim().toLowerCase();
    
    let hasMatch = false;
    const optionsHtml = activeList.map(d => {
      const isSelected = selectedClean === d.id.toLowerCase() || selectedClean === d.label.toLowerCase();
      if (isSelected) hasMatch = true;
      return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${d.label}</option>`;
    }).join('');

    if (selectedDiff && !hasMatch) {
      return `<option value="${selectedDiff}" selected>${selectedDiff}</option>` + optionsHtml;
    }

    return optionsHtml;
  }

  static getPlayerActors() {
    const userCharMap = new Map();
    // 1. Assigned player characters from users
    for (const u of game.users) {
      if (!u.isGM && u.character) {
        userCharMap.set(u.character.id, u.character);
      }
    }
    // 2. Player-owned character actors on the dashboard/app
    for (const a of game.actors) {
      if (a.hasPlayerOwner && (a.type === 'character' || a.type === 'pc')) {
        userCharMap.set(a.id, a);
      }
    }
    return Array.from(userCharMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  static getQuestGiverOptions(selectedGiver = "") {
    const selectedClean = String(selectedGiver || "").trim().toLowerCase();
    let hasMatch = !selectedClean; // empty string matches "None"

    let html = `<option value="">— None / Independent —</option>`;

    // 1. Known NPCs (from Module Settings)
    const settings = game.settings.get('intoterica', 'data') || {};
    const knownNPCIds = settings.knownNPCs || [];
    const knownActors = knownNPCIds.map(id => typeof id === 'object' && id !== null ? id : game.actors?.get(id)).filter(Boolean);
    if (knownActors.length) {
      html += `<optgroup label="📜 Known NPCs">`;
      for (const npc of knownActors) {
        if (!npc.name) continue;
        const isSel = selectedClean === npc.name.toLowerCase() || (selectedClean && npc.id.toLowerCase() === selectedClean);
        if (isSel) hasMatch = true;
        html += `<option value="${Handlebars.escapeExpression(npc.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(npc.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 2. Factions (from Module Settings)
    const factions = settings.factions || [];
    if (factions.length) {
      html += `<optgroup label="🛡️ Factions & Organizations">`;
      for (const f of factions) {
        if (!f.name) continue;
        const isSel = selectedClean === f.name.toLowerCase();
        if (isSel) hasMatch = true;
        html += `<option value="${Handlebars.escapeExpression(f.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 3. Actors in Folders (Foundry Folder File Structure!)
    const actorFolders = game.folders ? game.folders.filter(f => f.type === 'Actor').sort((a, b) => a.name.localeCompare(b.name)) : [];
    for (const folder of actorFolders) {
      const folderActors = folder.contents || [];
      if (folderActors.length) {
        html += `<optgroup label="📁 ${Handlebars.escapeExpression(folder.name)}">`;
        for (const actor of folderActors) {
          const isSel = selectedClean === actor.name.toLowerCase() || (selectedClean && actor.id.toLowerCase() === selectedClean);
          if (isSel) hasMatch = true;
          html += `<option value="${Handlebars.escapeExpression(actor.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
        }
        html += `</optgroup>`;
      }
    }

    // 4. Root Actors (Actors not in any folder)
    const rootActors = game.actors ? game.actors.filter(a => !a.folder).sort((a, b) => a.name.localeCompare(b.name)) : [];
    if (rootActors.length) {
      html += `<optgroup label="👤 Root Actors & Characters">`;
      for (const actor of rootActors) {
        const isSel = selectedClean === actor.name.toLowerCase() || (selectedClean && actor.id.toLowerCase() === selectedClean);
        if (isSel) hasMatch = true;
        html += `<option value="${Handlebars.escapeExpression(actor.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 5. Custom / Freeform fallback option
    if (selectedGiver && !hasMatch) {
      html = `<option value="${Handlebars.escapeExpression(selectedGiver)}" selected>${Handlebars.escapeExpression(selectedGiver)} (Custom)</option>` + html;
    }
    html += `<option value="__custom__">✏️ Custom Name...</option>`;

    return html;
  }

  static getMailSenderOptions(selectedFromId = "", isGM = false) {
    const selectedClean = String(selectedFromId || "").trim().toLowerCase();
    let hasMatch = false;
    let html = "";

    const settings = game.settings.get('intoterica', 'data') || {};

    if (isGM) {
      // 1. Known NPCs
      const knownNPCIds = settings.knownNPCs || [];
      const knownActors = knownNPCIds.map(id => typeof id === 'object' && id !== null ? id : game.actors?.get(id)).filter(Boolean);
      if (knownActors.length) {
        html += `<optgroup label="📜 Known NPCs">`;
        for (const npc of knownActors) {
          if (!npc.name) continue;
          const isSel = selectedClean === npc.id.toLowerCase() || selectedClean === npc.name.toLowerCase();
          if (isSel) hasMatch = true;
          html += `<option value="${npc.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(npc.name)}</option>`;
        }
        html += `</optgroup>`;
      }

      // 2. Factions & Organizations
      const factions = settings.factions || [];
      if (factions.length) {
        html += `<optgroup label="🛡️ Factions & Organizations">`;
        for (const f of factions) {
          if (!f.name) continue;
          const val = `faction:${f.id}`;
          const isSel = selectedClean === val.toLowerCase() || selectedClean === f.id.toLowerCase() || selectedClean === f.name.toLowerCase();
          if (isSel) hasMatch = true;
          html += `<option value="${val}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`;
        }
        html += `</optgroup>`;
      }

      // 3. Actors in Folders (Foundry Folder File Structure)
      const actorFolders = game.folders ? game.folders.filter(f => f.type === 'Actor').sort((a, b) => a.name.localeCompare(b.name)) : [];
      for (const folder of actorFolders) {
        const folderActors = folder.contents || [];
        if (folderActors.length) {
          html += `<optgroup label="📁 ${Handlebars.escapeExpression(folder.name)}">`;
          for (const actor of folderActors) {
            const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
            if (isSel) hasMatch = true;
            html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
          }
          html += `</optgroup>`;
        }
      }

      // 4. Root Actors
      const rootActors = game.actors ? game.actors.filter(a => !a.folder).sort((a, b) => a.name.localeCompare(b.name)) : [];
      if (rootActors.length) {
        html += `<optgroup label="👤 Root Actors & Characters">`;
        for (const actor of rootActors) {
          const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
          if (isSel) hasMatch = true;
          html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
        }
        html += `</optgroup>`;
      }

      // 5. Game Master / Current User
      html += `<optgroup label="👑 Game Master">`;
      const gmVal = `user:${game.user.id}`;
      const isGmSel = selectedClean === gmVal.toLowerCase() || selectedClean === game.user.id.toLowerCase() || selectedClean === 'gm';
      if (isGmSel) hasMatch = true;
      html += `<option value="${gmVal}" ${isGmSel ? 'selected' : ''}>${Handlebars.escapeExpression(game.user.name)} (GM)</option>`;
      html += `</optgroup>`;
    } else {
      // Player characters
      const myActors = game.actors ? game.actors.filter(a => a.isOwner).sort((a, b) => a.name.localeCompare(b.name)) : [];
      if (myActors.length) {
        html += `<optgroup label="👤 Your Characters">`;
        for (const actor of myActors) {
          const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
          if (isSel) hasMatch = true;
          html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
        }
        html += `</optgroup>`;
      }
      const userVal = `user:${game.user.id}`;
      const isUserSel = selectedClean === userVal.toLowerCase() || selectedClean === game.user.id.toLowerCase() || (!hasMatch && !myActors.length);
      html += `<optgroup label="👤 User">`;
      html += `<option value="${userVal}" ${isUserSel ? 'selected' : ''}>${Handlebars.escapeExpression(game.user.name)}</option>`;
      html += `</optgroup>`;
    }

    return html;
  }

  static getSystemCurrencies() {
    // 1. Direct Module Hook overrides (allows any module to register or override currencies)
    const hookCurrencies = {};
    try {
      Hooks.callAll('intoterica.getCurrencies', hookCurrencies);
      if (Object.keys(hookCurrencies).length > 0) return hookCurrencies;
    } catch (_e) {}

    // 2. Check MythCraft Essence Sheet (customCurrencyConfig or WalletDialog)
    try {
      if (game.modules?.get('mythcraft-essence-sheet')?.active) {
        let esCurrs = null;
        if (game.settings?.settings?.has('mythcraft-essence-sheet.customCurrencyConfig')) {
          esCurrs = game.settings.get('mythcraft-essence-sheet', 'customCurrencyConfig');
        }
        if (!esCurrs && typeof window.WalletDialog?.getActiveCurrencies === 'function') {
          esCurrs = window.WalletDialog.getActiveCurrencies();
        }
        if (Array.isArray(esCurrs) && esCurrs.length > 0) {
          const list = {};
          for (const c of esCurrs) {
            const key = c.key || c.abbr || c.id;
            const label = c.label || c.name || (key ? key.toUpperCase() : "");
            if (key) list[key] = label;
          }
          if (Object.keys(list).length > 0) return list;
        }
      }
    } catch (_e) {}

    // 3. Check Monk's Enhanced Journal (currency setting or MonksEnhancedJournal.currencies)
    try {
      if (game.modules?.get('monks-enhanced-journal')?.active) {
        let mejCurrs = null;
        if (game.settings?.settings?.has('monks-enhanced-journal.currency')) {
          mejCurrs = game.settings.get('monks-enhanced-journal', 'currency');
        }
        if (!mejCurrs && window.MonksEnhancedJournal?.currencies) {
          mejCurrs = window.MonksEnhancedJournal.currencies;
        }
        if (Array.isArray(mejCurrs) && mejCurrs.length > 0) {
          const list = {};
          for (const c of mejCurrs) {
            const key = c.id || c.key || c.abbr || c.name;
            const label = c.name || c.label || (key ? key.toUpperCase() : "");
            if (key) list[key] = label;
          }
          if (Object.keys(list).length > 0) return list;
        }
      }
    } catch (_e) {}

    // 4. Check Item Piles (API, settings, or CONFIG)
    try {
      if (game.modules?.get('item-piles')?.active) {
        const ipCurrencies = game.itempiles?.API?.CURRENCIES || 
                             (game.settings?.settings?.has('item-piles.currencies') ? game.settings.get('item-piles', 'currencies') : null) ||
                             CONFIG?.ITEM_PILES?.CURRENCIES;
        if (ipCurrencies) {
          const list = {};
          if (Array.isArray(ipCurrencies)) {
            for (const c of ipCurrencies) {
              const key = c.abbreviation || c.id || c.name || c.key;
              if (key) list[key] = c.name || c.label || key.toUpperCase();
            }
          } else if (typeof ipCurrencies === 'object') {
            for (const [k, v] of Object.entries(ipCurrencies)) {
              const label = typeof v === 'string' ? v : (v?.name || v?.label || k.toUpperCase());
              list[k] = label;
            }
          }
          if (Object.keys(list).length > 0) return list;
        }
      }
    } catch (_e) {}

    // 5. Check Beavers Currency / Beavers Crafting / System Interface
    try {
      if (game.modules?.get('beavers-currency')?.active || game.modules?.get('beavers-crafting')?.active || window.beaversSystemInterface) {
        const beaversCurrs = window.beaversSystemInterface?.configCurrencies || 
                             (game.settings?.settings?.has('beavers-currency.currencies') ? game.settings.get('beavers-currency', 'currencies') : null) ||
                             (game.settings?.settings?.has('beavers-crafting.currencies') ? game.settings.get('beavers-crafting', 'currencies') : null);
        if (beaversCurrs && typeof beaversCurrs === 'object') {
          const list = {};
          const entries = Array.isArray(beaversCurrs) ? beaversCurrs : Object.entries(beaversCurrs);
          for (const item of entries) {
            const c = Array.isArray(beaversCurrs) ? item : item[1];
            const k = c?.id || c?.key || c?.abbreviation || c?.name || (Array.isArray(beaversCurrs) ? null : item[0]);
            if (k) list[k] = c?.label || c?.name || k.toUpperCase();
          }
          if (Object.keys(list).length > 0) return list;
        }
      }
    } catch (_e) {}

    // 6. Check known Custom Currency modules settings
    const customCurrencyModuleIds = [
      'dnd5e-custom-currency',
      'custom-currency',
      'currency-manager',
      'world-currency-5e',
      'currency-converter',
      'custom-currencies'
    ];
    for (const modId of customCurrencyModuleIds) {
      if (game.modules?.get(modId)?.active) {
        try {
          const keys = [`${modId}.currencies`, `${modId}.currency`, `${modId}.customCurrencies`, `${modId}.customCurrencyConfig`];
          for (const k of keys) {
            if (game.settings?.settings?.has(k)) {
              const val = game.settings.get(modId, k.split('.')[1]);
              if (val && typeof val === 'object') {
                const list = {};
                const entries = Array.isArray(val) ? val : Object.entries(val);
                for (const item of entries) {
                  const c = Array.isArray(val) ? item : item[1];
                  const key = c?.abbreviation || c?.id || c?.key || c?.abbr || c?.name || (Array.isArray(val) ? null : item[0]);
                  if (key) list[key] = c?.name || c?.label || key.toUpperCase();
                }
                if (Object.keys(list).length > 0) return list;
              }
            }
          }
        } catch (_e) {}
      }
    }

    // 7. Scan any active module settings for custom currency configuration
    try {
      if (game.settings?.settings) {
        for (const [fullKey, setting] of game.settings.settings.entries()) {
          const modId = fullKey.split('.')[0];
          if (modId === 'intoterica') continue;
          const mod = game.modules?.get(modId);
          if (!mod || !mod.active) continue;
          const settingName = fullKey.split('.').slice(1).join('.');
          if (/currenc|denomination/i.test(settingName)) {
            try {
              const val = game.settings.get(modId, settingName);
              if (Array.isArray(val) && val.length > 0) {
                const list = {};
                for (const c of val) {
                  if (!c || typeof c !== 'object') continue;
                  const key = c.key || c.abbr || c.id || c.abbreviation || c.name;
                  const label = c.label || c.name || (key ? key.toUpperCase() : "");
                  if (key) list[key] = label;
                }
                if (Object.keys(list).length > 0) return list;
              } else if (val && typeof val === 'object') {
                const list = {};
                for (const [k, v] of Object.entries(val)) {
                  if (v && typeof v === 'object') {
                    const key = v.key || v.abbr || v.id || v.abbreviation || k;
                    list[key] = v.label || v.name || key.toUpperCase();
                  } else if (typeof v === 'string') {
                    list[k] = v;
                  }
                }
                if (Object.keys(list).length > 0) return list;
              }
            } catch (_e) {}
          }
        }
      }
    } catch (_e) {}

    // 8. Check CONFIG currencies (system-level or module-registered)
    if (CONFIG?.currencies && typeof CONFIG.currencies === 'object' && Object.keys(CONFIG.currencies).length > 0) {
      const list = {};
      for (const [key, val] of Object.entries(CONFIG.currencies)) {
        list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
      }
      return list;
    }

    const sysId = game.system?.id;
    if (sysId) {
      const upperSys = sysId.toUpperCase();
      if (CONFIG?.[upperSys]?.currencies) {
        const list = {};
        for (const [key, val] of Object.entries(CONFIG[upperSys].currencies)) {
          list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
        }
        return list;
      }
      if (CONFIG?.[sysId]?.currencies) {
        const list = {};
        for (const [key, val] of Object.entries(CONFIG[sysId].currencies)) {
          list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
        }
        return list;
      }
    }

    // 9. Check DND5E & PF2E system fallbacks
    if (CONFIG?.DND5E?.currencies) {
      const list = {};
      for (const [key, val] of Object.entries(CONFIG.DND5E.currencies)) {
        list[key] = val.label || val.name || key.toUpperCase();
      }
      return list;
    }
    if (CONFIG?.PF2E?.currencies) {
      const list = {};
      for (const [key, val] of Object.entries(CONFIG.PF2E.currencies)) {
        list[key] = typeof val === 'string' ? val : (val.label || key.toUpperCase());
      }
      return list;
    }

    // 10. Inspect world actors (players first, then any actor in world)
    const playerActors = IntotericaApp.getPlayerActors();
    const candidateActors = playerActors.length > 0 ? playerActors : Array.from(game.actors || []);
    for (const actor of candidateActors) {
      const curr = actor.system?.currency || actor.system?.currencies || actor.system?.wealth || actor.system?.coins || actor.system?.money || actor.system?.attributes?.currency;
      if (curr && typeof curr === 'object' && !Array.isArray(curr)) {
        const list = {};
        for (const [k, v] of Object.entries(curr)) {
          if (['notes', 'description', 'details', 'special', 'override'].includes(k.toLowerCase())) continue;
          if (typeof v === 'number' || typeof v === 'string' || (v && typeof v === 'object')) {
            list[k] = k.toUpperCase();
          }
        }
        if (Object.keys(list).length > 0) return list;
      }
    }

    // 9. Inspect Actor Items for currency-type items (e.g. Mythcraft or item-based currency systems)
    for (const actor of candidateActors) {
      const currencyItems = actor.items?.filter?.(i => i.type === 'currency' || i.type === 'coin' || i.type === 'money' || i.type === 'wealth') || [];
      if (currencyItems.length > 0) {
        const list = {};
        for (const item of currencyItems) {
          const k = item.name.toLowerCase().replace(/\s+/g, '_');
          list[k] = item.name.toUpperCase();
        }
        if (Object.keys(list).length > 0) return list;
      }
    }

    // 10. Check system template/model definition
    try {
      const sysActorTemplate = game.system?.template?.Actor?.templates?.common || game.system?.template?.Actor?.character || game.system?.model?.Actor?.character;
      const modelCurr = sysActorTemplate?.currency || sysActorTemplate?.currencies || sysActorTemplate?.wealth || sysActorTemplate?.coins;
      if (modelCurr && typeof modelCurr === 'object') {
        const list = {};
        for (const k of Object.keys(modelCurr)) {
          list[k] = k.toUpperCase();
        }
        if (Object.keys(list).length > 0) return list;
      }
    } catch (_e) {}

    // Default fallback fantasy currencies
    return {
      gp: "GP (Gold)",
      sp: "SP (Silver)",
      cp: "CP (Copper)"
    };
  }

  static async addCurrencyToActor(actor, currencies, splitDivisor = 1) {
    if (!actor || !currencies || typeof currencies !== 'object') return;
    
    // Support Item Piles API if active
    if (game.modules?.get('item-piles')?.active && game.itempiles?.API?.addCurrency) {
      try {
        const ipUpdates = {};
        for (const [denom, amount] of Object.entries(currencies)) {
          const rawVal = Number(amount) || 0;
          const addVal = splitDivisor > 1 ? Math.floor(rawVal / splitDivisor) : rawVal;
          if (addVal > 0) ipUpdates[denom] = addVal;
        }
        if (Object.keys(ipUpdates).length > 0) {
          await game.itempiles.API.addCurrency(actor, ipUpdates);
          return;
        }
      } catch (_e) {
        // Fall back to direct actor update
      }
    }

    const updates = {};
    const sysCurr = actor.system?.currency || actor.system?.currencies || actor.system?.wealth || actor.system?.coins || actor.system?.money || actor.system?.attributes?.currency;
    const currPath = actor.system?.currency !== undefined ? 'system.currency' :
                     (actor.system?.currencies !== undefined ? 'system.currencies' :
                     (actor.system?.wealth !== undefined ? 'system.wealth' :
                     (actor.system?.coins !== undefined ? 'system.coins' :
                     (actor.system?.money !== undefined ? 'system.money' :
                     (actor.system?.attributes?.currency !== undefined ? 'system.attributes.currency' : 'system.currency')))));

    for (const [denom, amount] of Object.entries(currencies)) {
      const rawVal = Number(amount) || 0;
      if (rawVal <= 0) continue;
      const addVal = splitDivisor > 1 ? Math.floor(rawVal / splitDivisor) : rawVal;
      if (addVal <= 0) continue;

      let targetDenom = denom;
      if (game.system?.id === 'mythcraft') {
        const dLower = denom.toLowerCase();
        if (dLower === 'amber' || dLower === 'a' || dLower === 'astra') targetDenom = 'astra';
        else if (dLower === 'scillings' || dLower === 'sc' || dLower === 'silver') targetDenom = 'scillings';
        else if (dLower === 'qorn' || dLower === 'q' || dLower === 'quints') targetDenom = 'quints';
        else if (dLower === 'diamond' || dLower === 'dc' || dLower === 'denarii') targetDenom = 'denarii';
      }

      if (sysCurr && typeof sysCurr[targetDenom] === 'number') {
        updates[`${currPath}.${targetDenom}`] = (sysCurr[targetDenom] || 0) + addVal;
      } else if (sysCurr && typeof sysCurr[targetDenom] === 'object' && sysCurr[targetDenom] !== null && 'value' in sysCurr[targetDenom]) {
        updates[`${currPath}.${targetDenom}.value`] = (Number(sysCurr[targetDenom].value) || 0) + addVal;
      } else {
        const current = foundry.utils.getProperty(actor, `${currPath}.${targetDenom}`) || 0;
        updates[`${currPath}.${targetDenom}`] = Number(current) + addVal;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await actor.update(updates);
      } catch (e) {
        console.warn("Intoterica | Failed to update currency for actor:", actor.name, e);
      }
    }
  }

  static async grantItemsToActor(actor, items) {
    if (!actor || !Array.isArray(items) || items.length === 0) return;
    const docsToCreate = [];
    for (const item of items) {
      let docData = null;
      if (item.uuid) {
        try {
          const source = await fromUuid(item.uuid);
          if (source) docData = source.toObject();
        } catch (e) {}
      }
      if (!docData && item.itemData) {
        docData = foundry.utils.duplicate(item.itemData);
      }
      if (!docData) {
        docData = {
          name: item.name || "Quest Reward Item",
          type: item.type || "loot",
          img: item.img || "icons/svg/item-bag.svg",
          system: {}
        };
      }
      delete docData._id;
      const qty = Number(item.quantity) || 1;
      if (docData.system) {
        if ('quantity' in docData.system) docData.system.quantity = qty;
        else if ('qty' in docData.system) docData.system.qty = qty;
      }
      docsToCreate.push(docData);
    }

    if (docsToCreate.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", docsToCreate);
      } catch (e) {
        console.warn("Intoterica | Error creating embedded items for actor:", actor.name, e);
      }
    }
  }

  static formatMarkdown(text) {
    if (!text) return "";
    let formatted = String(text).trim();
    // Clean up empty leading and trailing HTML paragraphs/breaks
    formatted = formatted
      .replace(/^(<p>(\s|&nbsp;|<br>|<br\/>)*<\/p>|\s|<br>|<br\/>)+/gi, '')
      .replace(/(<p>(\s|&nbsp;|<br>|<br\/>)*<\/p>|\s|<br>|<br\/>)+$/gi, '')
      .trim();
    if (!formatted) return "";
    // If text already contains rich HTML markup, return it directly to preserve formatting
    if (/<(p|h[1-6]|ul|ol|li|blockquote|pre|code|div|span|strong|em|b|i|table|a|hr|br)[^>]*>/i.test(formatted)) {
      return formatted;
    }
    // Basic markdown replacements
    formatted = formatted.replace(/^### (.*$)/gim, '<h4 style="margin: 6px 0 3px 0; font-size: 1.05em; color: var(--theme-accent, #ff6400);">$1</h4>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h3 style="margin: 8px 0 4px 0; font-size: 1.15em; color: var(--theme-accent, #ff6400);">$1</h3>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h2 style="margin: 10px 0 6px 0; font-size: 1.25em; color: var(--theme-accent, #ff6400); border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 2px;">$1</h2>');
    formatted = formatted.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--theme-accent, #ff6400); margin: 6px 0; padding: 4px 10px; background: rgba(0,0,0,0.08); font-style: italic;">$1</blockquote>');
    formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.85em;"><code>$1</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.2); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>');
    formatted = formatted.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-left: 18px; list-style-type: disc;">$1</li>');
    formatted = formatted.replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-left: 18px; list-style-type: decimal;">$1</li>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  static createRichTextEditorHtml(name, content = "", placeholder = "Provide details and lore...") {
    const hasContent = Boolean(content && content.trim().length > 0);
    return `
      <div class="intoterica-rich-editor" data-target-name="${name}">
        <!-- Top Bar with Edit / View Mode Toggle -->
        <div class="rich-editor-mode-bar">
          <span class="rich-mode-title"><i class="fas fa-feather-alt"></i> Description</span>
          <button type="button" class="rich-mode-toggle-btn" title="Edit Description">
            <i class="fas fa-pen"></i> Edit
          </button>
        </div>

        <!-- 1. VIEW MODE (Default) -->
        <div class="rich-view-mode" title="Click to Edit Description">
          <div class="rich-view-content">
            ${hasContent ? content : `<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder || "Click here or 'Edit' to provide description..."}</em></div>`}
          </div>
        </div>

        <!-- 2. EDIT MODE (Hidden by default, shown when clicking Edit) -->
        <div class="rich-edit-mode" style="display: none; flex-direction: column;">
          <div class="rich-editor-toolbar">
            <select class="rich-format-select" title="Text Style">
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="blockquote">Quote</option>
              <option value="pre">Code</option>
            </select>
            <span class="toolbar-divider"></span>
            <button type="button" class="rich-btn" data-cmd="bold" title="Bold (Ctrl+B)"><i class="fas fa-bold"></i></button>
            <button type="button" class="rich-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i class="fas fa-italic"></i></button>
            <button type="button" class="rich-btn" data-cmd="underline" title="Underline (Ctrl+U)"><i class="fas fa-underline"></i></button>
            <span class="toolbar-divider"></span>
            <label class="rich-btn color-picker-label" title="Text Color">
              <i class="fas fa-palette"></i>
              <input type="color" class="rich-color-picker" style="display: none;" />
            </label>
            <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="Bullet List"><i class="fas fa-list-ul"></i></button>
            <button type="button" class="rich-btn" data-cmd="insertOrderedList" title="Numbered List"><i class="fas fa-list-ol"></i></button>
            <button type="button" class="rich-btn" data-cmd="insertHorizontalRule" title="Horizontal Line"><i class="fas fa-minus"></i></button>
            <span class="toolbar-divider"></span>
            <button type="button" class="rich-btn rich-insert-img-btn" title="Insert Image"><i class="fas fa-image"></i></button>
            <button type="button" class="rich-btn rich-insert-link-btn" title="Insert Link"><i class="fas fa-link"></i></button>
            <button type="button" class="rich-btn" data-cmd="removeFormat" title="Clear Formatting"><i class="fas fa-eraser"></i></button>
            <span class="toolbar-divider"></span>
            <button type="button" class="rich-btn rich-source-toggle-btn" title="Source Code View (&lt;/&gt;)"><i class="fas fa-code"></i></button>
            <button type="button" class="rich-btn rich-done-btn" title="Done Editing (Return to View Mode)" style="margin-left: auto; background: rgba(43, 138, 62, 0.15); color: #2b8a3e; border: 1px solid rgba(43, 138, 62, 0.4); font-weight: 600; padding: 2px 8px; width: auto; font-size: 11px;">
              <i class="fas fa-check"></i> Done
            </button>
          </div>
          <div class="rich-editor-content" contenteditable="true" data-placeholder="${placeholder}">
            ${content || ''}
          </div>
          <textarea name="${name}" class="rich-editor-source" style="display: none;">${content || ''}</textarea>
        </div>
      </div>
    `;
  }

  static initRichTextEditor($container) {
    $container.find('.intoterica-rich-editor').each(function() {
      const $editor = $(this);
      const $viewMode = $editor.find('.rich-view-mode');
      const $editMode = $editor.find('.rich-edit-mode');
      const $viewContent = $editor.find('.rich-view-content');
      const $content = $editor.find('.rich-editor-content');
      const $source = $editor.find('.rich-editor-source');
      const $formatSelect = $editor.find('.rich-format-select');
      const $modeToggleBtn = $editor.find('.rich-mode-toggle-btn');
      const $doneBtn = $editor.find('.rich-done-btn');
      const placeholder = $content.data('placeholder') || "Click here or 'Edit' to provide description...";

      // Sync contenteditable → hidden textarea & view mode
      const syncToSourceAndView = () => {
        let htmlVal = "";
        if ($source.is(':visible')) {
          htmlVal = $source.val();
        } else {
          htmlVal = $content.html();
        }
        $source.val(htmlVal);
        const stripped = (htmlVal || '').replace(/<p><br><\/p>|<br>|<div><br><\/div>/g, '').trim();
        if (stripped && stripped.length > 0) {
          $viewContent.html(htmlVal);
        } else {
          $viewContent.html(`<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder}</em></div>`);
        }
      };

      // Enter Edit Mode
      const enterEditMode = () => {
        $viewMode.hide();
        $editMode.css('display', 'flex').show();
        $modeToggleBtn.html('<i class="fas fa-eye"></i> View').addClass('active');
        $content.focus();
      };

      // Exit Edit Mode (Return to View Mode)
      const exitEditMode = () => {
        if ($source.is(':visible')) {
          $content.html($source.val()).show();
          $source.hide();
          $editor.find('.rich-source-toggle-btn').removeClass('active');
          $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', false);
        }
        syncToSourceAndView();
        $editMode.hide();
        $viewMode.show();
        $modeToggleBtn.html('<i class="fas fa-pen"></i> Edit').removeClass('active');
      };

      $modeToggleBtn.click(function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if ($editMode.is(':visible')) {
          exitEditMode();
        } else {
          enterEditMode();
        }
      });

      $viewMode.click(function(ev) {
        enterEditMode();
      });

      $doneBtn.click(function(ev) {
        ev.preventDefault();
        exitEditMode();
      });

      $content.on('input blur keyup paste', syncToSourceAndView);

      $editor.find('.rich-btn[data-cmd]').click(function(ev) {
        ev.preventDefault();
        const cmd = $(this).data('cmd');
        $content.focus();
        document.execCommand(cmd, false, null);
        syncToSourceAndView();
      });

      $formatSelect.change(function() {
        const tag = $(this).val();
        $content.focus();
        document.execCommand('formatBlock', false, tag);
        syncToSourceAndView();
      });

      $editor.find('.rich-color-picker').on('input change', function() {
        const color = $(this).val();
        $content.focus();
        document.execCommand('foreColor', false, color);
        syncToSourceAndView();
      });

      $editor.find('.rich-insert-img-btn').click(function(ev) {
        ev.preventDefault();
        new FilePicker({
          type: "image",
          callback: (path) => {
            $content.focus();
            document.execCommand('insertImage', false, path);
            syncToSourceAndView();
          }
        }).render(true);
      });

      $editor.find('.rich-insert-link-btn').click(function(ev) {
        ev.preventDefault();
        const url = prompt("Enter link URL:", "https://");
        if (url) {
          $content.focus();
          document.execCommand('createLink', false, url);
          syncToSourceAndView();
        }
      });

      $editor.find('.rich-source-toggle-btn').click(function(ev) {
        ev.preventDefault();
        const $btn = $(this);
        const isSource = $source.is(':visible');
        if (isSource) {
          // Exit source mode: sync textarea → contenteditable, show visual editor
          $content.html($source.val()).show();
          $source.hide();
          $btn.removeClass('active');
          $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', false);
        } else {
          // Enter source mode: sync contenteditable → textarea, show raw HTML
          $source.val($content.html()).show();
          $content.hide();
          $btn.addClass('active');
          $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', true);
        }
        syncToSourceAndView();
      });
    });
  }

  /**
   * Sync all rich text editors within a container before reading form values.
   * Call this at the top of any dialog Save callback.
   */
  static syncRichEditors($container) {
    $container.find('.intoterica-rich-editor').each(function() {
      const $editor = $(this);
      const $content = $editor.find('.rich-editor-content');
      const $source = $editor.find('.rich-editor-source');
      const $viewContent = $editor.find('.rich-view-content');
      const $viewMode = $editor.find('.rich-view-mode');
      const $editMode = $editor.find('.rich-edit-mode');
      const $modeToggleBtn = $editor.find('.rich-mode-toggle-btn');
      
      let htmlVal = "";
      if ($source.is(':visible')) {
        htmlVal = $source.val();
      } else {
        htmlVal = $content.html();
      }
      $source.val(htmlVal);
      const stripped = (htmlVal || '').replace(/<p><br><\/p>|<br>|<div><br><\/div>/g, '').trim();
      if (stripped && stripped.length > 0) {
        $viewContent.html(htmlVal);
      } else {
        const placeholder = $content.data('placeholder') || "Click here or 'Edit' to provide description...";
        $viewContent.html(`<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder}</em></div>`);
      }
      
      // Return to view mode upon saving
      $editMode.hide();
      $viewMode.show();
      $modeToggleBtn.html('<i class="fas fa-pen"></i> Edit').removeClass('active');
      $editor.find('.rich-source-toggle-btn').removeClass('active');
      $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').prop('disabled', false);
    });
  }

  static THEMES = {
    "default": {
      label: "Default",
      class: "theme-foundry",
      sounds: {
        idle: null,
        nav: null,
        mail: null
      }
    },
    "access-point": {
      label: "Access Point",
      class: "theme-access-point",
      sounds: {
        idle: "modules/intoterica/sounds/IntotericaIdle.ogg",
        nav: "modules/intoterica/sounds/NavSound.ogg",
        mail: "modules/intoterica/sounds/VeilMailSound.ogg"
      },
      volumeScale: 1.5
    },
    "soviet": {
      label: "Soviet Retro",
      class: "theme-soviet",
      sounds: {
        idle: "modules/intoterica/sounds/VintageRoyaltyFree.ogg",
        nav: "modules/intoterica/sounds/SovietNavSound.ogg",
        mail: "modules/intoterica/sounds/VeilMailSound.ogg"
      },
      volumeScale: 0.5
    },
    "dark-fantasy": {
      label: "Dark Fantasy 80s",
      class: "theme-dark-fantasy",
      sounds: {
        idle: "modules/intoterica/sounds/DarkFantasySynth.ogg",
        nav: "modules/intoterica/sounds/DarkFantasyNav.ogg",
        mail: "modules/intoterica/sounds/VeilMailSound.ogg"
      },
      volumeScale: 1.0
    },
    "vaporwave": {
      label: "Vaporwave",
      class: "theme-vaporwave",
      sounds: {
        idle: "modules/intoterica/sounds/Vaporwave.ogg",
        nav: "modules/intoterica/sounds/VaporwaveNav.ogg",
        mail: "modules/intoterica/sounds/VeilMailSound.ogg"
      },
      volumeScale: 0.5
    },
    "custom": {
      label: "Custom Configuration",
      class: "theme-custom",
      sounds: null // Indicates use settings
    }
  };

  static getSoundPath(type) {
    const themeKey = game.settings.get('intoterica', 'theme');
    const themeConfig = IntotericaApp.THEMES[themeKey] || IntotericaApp.THEMES['default'];
    
    if (themeConfig.sounds) {
      return themeConfig.sounds[type];
    }
    
    // Fallback to settings for custom/undefined
    switch (type) {
      case 'idle': return game.settings.get('intoterica', 'soundIdle');
      case 'nav': return game.settings.get('intoterica', 'soundNav');
      case 'mail': return game.settings.get('intoterica', 'soundMail');
    }
    return null;
  }

  static hasPermission(settingKey) {
    const requiredRole = game.settings.get('intoterica', settingKey);
    return game.user.role >= requiredRole;
  }

  static getActorImageByNameOrId(actorId, actorName, fallback = "icons/svg/mystery-man.svg") {
    let actor = actorId ? game.actors.get(actorId) : null;
    if (!actor && actorName && typeof actorName === 'string') {
      const cleanName = actorName.trim().toLowerCase();
      actor = game.actors.find(a => a.name?.trim().toLowerCase() === cleanName);
    }
    if (actor) {
      return actor.prototypeToken?.texture?.src || actor.img || fallback;
    }
    return fallback;
  }

  async close(options = {}) {
    this._isClosing = true;
    // Save window state
    if (this.position) {
        const state = {
            width: this.position.width,
            height: this.position.height,
            top: this.position.top,
            left: this.position.left
        };
        await game.settings.set('intoterica', 'windowState', state);
    }

    // Stop and clean up idle sound
    if (this._idleSound) {
      this._idleSound.stop();
      this._idleSound = null;
    }

    if (IntotericaApp._instance === this) IntotericaApp._instance = null;
    return super.close(options);
  }

  _getGameDate() {
    const useWorldClock = game.settings.get('intoterica', 'useWorldClock');
    
    if (useWorldClock) {
      if (window.SimpleCalendar?.api) {
        const date = SimpleCalendar.api.timestampToDate(game.time.worldTime);
        return SimpleCalendar.api.formatDateTime(date);
      } else if (game.modules.get('calendaria')?.active) {
        const calendariaModule = game.modules.get('calendaria');
        // Try common locations: window global, game property, or module API
        const cal = window.Calendaria || window.CALENDARIA || game.calendaria || calendariaModule.api;
        
        if (cal) {
            // 1. Try standard API methods (on main object or .api property)
            const api = cal.api || cal;
            
            if (typeof api.formatDate === 'function') {
                // Use 'dateLong' as the preset (matches default)
                const dateStr = api.formatDate(null, 'dateLong');
                
                // Manually format time to ensure reliability
                let timeStr = "";
                if (typeof api.getCurrentDateTime === 'function') {
                    const now = api.getCurrentDateTime();
                    if (now) timeStr = `${now.hour.toString().padStart(2, '0')}:${now.minute.toString().padStart(2, '0')}`;
                }
                
                return `${dateStr} ${timeStr}`;
            }
            
            if (typeof api.getDate === 'function') return api.getDate();
            if (typeof api.getDisplayDate === 'function') return api.getDisplayDate();
            if (typeof api.getDateTime === 'function') return api.getDateTime();
            
            // 2. Try to find the active calendar data
            let d = null;
            
            // Direct object (if it is the calendar)
            if (cal.currentDate) d = cal;
            else if (cal.data?.currentDate) d = cal.data;
            else if (cal.api?.currentDate) d = cal.api;
            else if (cal.system?.currentDate) d = cal.system;
            else if (cal.state?.currentDate) d = cal.state;
            
            // Check CalendarManager (most likely location based on keys)
            if (!d && cal.CalendarManager) {
                // Try common property names for the active calendar instance
                d = cal.CalendarManager.activeCalendar || 
                    cal.CalendarManager.visibleCalendar || 
                    cal.CalendarManager.currentCalendar;
                
                // If it's a list of calendars
                if (!d && Array.isArray(cal.CalendarManager.calendars)) {
                    d = cal.CalendarManager.calendars[0];
                }
            }

            // 3. Construct string from data
            if (d && d.currentDate) {
                const c = d.currentDate;
                let monthName = c.month;
                
                const months = d.months?.values || d.months;
                if (Array.isArray(months)) {
                    const monthData = months.find(m => m.ordinal === c.month) || months.find(m => m.numericRepresentation === c.month);
                    if (monthData) monthName = monthData.name;
                }
                
                const time = (c.hour !== undefined && c.minute !== undefined) 
                    ? ` ${c.hour.toString().padStart(2, '0')}:${c.minute.toString().padStart(2, '0')}` 
                    : '';
                
                return `${monthName} ${c.day}, ${c.year}${time}`;
            }

            // 4. Fallback: Check for string properties
            if (typeof cal.toString === 'function') {
                const str = cal.toString();
                if (str !== '[object Object]' && !str.startsWith('class ') && !str.startsWith('function ')) return str;
            }
            if (typeof cal.displayDate === 'string') return cal.displayDate;
            if (typeof cal.display === 'string') return cal.display;
        }
        return "Calendaria Active";
      }
      const day = Math.floor(game.time.worldTime / 86400);
      return `Day ${day}`;
    }
    const c = game.settings.get('intoterica', 'data').worldClock || { era: 1, day: 1 };
    return `Era ${c.era}, Day ${c.day}`;
  }

  async _prepareContext(_options) {
    const settings = game.settings.get('intoterica', 'data');
    const canManageMail = IntotericaApp.hasPermission('permMail');

    // GM: Process Pending Mail from Offline Players
    if (canManageMail) {
        let hasUpdates = false;
        for (const user of game.users) {
            const pending = user.getFlag('intoterica', 'pendingOutbox');
            if (pending && Array.isArray(pending) && pending.length > 0) {
                settings.inbox.unshift(...pending);
                await user.unsetFlag('intoterica', 'pendingOutbox');
                hasUpdates = true;
                ui.notifications.info(`Processed ${pending.length} pending messages from ${user.name}`);
            }
        }
        if (hasUpdates) {
            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate({ action: 'newMessage' });
        }
    }

    const userActorId = game.user.character?.id;

    // Process Factions (Auto-Calc & Normalization)
    const processedFactions = (settings.factions || []).map(f => {
      let ranks = f.ranks || [];
      // Normalize Ranks (Handle legacy string arrays vs new object arrays)
      if (ranks.length > 0 && typeof ranks[0] === 'string') {
        ranks = ranks.map(r => ({ name: r, xp: 0, modifier: 1.0 }));
      }

      // Auto-Calculate Reputation (Always Active)
      let partyRep = f.partyReputation;
      if (f.autoCalc === false) {
          partyRep = f.reputation;
      }
      if (partyRep === undefined) partyRep = 0;

      let totalWeightedRep = 0;
      let totalWeights = 0;
      
      // 1. Weighted Members (Players Only)
      const playerMembers = (f.members || []).filter(m => m.type === 'Player');
      const npcMembers = (f.members || []).filter(m => m.type !== 'Player');

      playerMembers.forEach(m => {
        const rankData = ranks[m.rank] || { modifier: 1.0 };
        const rankMod = rankData.modifier !== undefined ? rankData.modifier : 1.0;
        const weight = 1.0 + rankMod;
        totalWeightedRep += (m.reputation || 0) * weight;
        totalWeights += weight;
      });
      
      // 2. Party Reputation
      const totalPCs = game.users.filter(u => !u.isGM && u.character).length;
      const enlistedCount = playerMembers.length;
      let partyWeight = Math.max(0, totalPCs - enlistedCount);
      if (totalPCs === 0 && enlistedCount === 0) partyWeight = 1.0; // Fallback for setup

      if (partyWeight > 0) {
          totalWeightedRep += partyRep * partyWeight;
          totalWeights += partyWeight;
      }

      let currentRep = totalWeights > 0 ? Math.round(totalWeightedRep / totalWeights) : 0;
      currentRep = Math.max(-100, Math.min(100, currentRep));

      // Check enlistment eligibility
      const isMember = (f.members || []).some(m => m.id === userActorId);
      const canEnlist = !canManageMail && f.allowEnlistment && userActorId && !isMember; // Using mail perm as proxy for GM-like status here, or strictly !isGM? Sticking to !isGM logic for player actions usually implies "Not an admin".

      const status = this._getRepStatus(currentRep);
      const isImage = f.image && (f.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.image));
      
      return { 
          ...f, ranks, reputation: currentRep, 
          partyReputation: f.partyReputation || 0,
          statusLabel: status.label, statusClass: status.class, face: status.face, xpMod: status.xpMod, statusColor: status.color, 
          canEnlist, isImage, playerMembers, npcMembers 
      };
    });

    // Sync selected faction with latest data
    if (this.selectedFaction) {
      this.selectedFaction = processedFactions.find(f => f.id === this.selectedFaction.id) || null;
    }

    // Permissions
    const perms = {
        factions: IntotericaApp.hasPermission('permFactions'),
        quests: IntotericaApp.hasPermission('permQuests'),
        badges: IntotericaApp.hasPermission('permBadges'),
        mail: IntotericaApp.hasPermission('permMail'),
        clock: IntotericaApp.hasPermission('permClock'),
        profiles: IntotericaApp.hasPermission('permProfiles')
    };

    // Native Quest Tracker Processing
    const rawQuests = settings.quests || [];
    const myActorIds = game.actors.filter(a => a.isOwner).map(a => a.id);
    if (game.user.character) myActorIds.push(game.user.character.id);

    const isGM = Boolean(game.user.isGM);
    const canEditQuests = isGM || perms.quests;

    const processedQuests = rawQuests.map(q => {
      let currentSubstory = false;
      const tasks = (Array.isArray(q.tasks) ? q.tasks : []).map(t => {
        const isSubstory = Boolean(t.isSubstory || t.isSubquest);
        if (isSubstory) currentSubstory = true;
        return {
          ...t,
          isSubstory,
          isSubquest: isSubstory,
          isSubstoryChild: !isSubstory && currentSubstory,
          isSubquestChild: !isSubstory && currentSubstory,
          completed: Boolean(t.completed),
          failed: Boolean(t.failed),
          optional: Boolean(t.optional),
          hidden: Boolean(t.hidden)
        };
      });
      const visibleTasks = canEditQuests ? tasks : tasks.filter(t => !t.hidden);
      const totalTasks = visibleTasks.length;
      const completedTasks = visibleTasks.filter(t => t.completed && !t.failed).length;
      const failedTasks = visibleTasks.filter(t => t.failed).length;
      const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (q.status === 'Completed' ? 100 : 0);
      
      const isAssignAll = q.assignedAll !== false && (!q.assignedTo || q.assignedTo.length === 0);
      const assignedTo = Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []);
      const assignedActors = assignedTo.map(id => game.actors.get(id)).filter(Boolean);
      const assignedNames = isAssignAll ? "Whole Party" : (assignedActors.map(a => a.name).join(', ') || "Whole Party");

      const isExpanded = this.expandedQuestIds.has(q.id);
      const isPrimary = !!q.isPrimary;
      const rewards = q.rewards || {};

      const diffInfo = IntotericaApp.getDifficultyInfo(q.difficulty);
      const difficulty = diffInfo.label || q.difficulty || "Medium";
      const difficultyColor = diffInfo.color || "#f59f00";
      const difficultyTier = diffInfo.tier || 2;
      const commissionedFaction = q.commissionedFaction || "";
      const giver = q.giver || "";
      const title = q.title || q.name || "Untitled Quest";

      // Formatted description markdown
      const descriptionHtml = IntotericaApp.formatMarkdown(q.description || "");

      // Process rewards for Handlebars template display
      const factionXpList = Array.isArray(rewards.factionXp) ? rewards.factionXp.filter(fx => Number(fx.amount) > 0) : [];
      const reputationsList = Array.isArray(rewards.reputations)
        ? rewards.reputations.filter(r => Number(r.amount) !== 0)
        : (rewards.reputation && Number(rewards.reputation.amount) !== 0 ? [rewards.reputation] : []);
      const repData = reputationsList[0] || null;
      const currencyList = rewards.currencies && typeof rewards.currencies === 'object' 
        ? Object.entries(rewards.currencies).filter(([k, v]) => Number(v) > 0).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(', ')
        : (rewards.currency || "");
      const itemsList = Array.isArray(rewards.items) ? rewards.items : [];
      const hasAnyRewards = Boolean(factionXpList.length > 0 || reputationsList.length > 0 || currencyList || itemsList.length > 0 || rewards.xp || rewards.text);

      // Calculate approximate numeric reward score for sorting
      let rewardValue = Number(rewards.xp || 0);
      for (const fx of factionXpList) {
        rewardValue += Number(fx.amount || 0);
      }
      if (rewards.currencies && typeof rewards.currencies === 'object') {
        for (const [k, v] of Object.entries(rewards.currencies)) {
          const num = Number(v) || 0;
          if (/sp\b|silver/i.test(k)) rewardValue += num * 0.1;
          else if (/cp\b|copper/i.test(k)) rewardValue += num * 0.01;
          else if (/pp\b|plat/i.test(k)) rewardValue += num * 10;
          else rewardValue += num;
        }
      } else if (rewards.currency) {
        const numMatch = String(rewards.currency).match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          const val = parseFloat(numMatch[1]);
          if (/sp\b|silver/i.test(rewards.currency)) rewardValue += val * 0.1;
          else if (/cp\b|copper/i.test(rewards.currency)) rewardValue += val * 0.01;
          else rewardValue += val;
        }
      }
      rewardValue += itemsList.length * 10;

      const rawStatus = q.status === 'Hidden' ? (q._prevStatus || 'Active') : (q.status || 'Active');
      const isHidden = Boolean(q.hidden || q.status === 'Hidden');

      return {
        ...q,
        status: rawStatus,
        hidden: isHidden,
        title,
        name: title,
        descriptionHtml,
        tasks,
        totalTasks,
        completedTasks,
        taskProgress,
        isAssignAll,
        assignedTo,
        assignedActors,
        assignedNames,
        isExpanded,
        isPrimary,
        rewards: {
          ...rewards,
          factionXpList,
          reputationsList,
          repData,
          currencyList,
          itemsList,
          hasAnyRewards
        },
        difficulty,
        difficultyColor,
        difficultyTier,
        commissionedFaction,
        giver,
        rewardValue
      };
    });

    // Visibility filter (GM sees all; players see assigned or party quests that are not Hidden)
    const visibleQuests = processedQuests.filter(q => {
      if (canEditQuests) return true;
      if (q.hidden) return false;
      if (q.assignedAll === true || (!q.assignedTo || q.assignedTo.length === 0)) return true; // Whole Party quest
      return q.assignedTo.some(id => myActorIds.includes(id));
    });

    if (!this.questFilter || this.questFilter === 'all') {
      this.questFilter = 'active';
    }

    const questStats = {
      active: visibleQuests.filter(q => q.status === 'Active').length,
      available: visibleQuests.filter(q => q.status === 'Available' || q.status === 'Inactive').length,
      completed: visibleQuests.filter(q => q.status === 'Completed').length,
      failed: visibleQuests.filter(q => q.status === 'Failed').length
    };

    // Extract unique factions and givers across all known data for filter dropdowns
    const questFilterFactions = Array.from(new Set([
      ...(settings.factions || []).map(f => f.name).filter(Boolean),
      ...visibleQuests.map(q => q.commissionedFaction).filter(Boolean)
    ])).sort();

    const questFilterGivers = Array.from(new Set([
      ...(settings.knownNPCs || []).map(id => typeof id === 'object' && id ? id.name : game.actors?.get(id)?.name).filter(Boolean),
      ...visibleQuests.map(q => q.giver).filter(Boolean)
    ])).sort();

    const questFilterDifficulties = IntotericaApp.getActiveDifficultyScale();

    // Filter by current quest filter tab
    let filteredQuests = visibleQuests;
    if (this.questFilter === 'available') {
      filteredQuests = visibleQuests.filter(q => (q.status || '').toLowerCase() === 'available' || (q.status || '').toLowerCase() === 'inactive');
    } else if (this.questFilter) {
      filteredQuests = visibleQuests.filter(q => (q.status || '').toLowerCase() === this.questFilter.toLowerCase());
    }

    // Filter by Faction
    if (this.questFactionFilter) {
      filteredQuests = filteredQuests.filter(q => (q.commissionedFaction || '').toLowerCase() === this.questFactionFilter.toLowerCase());
    }

    // Filter by Giver / NPC
    if (this.questGiverFilter) {
      filteredQuests = filteredQuests.filter(q => (q.giver || '').toLowerCase() === this.questGiverFilter.toLowerCase());
    }

    // Filter by Difficulty
    if (this.questDifficultyFilter) {
      const targetDiff = this.questDifficultyFilter.toLowerCase();
      filteredQuests = filteredQuests.filter(q => {
        const info = IntotericaApp.getDifficultyInfo(q.difficulty);
        return info.id.toLowerCase() === targetDiff || info.label.toLowerCase() === targetDiff || (q.difficulty || '').toLowerCase() === targetDiff;
      });
    }

    // Filter by search query (by quest title, giver, faction, description, or task objective text)
    const searchQuery = (this.questSearch || '').trim().toLowerCase();
    if (searchQuery) {
      filteredQuests = filteredQuests.filter(q => {
        const titleMatch = (q.title || '').toLowerCase().includes(searchQuery);
        const giverMatch = (q.giver || '').toLowerCase().includes(searchQuery);
        const factionMatch = (q.commissionedFaction || '').toLowerCase().includes(searchQuery);
        const descMatch = (q.description || '').toLowerCase().includes(searchQuery);
        const taskMatch = (q.tasks || []).some(t => (t.text || '').toLowerCase().includes(searchQuery));
        return titleMatch || giverMatch || factionMatch || descMatch || taskMatch;
      });
    }

    // Sorting logic
    const sort = this.questSort || 'default';
    if (sort === 'title-asc') {
      filteredQuests.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'title-desc') {
      filteredQuests.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (sort === 'diff-asc') {
      filteredQuests.sort((a, b) => (a.difficultyTier - b.difficultyTier) || (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'diff-desc') {
      filteredQuests.sort((a, b) => (b.difficultyTier - a.difficultyTier) || (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'reward-desc') {
      filteredQuests.sort((a, b) => (b.rewardValue - a.rewardValue));
    } else if (sort === 'reward-asc') {
      filteredQuests.sort((a, b) => (a.rewardValue - b.rewardValue));
    } else if (sort === 'progress-desc') {
      filteredQuests.sort((a, b) => (b.taskProgress - a.taskProgress));
    } else if (sort === 'progress-asc') {
      filteredQuests.sort((a, b) => (a.taskProgress - b.taskProgress));
    } else {
      // Default: Primary > Status
      const sortOrder = { "Active": 0, "Available": 1, "Inactive": 1, "Completed": 2, "Failed": 3 };
      filteredQuests.sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9);
      });
    }

    const hasActiveFilters = Boolean(this.questFactionFilter || this.questGiverFilter || this.questDifficultyFilter || (this.questSort && this.questSort !== 'default'));
    const activeFilterCount = (this.questFactionFilter ? 1 : 0) + (this.questGiverFilter ? 1 : 0) + (this.questDifficultyFilter ? 1 : 0) + ((this.questSort && this.questSort !== 'default') ? 1 : 0);

    const activeQuests = visibleQuests.filter(q => q.status === 'Active');

    // World Clock Logic
    const useWorldClock = game.settings.get('intoterica', 'useWorldClock');
    const clockDisplay = this._getGameDate();

    // Player Overview Logic
    const players = [];
    
    for (const u of game.users) {
      if (u.isGM || !u.character) continue;
      
      const actor = u.character;
      const isOnline = u.active;
      const isSelf = u.isSelf;

      // Admin sees all players. Players see themselves and online players.
      if (perms.profiles || isSelf || isOnline) {
        const actorId = actor.id;
        const badgesCount = (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(actorId)).length;
        const factionsCount = (settings.factions || []).filter(f => (f.members || []).some(m => m.id === actorId)).length;
        const unreadMessages = (settings.inbox || []).filter(m => m.to === actorId && m.status === 'unread').length;

        players.push({
          id: actorId,
          name: actor.name,
          img: (actor.img && actor.img !== "icons/svg/mystery-man.svg") ? actor.img : (actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg"),
          userName: u.name,
          online: isOnline,
          isSelf: isSelf,
          badgesCount,
          factionsCount,
          unreadMessages,
          canExpand: perms.profiles || isSelf // Only Admin or Self can view full profile
        });
      }
    }

    // Profile Data
    let profile = null;
    if (this.profileActorId) {
      const actor = game.actors.get(this.profileActorId) || canvas?.tokens?.placeables?.find(t => t.actor?.id === this.profileActorId || t.id === this.profileActorId)?.actor;
      const isOwnCharacter = game.user.character?.id === this.profileActorId || actor?.isOwner;

      if (actor && (game.user.isGM || perms.profiles || isOwnCharacter)) {
        const actorId = actor.id;
        
        // Get Profile History (Hidden/Added quests)
        const profileHistory = (settings.profileHistory || {})[actorId] || { hidden: [], added: [] };
        
        // Determine quests for this actor
        const actorQuests = processedQuests.filter(q => {
          if (profileHistory.hidden && profileHistory.hidden.includes(q.id)) return false;
          const statusLower = String(q.status || '').toLowerCase();
          const isExplicitlyAssigned = Array.isArray(q.assignedTo) && q.assignedTo.includes(actorId);
          const isPartyAssigned = q.assignedAll === true;
          const isCompletedBy = Array.isArray(q.completedBy) && q.completedBy.includes(actorId);
          const isFailedBy = Array.isArray(q.failedBy) && q.failedBy.includes(actorId);
          
          if (statusLower === 'active') {
            return isPartyAssigned || isExplicitlyAssigned;
          }
          if (statusLower === 'completed') {
            if (Array.isArray(q.completedBy)) {
              return isCompletedBy;
            }
            if (Array.isArray(q.assignedTo) && q.assignedTo.length > 0) {
              return isExplicitlyAssigned;
            }
            return isPartyAssigned;
          }
          if (statusLower === 'failed') {
            if (Array.isArray(q.failedBy)) {
              return isFailedBy;
            }
            if (Array.isArray(q.assignedTo) && q.assignedTo.length > 0) {
              return isExplicitlyAssigned;
            }
            return isPartyAssigned;
          }
          return false;
        });
        let historyQuests = [...actorQuests];
        if (profileHistory.added) {
          historyQuests = historyQuests.concat(profileHistory.added);
        }

        profile = {
          id: actorId,
          name: actor.name || "Unknown",
          img: (actor.img && actor.img !== "icons/svg/mystery-man.svg") ? actor.img : (actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg"),
          badges: (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(actorId)).map(b => ({
            ...b,
            isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
          })),
          factions: processedFactions.filter(f => (f.members || []).some(m => m.id === actorId)).map(f => {
            const member = (f.members || []).find(m => m.id === actorId);
            
            // Calculate Progress
            let progress = 0;
            let showProgress = false;
            let nextRankName = "";
            let nextRankXP = 0;
            const currentXP = member ? (member.xp || 0) : 0;
            
            if (member && f.ranks && f.ranks.length > 0) {
                const currentRankIdx = member.rank;
                if (currentRankIdx < f.ranks.length - 1) {
                    const currentRankXP = f.ranks[currentRankIdx]?.xp || 0;
                    const nextRank = f.ranks[currentRankIdx + 1];
                    nextRankXP = nextRank?.xp || 0;
                    
                    if (nextRankXP > currentRankXP) {
                        progress = Math.min(100, Math.max(0, ((currentXP - currentRankXP) / (nextRankXP - currentRankXP)) * 100));
                        showProgress = true;
                        nextRankName = nextRank?.name || "";
                    }
                }
            }

            return {
              id: f.id,
              factionId: f.id,
              actorId: actorId,
              memberId: actorId,
              name: f.name,
              image: f.image,
              isImage: f.isImage,
              rank: member ? (f.ranks[member.rank]?.name || member.rank) : '',
              rankIndex: member ? (member.rank || 0) : 0,
              xp: currentXP,
              progress: Math.round(progress),
              showProgress,
              nextRankName,
              nextRankXP,
              ranks: f.ranks || []
            };
          }),
          messages: (settings.inbox || []).filter(m => {
            const to = Array.isArray(m.to) ? m.to : [m.to];
            const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
            return to.includes(actorId) || cc.includes(actorId);
          }),
          quests: historyQuests.filter(q => String(q.status).toLowerCase() === 'active'),
          completedQuests: historyQuests.filter(q => q.status === 'Completed'),
          failedQuests: historyQuests.filter(q => q.status === 'Failed')
        };
      } else {
        this.profileActorId = null;
      }
    }

    // Helper to check if message is unread for current user
    const userId = game.user.id;
    const isMsgUnread = (m) => {
        if (Array.isArray(m.readBy)) return !m.readBy.includes(userId);
        return m.status === 'unread';
    };

    // Process Inbox for Current User (Threading)
    let userInbox = [];
    
    if (perms.mail) {
      userInbox = settings.inbox || [];
    } else {
      const myActors = game.actors.filter(a => a.isOwner);
      const myActorIds = myActors.map(a => a.id);
      const myActorNames = myActors.map(a => a.name?.trim().toLowerCase()).filter(Boolean);
      userInbox = (settings.inbox || []).filter(m => {
        const to = Array.isArray(m.to) ? m.to : [m.to];
        const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
        const isSender = myActorIds.includes(m.fromId) || m.fromId === game.user.id || (m.from && myActorNames.includes(m.from.trim().toLowerCase()));
        return isSender || to.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase()))) || cc.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase())));
      });

      // Include pending messages in view
      const pending = game.user.getFlag('intoterica', 'pendingOutbox') || [];
      if (pending.length > 0) {
          userInbox = [...pending, ...userInbox];
      }
    }

    // Known NPCs (Moved up for message processing)
    const knownNPCIds = settings.knownNPCs || [];

    // Helper to mask unknown senders & dynamically resolve current actor image by id or name
    const getMessageDisplayData = (msg) => {
        let displayFrom = msg.from;
        let displayImage = msg.image;
        
        // Find actor by fromId or matching actor name
        let matchedActor = msg.fromId ? game.actors.get(msg.fromId) : null;
        if (!matchedActor && msg.from && typeof msg.from === 'string') {
            const cleanFrom = msg.from.trim().toLowerCase();
            matchedActor = game.actors.find(a => a.name?.trim().toLowerCase() === cleanFrom);
        }

        if (matchedActor) {
            if (!perms.mail && !knownNPCIds.includes(matchedActor.id) && !matchedActor.hasPlayerOwner) {
                displayFrom = "Unknown Sender";
                displayImage = "icons/svg/mystery-man.svg";
            } else {
                displayImage = matchedActor.prototypeToken?.texture?.src || matchedActor.img || displayImage;
                if (!displayImage || displayImage === "👤") {
                    displayImage = matchedActor.img || "icons/svg/mystery-man.svg";
                }
            }
        } else if (!perms.mail && msg.fromId && !knownNPCIds.includes(msg.fromId)) {
            displayFrom = "Unknown Sender";
            displayImage = "icons/svg/mystery-man.svg";
        }
        
        const isImage = displayImage && (displayImage.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(displayImage));
        return { ...msg, from: displayFrom, image: displayImage, isImage };
    };

    // Group by Subject
    const threads = {};
    userInbox.forEach(m => {
      const subject = m.subject || "(No Subject)";
      const normalizedSubject = subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      if (!threads[normalizedSubject]) threads[normalizedSubject] = [];
      threads[normalizedSubject].push(m);
    });

    const displayInbox = Object.values(threads).map(threadMsgs => {
      let latest = threadMsgs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      // Thread is unread if ANY message in it is unread for this user
      const isThreadUnread = threadMsgs.some(isMsgUnread);
      latest = getMessageDisplayData(latest);
      return {
        ...latest,
        status: isThreadUnread ? 'unread' : 'read', // Override status for display
        isImage: latest.image && (latest.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(latest.image))
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const knownNPCs = knownNPCIds.map(id => game.actors.get(id)).filter(a => a);
    const allNPCs = game.actors.filter(a => !a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));

    // Mail Context (Compose/View)
    let mailContext = {};
    if (this.currentView === 'mail') {
        const npcs = game.actors.filter(a => !a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));
        const players = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
        const availableNPCs = perms.mail ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));
        const allRecipients = [...players, ...availableNPCs];

        if (this.mailComposeData) {
            const defaults = this.mailComposeData;
            const isGM = perms.mail;

            // Generate hierarchical from sender options (Folders, Known NPCs, Factions, Root Actors, Users)
            const activeFromId = defaults.fromId || defaults.from || (game.user.character?.id || `user:${game.user.id}`);
            const fromOptionsHtml = IntotericaApp.getMailSenderOptions(activeFromId, isGM);

            // Determine current sender for visual display
            let currentFromId = defaults.fromId;
            let currentFromName = "";
            let currentFromImage = "icons/svg/mystery-man.svg";
            let currentFromIdVal = currentFromId;

            if (currentFromId && currentFromId.startsWith('faction:')) {
                const fId = currentFromId.split(':')[1];
                const f = (settings.factions || []).find(fac => fac.id === fId || fac.name === fId);
                if (f) {
                    currentFromName = f.name;
                    currentFromImage = f.icon || f.banner || "icons/svg/shield.svg";
                }
            } else if (currentFromId && currentFromId.startsWith('user:')) {
                const uId = currentFromId.split(':')[1];
                const u = game.users?.get(uId);
                if (u) {
                    currentFromName = u.name;
                    currentFromImage = u.avatar || "icons/svg/mystery-man.svg";
                }
            } else if (currentFromId) {
                const a = game.actors?.get(currentFromId);
                if (a) {
                    currentFromName = a.name;
                    currentFromImage = a.prototypeToken?.texture?.src || a.img || "icons/svg/mystery-man.svg";
                }
            }

            if (!currentFromName && defaults.from && typeof defaults.from === 'string') {
                currentFromName = defaults.from;
                const matched = game.actors?.find(a => a.name?.trim().toLowerCase() === defaults.from.trim().toLowerCase());
                if (matched) {
                    currentFromImage = matched.prototypeToken?.texture?.src || matched.img || "icons/svg/mystery-man.svg";
                    currentFromIdVal = matched.id;
                }
            }

            if (!currentFromName) {
                if (game.user.character) {
                    currentFromName = game.user.character.name;
                    currentFromImage = game.user.character.prototypeToken?.texture?.src || game.user.character.img || "icons/svg/mystery-man.svg";
                    currentFromIdVal = game.user.character.id;
                } else {
                    currentFromName = game.user.name;
                    currentFromImage = game.user.avatar || "icons/svg/mystery-man.svg";
                    currentFromIdVal = `user:${game.user.id}`;
                }
            }

            const currentFrom = {
                id: currentFromIdVal,
                name: currentFromName,
                image: currentFromImage
            };

            // Helper to get actor data for chips (supporting name matching if sheet changed)
            const getRecipientData = (ids) => {
                if (!ids) return [];
                const idList = Array.isArray(ids) ? ids : [ids];
                return idList.map(id => {
                    let actor = allRecipients.find(a => a.id === id);
                    if (!actor) {
                        actor = game.actors.get(id);
                    }
                    if (!actor && typeof id === 'string') {
                        const cleanId = id.trim().toLowerCase();
                        actor = game.actors.find(a => a.name?.trim().toLowerCase() === cleanId);
                    }
                    if (!actor && typeof id === 'string') {
                        const user = game.users.get(id) || game.users.find(u => u.name?.trim().toLowerCase() === id.trim().toLowerCase());
                        if (user?.character) {
                            actor = user.character;
                        }
                    }
                    // Handle replying to unknown sender (not in allRecipients)
                    if (actor && !actor.hasPlayerOwner && !perms.mail && !knownNPCIds.includes(actor.id)) {
                        return { id: actor.id, name: "Unknown Sender", image: "icons/svg/mystery-man.svg", isUnknown: true };
                    }
                    
                    if (!actor) return null;
                    
                    return {
                        id: actor.id,
                        name: actor.name,
                        image: actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
                        isUnknown: false
                    };
                }).filter(Boolean);
            };

            const formatIds = (ids) => Array.isArray(ids) ? ids.join(",") : (ids || "");

            mailContext.compose = {
                fromOptionsHtml,
                currentFrom,
                toRecipients: getRecipientData(defaults.to),
                toIds: formatIds(defaults.to),
                ccRecipients: getRecipientData(defaults.cc),
                ccIds: formatIds(defaults.cc),
                subject: defaults.subject || "",
                body: defaults.body || ""
            };
        } else if (this.mailViewSubject !== null) {
            const closedThreads = settings.closedThreads || [];
            const normalizedViewSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
            
            const threadMessages = (settings.inbox || []).filter(m => {
                const mSubject = m.subject || "(No Subject)";
                return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedViewSubject;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Check if normalized subject is in closedThreads list
            const isClosed = closedThreads.includes(normalizedViewSubject);

            mailContext.thread = {
                subject: this.mailViewSubject,
                messages: threadMessages.map(getMessageDisplayData),
                isClosed: isClosed
            };
        }
    }

    // Calculate Stats Efficiently
    let unreadMailCount = 0;
    if (perms.mail) {
        unreadMailCount = (settings.inbox || []).filter(isMsgUnread).length;
    } else {
        const myActors = game.actors.filter(a => a.isOwner);
        const myActorIds = myActors.map(a => a.id);
        const myActorNames = myActors.map(a => a.name?.trim().toLowerCase()).filter(Boolean);
        unreadMailCount = (settings.inbox || []).filter(m => {
            if (!isMsgUnread(m)) return false;
            const to = Array.isArray(m.to) ? m.to : [m.to];
            const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
            return to.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase()))) || cc.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase())));
        }).length;
    }

    return {
      isGM: perms.mail, // Template uses isGM for many admin controls, mapping to mail perm for now or specific perms below
      clockDisplay,
      canEditClock: perms.clock && !useWorldClock,
      theme: game.settings.get('intoterica', 'theme'),
      themeClass: IntotericaApp.getThemeClass(),
      currentView: this.currentView,
      selectedFaction: this.selectedFaction,
      meritBadges: (settings.meritBadges || []).map(b => ({
        ...b,
        isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
      })),
      quests: filteredQuests,
      questFilter: this.questFilter || 'active',
      questSearch: this.questSearch || '',
      questStats,
      questFilterFactions,
      questFilterGivers,
      questFilterDifficulties,
      questFactionFilter: this.questFactionFilter || '',
      questGiverFilter: this.questGiverFilter || '',
      questDifficultyFilter: this.questDifficultyFilter || '',
      questSort: this.questSort || 'default',
      showAdvancedFilters: this.showAdvancedFilters,
      hasActiveFilters,
      activeFilterCount,
      factions: processedFactions,
      players: players,
      profile: profile,
      inbox: displayInbox,
      knownNPCs: knownNPCs,
      mailContext: mailContext,
      showDashboard: this.currentView === 'dashboard' && !this.profileActorId,
      showProfile: this.currentView === 'dashboard' && this.profileActorId,
      stats: {
        activeQuests: activeQuests.length,
        unreadMail: unreadMailCount,
        earnedBadges: (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(game.user.character?.id)).length
      },
      worldClock: settings.worldClock || { era: 4, day: 442 },
      perms // Pass granular permissions to template
    };
  }

  _getRepStatus(rep) {
      if (rep <= -80) return { label: "Nemesis", class: "rep-tier-nemesis", face: "👿", xpMod: 0.5, color: "#8b0000" };
      if (rep <= -50) return { label: "Hostile", class: "rep-tier-hostile", face: "😠", xpMod: 0.75, color: "#ff4500" };
      if (rep <= -30) return { label: "Unfriendly", class: "rep-tier-unfriendly", face: "😒", xpMod: 0.9, color: "#ffd700" };
      if (rep <= -10) return { label: "Wary", class: "rep-tier-wary", face: "😕", xpMod: 1.0, color: "#f5f5dc" };
      if (rep < 10) return { label: "Neutral", class: "rep-tier-neutral", face: "😐", xpMod: 1.0, color: "#ffffff" };
      if (rep < 30) return { label: "Friendly", class: "rep-tier-friendly", face: "🙂", xpMod: 1.1, color: "#98fb98" };
      if (rep < 50) return { label: "Allied", class: "rep-tier-allied", face: "😃", xpMod: 1.25, color: "#00ff00" };
      if (rep < 80) return { label: "Devoted", class: "rep-tier-devoted", face: "😇", xpMod: 1.5, color: "#00bfff" };
      return { label: "Devoted", class: "rep-tier-devoted", face: "🧞", xpMod: 1.5, color: "#00bfff" };
  }

  _calculateFactionRep(faction) {
    let ranks = faction.ranks || [];
    // Normalize Ranks (Handle legacy string arrays vs new object arrays)
    if (ranks.length > 0 && typeof ranks[0] === 'string') {
      ranks = ranks.map(r => ({ name: r, xp: 0, modifier: 1.0 }));
    }

    let totalWeightedRep = 0;
    let totalWeights = 0;
    
    // 1. Weighted Members (Players Only)
    const playerMembers = (faction.members || []).filter(m => m.type === 'Player');
    
    playerMembers.forEach(m => {
      const rankData = ranks[m.rank] || { modifier: 1.0 };
      const rankMod = rankData.modifier !== undefined ? rankData.modifier : 1.0;
      const weight = 1.0 + rankMod;
      totalWeightedRep += (m.reputation || 0) * weight;
      totalWeights += weight;
    });
    
    // 2. Party Reputation
    let partyRep = faction.partyReputation;
    if (faction.autoCalc === false) {
        partyRep = faction.reputation;
    }
    if (partyRep === undefined) partyRep = 0;

    const totalPCs = game.users.filter(u => !u.isGM && u.character).length;
    const enlistedCount = playerMembers.length;
    let partyWeight = Math.max(0, totalPCs - enlistedCount);
    if (totalPCs === 0 && enlistedCount === 0) partyWeight = 1.0; // Fallback for setup

    if (partyWeight > 0) {
        totalWeightedRep += partyRep * partyWeight;
        totalWeights += partyWeight;
    }

    let currentRep = totalWeights > 0 ? Math.round(totalWeightedRep / totalWeights) : 0;
    return Math.max(-100, Math.min(100, currentRep));
  }

  async _onRender(_context, _options) {
    const html = $(this.element);

    // Apply active theme class to the outer window application container
    const themeClass = IntotericaApp.getThemeClass();
    this.element.classList.remove('theme-foundry', 'theme-default', 'theme-access-point', 'theme-soviet', 'theme-dark-fantasy', 'theme-vaporwave', 'theme-custom');
    this.element.classList.add(themeClass);

    // Update Window Header with Version & Date (Right Side)
    if (this.window?.title) {
        this.window.title.textContent = `Intoterica (v${IntotericaApp.VERSION})`;
    }
    if (_context.clockDisplay && this.window?.header) {
        let dateEl = this.window.header.querySelector('.intoterica-header-date');
        if (!dateEl) {
            dateEl = document.createElement('span');
            dateEl.classList.add('intoterica-header-date');
            dateEl.style.cssText = "margin-right: 1rem; font-size: 0.85rem; opacity: 0.9; white-space: nowrap;";
            this.window.title.after(dateEl);
        }
        dateEl.textContent = _context.clockDisplay;
    }

    // Apply Custom CSS if enabled
    if (game.settings.get('intoterica', 'theme') === 'custom') {
      const customCSS = game.settings.get('intoterica', 'customCSS');
      if (customCSS) {
        html.find('#intoterica-custom-css').remove();
        html.append(`<style id="intoterica-custom-css">${customCSS}</style>`);
      }
    }

    // CRITICAL FIX: Prevent form submission globally using the nuclear option
    html.find('form').attr('onsubmit', 'return false;').on('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    });
    // Ensure all buttons are explicitly typed as buttons
    html.find('button').prop('type', 'button');

    // Fix XP Modifier badge color for Neutral/Wary (Light background)
    if (this.selectedFaction) {
      const rep = this.selectedFaction.reputation;
      if (rep > -30 && rep < 10) {
        html.find('.xp-modifier-badge').css({
          'color': '#000000',
          'border-color': '#000000'
        });
      }
    }

    // Known NPCs Drag & Drop (GM Only)
    if (this.currentView === 'known-npcs' && IntotericaApp.hasPermission('permMail')) {
        const dropZone = html.find('.known-npcs-container')[0];
        if (dropZone) {
            dropZone.addEventListener('dragover', e => e.preventDefault());
            dropZone.addEventListener('drop', this._onDropKnownNPC.bind(this));
        }
        html.find('.remove-known-npc').click(this._onRemoveKnownNPC.bind(this));
    }

    // Mail Integrated Controls
    if (this.currentView === 'mail') {
        html.find('.compose-mail').click(this._onComposeMail.bind(this));
        // Force select value for GM sender to match state
        if (_context.mailContext?.compose?.currentFrom?.id && IntotericaApp.hasPermission('permMail')) {
             html.find('select[name="fromId"]').val(_context.mailContext.compose.currentFrom.id);
        }

        // Compose Actions
        html.find('.send-mail-btn').click(this._onSendMailAction.bind(this));
        html.find('.cancel-compose-btn').click(this._onCancelCompose.bind(this));
        html.find('.reply-btn').click(this._onReplyAction.bind(this));
        html.find('.end-conversation-btn').click(this._onEndConversation.bind(this));
        html.find('.reopen-conversation-btn').click(this._onReopenConversation.bind(this));
        html.find('.delete-message-btn').click(this._deleteMessage.bind(this));
        html.find('.delete-thread-btn').click(this._onDeleteThreadAction.bind(this));
        
        // Address Book
        html.find('.open-address-book').click(ev => {
            const target = ev.currentTarget.dataset.target;
            const currentIds = (this.mailComposeData[target] || []);
            const npcs = game.actors.filter(a => a.type === 'npc').sort((a, b) => a.name.localeCompare(b.name));
            const players = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
            const knownNPCIds = game.settings.get('intoterica', 'data').knownNPCs || [];
            const availableNPCs = IntotericaApp.hasPermission('permMail') ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));

            this._openAddressBook(currentIds, players, availableNPCs, (newIds) => {
                this.mailComposeData[target] = newIds;
                this.render();
            });
        });

        // GM / Sender From Selection Change
        html.find('select[name="fromId"]').on('change', ev => {
            ev.preventDefault();
            if (this.mailComposeData) {
                this.mailComposeData.fromId = $(ev.currentTarget).val();
                this.mailComposeData.subject = html.find('input[name="subject"]').val();
                this.mailComposeData.body = html.find('textarea[name="body"]').val();
                this.render();
            }
        });

        // Input preservation on re-render
        html.find('input[name="subject"]').on('input', ev => {
             if (this.mailComposeData) this.mailComposeData.subject = $(ev.currentTarget).val();
        });
        html.find('textarea[name="body"]').on('input', ev => {
             if (this.mailComposeData) this.mailComposeData.body = $(ev.currentTarget).val();
        });
    }

    // View switching (available to all users)
    if (this._onViewChange) html.find('.nav-item').click(this._onViewChange.bind(this));

    // Faction selection (available to all users)
    if (this._onSelectFaction) html.find('.faction-card').click(this._onSelectFaction.bind(this));
    if (this._onReadMessage) html.find('.inbox-item').click(this._onReadMessage.bind(this));
    if (this._onSelectPlayer) html.find('.player-card').click(this._onSelectPlayer.bind(this));

    // Inject Custom Faction Detail View
    const factionLayout = html.find('.faction-layout');
    if (this.selectedFaction) {
        factionLayout.addClass('details-open');
        this._renderFactionDetail(html, this.selectedFaction);
    } else {
        factionLayout.removeClass('details-open');
    }

    // Inject Descriptions for Faction Cards (List View)
    if (this.currentView === 'factions') {
        const factionCards = html.find('.faction-card');
        factionCards.each((i, el) => {
            const card = $(el);
            const factionId = card.data('factionId');
            const faction = _context.factions.find(f => f.id === factionId);
            if (faction && faction.description && !card.find('.faction-card-description').length) {
                 const descText = faction.description.length > 500 ? faction.description.substring(0, 500) + '...' : faction.description;
                 card.append(`<div class="faction-card-description">${descText}</div>`);
            }
        });
    }
    
    // Profile Back Button - Explicit binding with off() to prevent duplicates
    if (this._onCloseProfile) {
      html.find('.back-btn').off('click').on('click', this._onCloseProfile.bind(this));
    }
    html.find('.profile-quest-link').click(this._onProfileQuestClick.bind(this));
    html.find('.profile-edit-faction-xp').click(this._onProfileEditFactionXP.bind(this));

    // Quest Journal Event Bindings
    if (this.currentView === 'quests') {
      const canEditQuests = game.user.isGM || IntotericaApp.hasPermission('permQuests');
      html.find('.quest-filter-btn').click(this._onFilterQuests.bind(this));
      html.find('.quest-header-clickable').click(this._onToggleExpandQuest.bind(this));
      html.find('.quest-pin-btn').click(this._onToggleQuestPin.bind(this));
      html.find('.quest-visibility-btn').click(this._onToggleQuestVisibility.bind(this));
      html.find('.quest-task-checkbox').change(this._onToggleQuestTask.bind(this));
      html.find('.quest-task-fail-toggle').click(this._onToggleQuestTaskFail.bind(this));
      html.find('.quest-task-visibility-toggle').click(this._onToggleQuestTaskVisibility.bind(this));
      html.find('.quest-task-substory-toggle').click(this._onToggleQuestTaskSubstory.bind(this));

      // Sheet-level Quest Tasks Drag & Drop Reordering
      if (canEditQuests) {
        let draggedTaskData = null;

        html.find('.quest-tasks-list').on('dragstart', '.quest-task-item, .quest-task-substory-header', function(ev) {
          const target = ev.target;
          if ($(target).is('input, button, select, textarea')) {
            ev.preventDefault();
            return;
          }
          const questId = $(this).data('questId');
          const taskId = $(this).data('taskId');
          draggedTaskData = { questId, taskId, element: this };
          ev.originalEvent.dataTransfer.effectAllowed = 'move';
          ev.originalEvent.dataTransfer.setData('text/plain', taskId || '');
          $(this).addClass('dragging');
        });

        html.find('.quest-tasks-list').on('dragend', '.quest-task-item, .quest-task-substory-header', function() {
          draggedTaskData = null;
          html.find('.quest-task-item, .quest-task-substory-header').removeClass('dragging drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-list').on('dragover', '.quest-task-item, .quest-task-substory-header', function(ev) {
          ev.preventDefault();
          ev.originalEvent.dataTransfer.dropEffect = 'move';
          if (!draggedTaskData || draggedTaskData.element === this) return;
          const targetQuestId = $(this).data('questId');
          if (draggedTaskData.questId !== targetQuestId) return;

          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          html.find('.quest-task-item, .quest-task-substory-header').not(this).removeClass('drag-over-top drag-over-bottom');
          if (ev.clientY < midY) {
            $(this).addClass('drag-over-top').removeClass('drag-over-bottom');
          } else {
            $(this).addClass('drag-over-bottom').removeClass('drag-over-top');
          }
        });

        html.find('.quest-tasks-list').on('dragleave', '.quest-task-item, .quest-task-substory-header', function() {
          $(this).removeClass('drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-list').on('drop', '.quest-task-item, .quest-task-substory-header', async (ev) => {
          ev.preventDefault();
          const target = ev.currentTarget;
          if (!draggedTaskData || draggedTaskData.element === target) return;
          const targetQuestId = $(target).data('questId');
          const targetTaskId = $(target).data('taskId');
          if (draggedTaskData.questId !== targetQuestId) return;

          const raw = game.settings.get('intoterica', 'data') || {};
          const settings = foundry.utils.deepClone(raw);
          const quest = (settings.quests || []).find(q => q.id === targetQuestId);
          if (!quest || !Array.isArray(quest.tasks)) return;

          const fromIndex = quest.tasks.findIndex(t => t.id === draggedTaskData.taskId);
          const toIndex = quest.tasks.findIndex(t => t.id === targetTaskId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

          const rect = target.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const insertBefore = ev.clientY < midY;

          const [movedTask] = quest.tasks.splice(fromIndex, 1);
          let newIndex = quest.tasks.findIndex(t => t.id === targetTaskId);
          if (!insertBefore) newIndex += 1;
          quest.tasks.splice(newIndex, 0, movedTask);
          quest.lastModified = Date.now();

          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();
        });
      }

      html.find('.share-quest-chat').click(this._onShareQuestChat.bind(this));
      html.find('.quest-search-input').on('input', this._onSearchQuests.bind(this));
      html.find('.clear-quest-search').click(this._onClearQuestSearch.bind(this));
      html.find('.quest-filter-toggle-btn').click(this._onToggleQuestFilterToolbar.bind(this));
      html.find('.quest-filter-faction').change(this._onChangeQuestFactionFilter.bind(this));
      html.find('.quest-filter-giver').change(this._onChangeQuestGiverFilter.bind(this));
      html.find('.quest-filter-difficulty').change(this._onChangeQuestDifficultyFilter.bind(this));
      html.find('.quest-filter-sort').change(this._onChangeQuestSort.bind(this));
      html.find('.reset-quest-filters').click(this._onResetQuestFilters.bind(this));

      if (this._preserveSearchFocus) {
        const searchInput = html.find('.quest-search-input');
        if (searchInput.length) {
          searchInput.focus();
          const val = searchInput.val() || '';
          if (searchInput[0]?.setSelectionRange) {
            searchInput[0].setSelectionRange(val.length, val.length);
          }
        }
        this._preserveSearchFocus = false;
      }
    }

    // Inject Faction Progress Bars in Profile
    if (this.profileActorId && _context.profile) {
        const profileFactions = _context.profile.factions;
        const miniCards = html.find('.mini-card');
        
        miniCards.each((i, el) => {
            const card = $(el);
            const title = card.find('.mini-title').text().trim();
            const factionData = profileFactions.find(f => f.name === title);
            
            if (factionData && factionData.showProgress) {
                if (card.find('.faction-progress-wrapper').length) return;
                
                const progressHtml = `
                    <div class="faction-progress-wrapper" title="Next Rank: ${factionData.nextRankName} (${factionData.xp} / ${factionData.nextRankXP} XP)">
                        <div class="faction-rank-labels">
                            <span class="rank-current">${factionData.rank}</span>
                            <span class="rank-next">${factionData.nextRankName}</span>
                        </div>
                        <div class="faction-xp-row">
                            <span class="xp-current">${factionData.xp}</span>
                            <div class="faction-progress-track">
                                <div class="faction-progress-fill" style="width: ${factionData.progress}%"></div>
                            </div>
                            <span class="xp-next">${factionData.nextRankXP}</span>
                        </div>
                    </div>
                `;
                card.children('div').last().append(progressHtml);
            }
        });
    }

    // Inject Profile "Mission Report" (Completed/Failed Quests)
    if (this.profileActorId && _context.profile) {
      const content = html.find('.intoterica-content');
      
      const generateQuestHtml = (quests, statusClass) => {
        if (!quests || quests.length === 0) return '<div class="empty-text">None recorded</div>';
        return quests.map(q => {
          const tasks = Array.isArray(q.tasks) ? q.tasks : [];
          const completedTasks = tasks.filter(t => t.completed && !t.failed).length;
          const totalTasks = tasks.length;
          const diffInfo = IntotericaApp.getDifficultyInfo(q.difficulty);
          const title = q.title || q.name || 'Untitled Quest';

          return `
            <div class="mini-card profile-quest-link status-${statusClass}" data-quest-id="${q.id}" data-is-manual="${q.isManual || false}" style="cursor: pointer; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 6px 8px;" title="Click to view quest in Quest Journal">
              ${q.image ? `
                <div class="mini-icon" style="flex-shrink: 0; width: 36px; height: 36px; min-width: 36px; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                  <img src="${q.image}" style="width: 100%; height: 100%; object-fit: cover; border: none;" />
                </div>
              ` : ''}
              <div style="flex: 1; min-width: 0;">
                <div class="mini-title" style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${q.isPrimary ? '⭐ ' : ''}${Handlebars.escapeExpression(title)}
                </div>
                <div class="mini-sub" style="font-size: 11px; color: var(--theme-dim);">
                  <span style="color: ${diffInfo.color}; font-weight: 600;">${diffInfo.label}</span> • ${q.status || (statusClass === 'completed' ? 'Completed' : 'Failed')}
                  ${q.commissionedFaction ? ` • ${Handlebars.escapeExpression(q.commissionedFaction)}` : (q.giver ? ` • ${Handlebars.escapeExpression(q.giver)}` : '')}
                  ${totalTasks ? ` (${completedTasks}/${totalTasks})` : ''}
                </div>
              </div>
              ${IntotericaApp.hasPermission('permQuests') ? `
                <i class="fas fa-trash remove-profile-quest" title="Remove from Report" data-quest-id="${q.id}" data-is-manual="${q.isManual || false}" style="color: #c92a2a; cursor: pointer; padding: 4px; margin-left: auto; flex-shrink: 0;"></i>
              ` : ''}
            </div>
          `;
        }).join('');
      };

      const reportHtml = `
        <div class="section-header" style="margin-top: 2rem;">
            <div class="section-title">Mission Report</div>
            ${IntotericaApp.hasPermission('permQuests') ? `<button type="button" class="add-legacy-quest" style="font-size: 12px;"><i class="fas fa-plus"></i> Add Entry</button>` : ''}
        </div>
        <div class="content-grid two-column" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="report-column">
             <h3 class="quest-section-header completed">Completed</h3>
             ${generateQuestHtml(_context.profile.completedQuests, 'completed')}
          </div>
          <div class="report-column">
             <h3 class="quest-section-header failed">Failed</h3>
             ${generateQuestHtml(_context.profile.failedQuests, 'failed')}
          </div>
        </div>
      `;
      
      content.append(reportHtml);
      content.find('.profile-quest-link').click(this._onProfileQuestClick.bind(this));

      if (IntotericaApp.hasPermission('permQuests')) {
          content.find('.remove-profile-quest').click(this._onRemoveProfileQuest.bind(this));
          content.find('.add-legacy-quest').click(this._onAddLegacyQuest.bind(this));
      }
    }

    // Permission-based controls
    if (IntotericaApp.hasPermission('permBadges')) {
      html.find('.add-badge').click(this._onAddBadge.bind(this));
      html.find('.manage-badge').click(this._onManageBadge.bind(this));
      html.find('.edit-badge').click(this._onEditBadge.bind(this));
    }
    if (IntotericaApp.hasPermission('permQuests')) {
      html.find('.add-quest').click(this._onAddQuest.bind(this));
      html.find('.activate-quest-btn').click(this._onActivateQuest.bind(this));
      html.find('.complete-quest').click(this._onCompleteQuest.bind(this));
      html.find('.fail-quest').click(this._onFailQuest.bind(this));
      html.find('.reopen-quest').click(this._onReopenQuest.bind(this));
      html.find('.edit-quest').click(this._onEditQuest.bind(this));
    }
    if (IntotericaApp.hasPermission('permFactions')) {
      html.find('.adjust-reputation').click(this._onAdjustReputation.bind(this));
      html.find('.add-faction').click(this._onAddFaction.bind(this));
      html.find('.add-member').click(this._onAddMember.bind(this));
      html.find('.award-xp').click(this._onAwardXP.bind(this));
      html.find('.toggle-auto-rep').change(this._onToggleAutoRep.bind(this));
      html.find('.member-rep-slider').change(this._onMemberRepChange.bind(this));
      html.find('.faction-rep-slider').change(this._onFactionRepSliderChange.bind(this));
      html.find('.edit-faction').click(this._onEditFaction.bind(this));
      html.find('.enlist-faction').click(this._onEnlistFaction.bind(this));
      html.find('.remove-member').click(this._onRemoveMember.bind(this));
    }
    if (IntotericaApp.hasPermission('permClock')) {
      html.find('.edit-clock').click(this._onEditClock.bind(this));
    }

    // Start idle sound if enabled (Async - do not await to prevent blocking UI)
    const enableSounds = game.settings.get('intoterica', 'enableSounds');
    const soundPath = IntotericaApp.getSoundPath('idle');

    if (enableSounds && !this._idleSound && soundPath && !this._isClosing) {
      const themeKey = game.settings.get('intoterica', 'theme');
      const themeConfig = IntotericaApp.THEMES[themeKey];
      let volume = game.settings.get('intoterica', 'volumeAmbience');
      
      if (themeConfig && themeConfig.volumeScale) {
          volume = Math.min(1.0, volume * themeConfig.volumeScale);
      }

      foundry.audio.AudioHelper.play({
        src: soundPath,
        volume: volume,
        loop: true
      }, false).then(sound => {
        if (this._isClosing) {
            sound.stop();
            return;
        }
        this._idleSound = sound;
      }).catch(err => {
        console.warn("Intoterica | Error playing idle sound:", err);
      });
    }
  }

  _renderFactionDetail(html, faction) {
      const container = html.find('.faction-detail');
      if (!container.length) return;
      
      // Clear existing content (from HBS) to replace with new UX
      container.empty();

      const isGM = IntotericaApp.hasPermission('permFactions');
      const tab = this.activeFactionTab;
      const enableFactionXP = game.settings.get('intoterica', 'enableFactionXP');

      // 1. Header
      const headerHtml = `
        <div class="faction-detail-header">
            <div class="faction-detail-info">
                ${faction.isImage ? `<img src="${faction.image}" class="faction-detail-icon" style="object-fit: contain; border: none;">` : `<div class="faction-detail-icon">${faction.image}</div>`}
                <div>
                    <div class="faction-detail-name">${faction.name}</div>
                    <div class="standing-label" style="color: ${faction.statusColor}">${faction.statusLabel} (${faction.reputation})</div>
                </div>
            </div>
            <div class="faction-actions">
                <button type="button" class="close-faction-detail" title="Close Details" style="margin-right: 5px;"><i class="fas fa-times"></i></button>
                ${isGM ? `<button type="button" class="edit-faction" data-faction-id="${faction.id}"><i class="fas fa-edit"></i> Edit</button>` : ''}
                ${faction.canEnlist ? `<button type="button" class="enlist-faction" data-faction-id="${faction.id}"><i class="fas fa-signature"></i> Enlist</button>` : ''}
            </div>
        </div>
      `;

      // 2. Tabs
      const tabsHtml = `
        <div class="faction-tabs">
            <div class="faction-tab ${tab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</div>
            <div class="faction-tab ${tab === 'npcs' ? 'active' : ''}" data-tab="npcs">Members</div>
            <div class="faction-tab ${tab === 'ranks' ? 'active' : ''}" data-tab="ranks">Ranks</div>
        </div>
      `;

      // 3. Content
      let contentHtml = '';

      if (tab === 'overview') {
          // Reputation Slider Logic (Auto or Manual)
          let repValue = faction.partyReputation;
          if (faction.autoCalc === false) {
              repValue = faction.reputation;
          }
          if (repValue === undefined) repValue = 0;

          const repStatus = this._getRepStatus(repValue);
          const sliderClass = 'party-rep-slider';
          const label = 'Party Reputation (Global)';
          
          const totalPCs = game.users.filter(u => !u.isGM && u.character).length;
          const partyWeight = Math.max(0, totalPCs - faction.playerMembers.length);
          const subLabel = `Represents non-enlisted party members (Weight: ${partyWeight}).`;
          
          contentHtml = `
            <div class="faction-description" style="margin-bottom: 1.5rem; white-space: pre-wrap;">${faction.description || "No description provided."}</div>
            
            <div class="rep-section" style="background: rgba(0,0,0,0.1); padding: 10px; border-radius: 4px; margin-bottom: 1.5rem; border: 1px solid var(--theme-border);">
                <div style="font-weight: bold; margin-bottom: 5px; display: flex; justify-content: space-between;">
                    <span>${label}</span>
                    <span style="color: ${repStatus.color}; text-shadow: 0 0 3px #000;">${repStatus.label}</span>
                </div>
                <div style="font-size: 11px; opacity: 0.7; margin-bottom: 5px;">${subLabel}</div>
                ${isGM ? `<input type="range" class="${sliderClass}" min="-100" max="100" value="${repValue}" data-faction-id="${faction.id}" style="width: 100%;">` : ''}
            </div>

            <div class="section-header">
                <div class="section-title" style="font-size: 16px;">Player Members</div>
                ${isGM ? (enableFactionXP ? 
                    `<button type="button" class="award-xp" style="font-size: 11px;"><i class="fas fa-star"></i> Award XP</button>` : 
                    `<button type="button" class="adjust-player-rank" style="font-size: 11px;"><i class="fas fa-layer-group"></i> Adjust Rank</button>`
                ) : ''}
            </div>
            
            <div class="member-card-grid">
                ${faction.playerMembers.length ? faction.playerMembers.map(m => {
                    const rankName = faction.ranks[m.rank]?.name || "Rank " + m.rank;
                    const mStatus = this._getRepStatus(m.reputation);
                    return `
                    <div class="member-card-small">
                        <div class="member-card-header">
                            <img src="${game.actors.get(m.id)?.img || 'icons/svg/mystery-man.svg'}" class="member-card-img">
                            <div style="overflow: hidden;">
                                <div style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</div>
                                <div style="font-size: 10px; opacity: 0.7;">${rankName} • ${m.xp} XP</div>
                            </div>
                            ${isGM ? `<i class="fas fa-times remove-member" data-faction-id="${faction.id}" data-member-id="${m.id}" style="margin-left: auto; cursor: pointer; color: #c92a2a;"></i>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                            <span>Rep:</span>
                            <span style="font-weight: bold; color: ${mStatus.color}; text-shadow: 0 0 3px #000;">${mStatus.label}</span>
                        </div>
                        ${isGM ? `<input type="range" class="member-rep-slider" min="-100" max="100" value="${m.reputation}" data-faction-id="${faction.id}" data-member-id="${m.id}" style="width: 100%;">` : ''}
                    </div>`;
                }).join('') : '<div class="empty-text">No players enlisted.</div>'}
            </div>
          `;
      } else if (tab === 'npcs') {
          const isEditing = this.isEditingMembers && isGM;

          contentHtml = `
            <div class="section-header">
                <div class="section-title" style="font-size: 16px;">Faction Hierarchy</div>
                ${isGM ? `
                    <button type="button" class="toggle-member-edit" style="font-size: 11px;">
                        ${isEditing ? '<i class="fas fa-check"></i> Done' : '<i class="fas fa-edit"></i> Manage NPCs'}
                    </button>
                ` : ''}
            </div>
          `;

          if (faction.ranks.length === 0) {
              const dropZoneClass = isEditing ? 'npc-drop-zone' : '';
              const borderStyle = isEditing ? 'border: 2px dashed var(--theme-dim);' : 'border: 1px solid var(--theme-border);';
              
              contentHtml += `
                <div class="rank-tier ${dropZoneClass}" data-rank-index="0" style="${borderStyle} border-radius: 4px; padding: 5px; background: rgba(0,0,0,0.05);">
                    <div class="rank-tier-header" style="font-weight: bold; border-bottom: 1px solid var(--theme-border); margin-bottom: 5px; padding-bottom: 2px; font-size: 12px;">
                        Members ${isEditing ? '<span style="font-weight:normal; opacity:0.7; font-size:10px;">(Drag actors here)</span>' : ''}
                    </div>
                    <div class="member-card-grid" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
                        ${(faction.members || []).map(m => {
                            const actor = game.actors.get(m.id);
                            const img = actor?.img || "icons/svg/mystery-man.svg";
                            const isPlayer = m.type === 'Player';
                            return `
                            <div class="member-card-small" style="${isPlayer ? 'border: 1px solid var(--color-text-hyperlink);' : ''}">
                                <div class="member-card-header">
                                    <img src="${img}" class="member-card-img">
                                    <div style="overflow: hidden;">
                                        <div style="font-weight: bold; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</div>
                                        <div style="font-size: 9px; opacity: 0.7;">${isPlayer ? 'Player' : 'NPC'}</div>
                                    </div>
                                    ${isEditing ? `<i class="fas fa-times remove-member" data-faction-id="${faction.id}" data-member-id="${m.id}" style="margin-left: auto; cursor: pointer; color: #c92a2a;"></i>` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                        ${(faction.members || []).length === 0 ? '<div style="font-size: 10px; opacity: 0.5; padding: 5px;">No members</div>' : ''}
                    </div>
                </div>`;
          } else {
              const ranksReversed = [...faction.ranks].map((r, i) => ({...r, index: i})).reverse();
              contentHtml += `<div class="hierarchy-tree" style="display: flex; flex-direction: column; gap: 10px;">`;
              
              ranksReversed.forEach(rank => {
                  const membersInRank = (faction.members || []).filter(m => m.rank === rank.index);
                  const dropZoneClass = isEditing ? 'npc-drop-zone' : '';
                  const borderStyle = isEditing ? 'border: 2px dashed var(--theme-dim);' : 'border: 1px solid var(--theme-border);';

                  contentHtml += `
                    <div class="rank-tier ${dropZoneClass}" data-rank-index="${rank.index}" style="${borderStyle} border-radius: 4px; padding: 5px; background: rgba(0,0,0,0.05);">
                        <div class="rank-tier-header" style="font-weight: bold; border-bottom: 1px solid var(--theme-border); margin-bottom: 5px; padding-bottom: 2px; font-size: 12px; display: flex; justify-content: space-between;">
                            <span>${rank.name} ${isEditing ? '<span style="font-weight:normal; opacity:0.7; font-size:10px; margin-left:5px;">(Drag to add)</span>' : ''}</span>
                            <span style="opacity: 0.6; font-size: 10px;">XP: ${rank.xp}</span>
                        </div>
                        <div class="member-card-grid" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
                            ${membersInRank.map(m => {
                                const actor = game.actors.get(m.id);
                                const img = actor?.img || "icons/svg/mystery-man.svg";
                                const isPlayer = m.type === 'Player';
                                const draggable = isEditing ? 'draggable="true"' : '';
                                const dragStyle = isEditing ? 'cursor: grab;' : '';

                                return `
                                <div class="member-card-small" ${draggable} data-member-id="${m.id}" data-faction-id="${faction.id}" style="${isPlayer ? 'border: 1px solid var(--color-text-hyperlink);' : ''} ${dragStyle}">
                                    <div class="member-card-header">
                                        <img src="${img}" class="member-card-img">
                                        <div style="overflow: hidden;">
                                            <div style="font-weight: bold; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</div>
                                            <div style="font-size: 9px; opacity: 0.7;">${isPlayer ? 'Player' : 'NPC'}</div>
                                        </div>
                                        ${isEditing ? `<i class="fas fa-times remove-member" data-faction-id="${faction.id}" data-member-id="${m.id}" style="margin-left: auto; cursor: pointer; color: #c92a2a;"></i>` : ''}
                                    </div>
                                    <div style="margin-top: 5px; font-size: 10px; opacity: 0.8;">
                                        ${faction.ranks[m.rank]?.name || 'Rank ' + m.rank}
                                    </div>
                                </div>`;
                            }).join('')}
                            ${membersInRank.length === 0 ? '<div style="font-size: 10px; opacity: 0.5; padding: 5px;">No members</div>' : ''}
                        </div>
                    </div>
                  `;
              });
              contentHtml += `</div>`;
          }
      } else if (tab === 'ranks') {
          const isEditing = this.isEditingRanks && isGM;
          
          contentHtml = `
            <div class="section-header">
                <div class="section-title" style="font-size: 16px;">Rank Structure</div>
                ${isGM ? `
                    <div style="display: flex; gap: 5px;">
                        ${isEditing ? `<button type="button" class="add-rank-btn" style="font-size: 11px;"><i class="fas fa-plus"></i> Add</button>` : ''}
                        <button type="button" class="toggle-rank-edit" style="font-size: 11px;">
                            ${isEditing ? '<i class="fas fa-check"></i> Done' : '<i class="fas fa-edit"></i> Edit'}
                        </button>
                    </div>
                ` : ''}
            </div>
          `;

          if (isEditing) {
              contentHtml += `
                <table class="rank-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">Name</th>
                            <th style="width: 10%;">XP</th>
                            <th style="width: 10%;">Mod</th>
                            <th>Description</th>
                            <th style="width: 30px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${faction.ranks.map((r, i) => `
                            <tr>
                                <td><input type="text" class="rank-input" data-idx="${i}" data-field="name" value="${r.name}"></td>
                                <td><input type="number" class="rank-input" data-idx="${i}" data-field="xp" value="${r.xp}"></td>
                                <td><input type="number" class="rank-input" data-idx="${i}" data-field="modifier" value="${r.modifier}" step="0.1"></td>
                                <td><input type="text" class="rank-input" data-idx="${i}" data-field="description" value="${r.description || ''}" placeholder="Description..."></td>
                                <td><i class="fas fa-trash delete-rank-btn" data-idx="${i}" style="cursor: pointer; color: #c92a2a;"></i></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
          } else {
              contentHtml += `
                <div class="rank-list">
                    ${faction.ranks.map(r => `
                        <div class="rank-display-card">
                            <div class="rank-display-header">
                                <span class="rank-display-name">${r.name}</span>
                                <span class="rank-display-stats">XP: ${r.xp} | Mod: x${r.modifier}</span>
                            </div>
                            <div class="rank-display-desc">${r.description || "No description provided."}</div>
                        </div>
                    `).join('')}
                    ${faction.ranks.length === 0 ? '<div class="empty-text">No ranks defined.</div>' : ''}
                </div>`;
          }
      }

      container.append(headerHtml + tabsHtml + contentHtml);

      // Bind Events
      container.find('.faction-tab').click(ev => {
          this.activeFactionTab = ev.currentTarget.dataset.tab;
          this.render();
      });
      container.find('.close-faction-detail').click(this._onCloseFactionDetail.bind(this));

      if (isGM) {
          container.find('.party-rep-slider').change(this._onPartyRepChange.bind(this));
          container.find('.faction-rep-slider').change(this._onFactionRepSliderChange.bind(this));
          container.find('.npc-drop-zone').each((i, el) => {
              el.addEventListener('drop', this._onDropFactionMember.bind(this));
              el.addEventListener('dragover', e => e.preventDefault());
          });
          container.find('.member-card-small').on('dragstart', this._onDragMemberStart.bind(this));
          container.find('.rank-input').change(this._onUpdateRank.bind(this));
          container.find('.add-rank-btn').click(this._onAddRank.bind(this));
          container.find('.delete-rank-btn').click(this._onDeleteRank.bind(this));
          container.find('.toggle-rank-edit').click(this._onToggleRankEdit.bind(this));
          container.find('.toggle-member-edit').click(this._onToggleMemberEdit.bind(this));
          container.find('.adjust-player-rank').click(this._onAdjustPlayerRank.bind(this));
      }
  }

  _onViewChange(event) {
    event.preventDefault();
    if (game.settings.get('intoterica', 'enableSounds')) {
      const soundPath = IntotericaApp.getSoundPath('nav');
      let volume = game.settings.get('intoterica', 'volumeInterface');
      
      // Apply Theme Scale
      const themeKey = game.settings.get('intoterica', 'theme');
      const themeConfig = IntotericaApp.THEMES[themeKey];
      if (themeConfig && themeConfig.volumeScale) {
          volume = Math.min(1.0, volume * themeConfig.volumeScale);
      }
      
      if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: volume, autoplay: true, loop: false}, false);
    }
    this.currentView = event.currentTarget.dataset.view;
    this.profileActorId = null;
    this.render();
  }

  _onSelectPlayer(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    if (actorId) {
      IntotericaApp.openProfile(actorId);
    }
  }

  _onCloseProfile(event) {
    event.preventDefault();
    event.stopPropagation();
    this.profileActorId = null;
    // Small delay to ensure event bubbling finishes before DOM destruction
    setTimeout(() => this.render(), 10);
  }

  _onProfileQuestClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data') || {};
    const quest = (settings.quests || []).find(q => q.id === questId);
    this.currentView = 'quests';
    if (quest && quest.status) {
      const st = quest.status.toLowerCase();
      if (st === 'available' || st === 'inactive') {
        this.questFilter = 'available';
      } else if (st === 'completed') {
        this.questFilter = 'completed';
      } else if (st === 'failed') {
        this.questFilter = 'failed';
      } else {
        this.questFilter = 'active';
      }
    } else {
      this.questFilter = 'active';
    }
    this.profileActorId = null;
    if (questId) {
      this.expandedQuestIds.add(questId);
    }
    this.render();
    if (questId) {
      setTimeout(() => {
        const questEl = $(this.element).find(`.quest-card[data-quest-id="${questId}"], .quest-item[data-quest-id="${questId}"]`);
        if (questEl.length) {
          questEl[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          questEl.css('box-shadow', '0 0 15px var(--theme-accent)');
          setTimeout(() => { questEl.css('box-shadow', ''); }, 1500);
        }
      }, 100);
    }
  }

  async _onProfileEditFactionXP(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) return;

    const btn = event.currentTarget;
    const factionId = btn.dataset.factionId;
    const actorId = btn.dataset.actorId || btn.dataset.memberId;

    const rawSettings = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(rawSettings);
    const faction = (settings.factions || []).find(f => f.id === factionId);
    if (!faction) return;

    const member = (faction.members || []).find(m => m.id === actorId);
    if (!member) {
      ui.notifications.warn("Character is not a member of this faction.");
      return;
    }

    const actor = game.actors.get(actorId);
    const currentXP = member.xp || 0;
    const currentRankIdx = member.rank || 0;
    const ranks = faction.ranks || [];

    // Build rank select options
    const rankOptions = ranks.map((r, i) => `<option value="${i}" ${i === currentRankIdx ? 'selected' : ''}>${r.name}${r.xp != null ? ` (${r.xp} XP threshold)` : ''}</option>`).join('');

    IntotericaApp.createDialog({
      title: `Edit Faction Standing: ${actor?.name || actorId}`,
      content: `
        <form class="intoterica-form">
          <div style="display: flex; align-items: center; gap: 10px; background: var(--dialog-section-bg, rgba(0,0,0,0.06)); border: 1px solid var(--dialog-section-border, var(--theme-border)); border-radius: 6px; padding: 10px; margin-bottom: 12px;">
            ${faction.image ? `<img src="${faction.image}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; flex-shrink: 0;" />` : ''}
            <div>
              <div style="font-weight: 700; font-size: 13px;">${Handlebars.escapeExpression(faction.name)}</div>
              <div style="font-size: 11px; color: var(--theme-dim);">Editing standing for <strong>${Handlebars.escapeExpression(actor?.name || actorId)}</strong></div>
            </div>
          </div>
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-star" style="color: #f59f00;"></i> Faction XP</div>
            <div class="form-group">
              <label>Current XP</label>
              <input type="number" name="xp" value="${currentXP}" min="0" step="1" autofocus />
            </div>
          </div>
          ${ranks.length > 0 ? `
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-shield-alt" style="color: var(--theme-accent);"></i> Rank Override</div>
              <div class="form-group">
                <label>Rank</label>
                <select name="rankIndex">
                  ${rankOptions}
                </select>
              </div>
              <div style="font-size: 10px; color: var(--theme-dim); margin-top: 4px;"><i class="fas fa-info-circle"></i> Rank is normally auto-calculated from XP. Override here if needed.</div>
            </div>
          ` : ''}
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: 'Save',
          callback: async (html) => {
            const newXP = Math.max(0, parseInt(html.find('input[name="xp"]').val()) || 0);
            let newRankIdx = parseInt(html.find('select[name="rankIndex"]').val());
            if (isNaN(newRankIdx)) newRankIdx = currentRankIdx;

            // Auto-promote rank from XP if ranks exist
            if (ranks.length > 0) {
              let autoRankIdx = 0;
              for (let i = 0; i < ranks.length; i++) {
                if (newXP >= (ranks[i].xp || 0)) autoRankIdx = i;
              }
              // Only auto-set if user didn't manually change the dropdown selection,
              // but we still respect the user's explicit choice from the select
              newRankIdx = newRankIdx;
            }

            member.xp = newXP;
            member.rank = newRankIdx;

            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();

            const rankName = ranks[newRankIdx]?.name || newRankIdx;
            ui.notifications.info(`Updated ${actor?.name || actorId}'s ${faction.name} standing: ${newXP} XP, Rank: ${rankName}`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'save'
    }, { width: 420 }).render(true);
  }

  async _onToggleQuestVisibility(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) return;
    const questId = event.currentTarget.dataset.questId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    if (quest.status === 'Hidden') {
      quest.status = quest._prevStatus || 'Active';
      delete quest._prevStatus;
    }
    quest.hidden = !Boolean(quest.hidden);
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${quest.title || quest.name}" is now ${quest.hidden ? 'hidden from' : 'visible to'} players.`);
  }

  async _onToggleQuestTaskVisibility(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) return;
    const questId = event.currentTarget.dataset.questId;
    const taskId = event.currentTarget.dataset.taskId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest || !Array.isArray(quest.tasks)) return;

    const task = quest.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.hidden = !task.hidden;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Objective "${task.text}" is now ${task.hidden ? 'hidden from' : 'visible to'} players.`);
  }

  async _onToggleQuestTaskSubstory(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) return;
    const questId = event.currentTarget.dataset.questId;
    const taskId = event.currentTarget.dataset.taskId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest || !Array.isArray(quest.tasks)) return;

    const task = quest.tasks.find(t => t.id === taskId);
    if (!task) return;

    const isSub = !Boolean(task.isSubstory || task.isSubquest);
    task.isSubstory = isSub;
    task.isSubquest = isSub;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Objective "${task.text}" converted to ${isSub ? 'Substory header' : 'standard objective'}.`);
  }

  async _onActivateQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) return;
    const questId = event.currentTarget.dataset.questId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    quest.status = 'Active';
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    this._sendQuestChatNotification(quest, 'active');
    ui.notifications.info(`Quest "${quest.title || quest.name}" is now Active!`);
  }

  _onSelectFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    this.selectedFaction = settings.factions.find(f => f.id === factionId);
    this.activeFactionTab = 'overview'; // Reset tab on selection
    this.isEditingRanks = false;
    this.render();
  }

  _onCloseFactionDetail(event) {
    event.preventDefault();
    this.selectedFaction = null;
    this.isEditingRanks = false;
    this.render();
  }

  _onToggleRankEdit(event) {
    event.preventDefault();
    this.isEditingRanks = !this.isEditingRanks;
    this.render();
  }

  _onToggleMemberEdit(event) {
    event.preventDefault();
    this.isEditingMembers = !this.isEditingMembers;
    this.render();
  }

  async _onReadMessage(event) {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    const settings = game.settings.get('intoterica', 'data');
    
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;

    // Set view state
    this.mailViewSubject = message.subject || "(No Subject)";
    this.mailComposeData = null;
    this.render();
    
    if (!IntotericaApp.hasPermission('permMail')) {
        game.socket.emit('module.intoterica', {
            type: 'dispatch',
            action: 'readMessage',
            payload: { messageId, userId: game.user.id }
        });
        return;
    }

    await this._performReadMessage(messageId, game.user.id);
    this.render();
  }

  async _performReadMessage(messageId, userId) {
    const settings = game.settings.get('intoterica', 'data');
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;

    const normalizedSubject = (message.subject || "(No Subject)").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const threadMessages = settings.inbox.filter(m => {
        const mSubject = m.subject || "(No Subject)";
        return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
    });

    let updated = false;
    threadMessages.forEach(m => {
        // Initialize readBy if missing (Migration)
        if (!Array.isArray(m.readBy)) {
            // If legacy status was 'read', assume read by everyone to prevent old mail appearing unread
            if (m.status === 'read') {
                m.readBy = game.users.map(u => u.id);
            } else {
                m.readBy = [];
            }
        }

        if (!m.readBy.includes(userId)) {
            m.readBy.push(userId);
            updated = true;
        }
    });

    if (updated) {
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
    }
  }

  _onDeleteThreadAction(event) {
    event.preventDefault();
    if (this.mailViewSubject !== null) {
      this._deleteThread(this.mailViewSubject);
    }
  }

  async _deleteThread(subject) {
    const settings = game.settings.get('intoterica', 'data');
    const normalizedSubject = subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    settings.inbox = settings.inbox.filter(m => {
        const mSubject = m.subject || "(No Subject)";
        return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() !== normalizedSubject;
    });
    await game.settings.set('intoterica', 'data', settings);
    this.mailViewSubject = null;
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Conversation deleted.`);
  }

  async _deleteMessage(event) {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    const settings = game.settings.get('intoterica', 'data');
    
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;
    
    const subject = message.subject;
    settings.inbox = settings.inbox.filter(m => m.id !== messageId);
    
    if (!settings.inbox.some(m => m.subject === subject)) {
        this.mailViewSubject = null;
    }
    
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info("Message deleted.");
  }

  async _onEndConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      if (!settings.closedThreads) settings.closedThreads = [];
      
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      if (!settings.closedThreads.includes(normalizedSubject)) {
          settings.closedThreads.push(normalizedSubject);
      }
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  }

  async _onReopenConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      settings.closedThreads = (settings.closedThreads || []).filter(s => s !== normalizedSubject);
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  }

  async _onDropKnownNPC(event) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    if (data.type !== 'Actor') return;
    
    const settings = game.settings.get('intoterica', 'data');
    const known = settings.knownNPCs || [];
    
    // Handle UUID or ID
    let actorId = data.uuid ? data.uuid.split('.').pop() : data.id;
    const actor = game.actors.get(actorId);
    
    if (actor && !actor.hasPlayerOwner && !known.includes(actorId)) {
        known.push(actorId);
        settings.knownNPCs = known;
        await this._saveData(settings);
        this._broadcastUpdate();
        this.render();
        ui.notifications.info(`${actor.name} added to Known NPCs.`);
    }
  }

  async _onRemoveKnownNPC(event) {
      event.preventDefault();
      const id = event.currentTarget.dataset.id;
      const settings = game.settings.get('intoterica', 'data');
      settings.knownNPCs = (settings.knownNPCs || []).filter(k => k !== id);
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  }

  async _onAddBadge(event) {
    event.preventDefault();
    
    IntotericaApp.createDialog({
      title: "Create Merit Badge",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Badge Details</div>
            <div class="form-grid-name-icon">
              <div class="form-group">
                <label>Badge Name</label>
                <input type="text" name="name" placeholder="Enter badge name" autofocus required />
              </div>
              <div class="form-group">
                <label>Icon / Emoji</label>
                <div class="file-picker-group">
                  <input type="text" name="icon" value="⭐" />
                  <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Description & Criteria</label>
              <textarea name="description" placeholder="Describe the achievement or criteria required to earn this badge..." rows="3"></textarea>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            await this._createBadge(formData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                callback: (path) => input.val(path)
            }).render(true);
        });
      },
      default: "create"
    }, { width: 480 }).render(true);
  }

  async _createBadge(data) {
    const settings = game.settings.get('intoterica', 'data');
    const newBadge = {
      id: foundry.utils.randomID(),
      name: data.name,
      description: data.description,
      icon: data.icon || "⭐",
      earnedBy: []
    };
    
    settings.meritBadges.push(newBadge);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Badge "${data.name}" created`);
  }

  async _onManageBadge(event) {
    event.preventDefault();
    const badgeId = event.currentTarget.dataset.badgeId;
    const settings = game.settings.get('intoterica', 'data');
    const badge = settings.meritBadges.find(b => b.id === badgeId);
    if (!badge) return;

    if (!badge.earnedBy) badge.earnedBy = [];
    const previousEarned = [...badge.earnedBy];

    const players = game.users.filter(u => !u.isGM && u.character).map(u => {
      return { id: u.character.id, name: u.character.name, hasBadge: badge.earnedBy.includes(u.character.id) };
    });

    const playerCheckboxes = players.length > 0 ? players.map(p => `
      <div class="form-toggle-card">
        <input type="checkbox" name="${p.id}" id="badge-p-${p.id}" ${p.hasBadge ? 'checked' : ''} />
        <label for="badge-p-${p.id}">${p.name}</label>
      </div>
    `).join('') : '<div style="color: var(--theme-dim); font-style: italic; font-size: 12px; padding: 6px;">No player characters found.</div>';

    IntotericaApp.createDialog({
      title: `Award Badge: ${badge.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-award"></i> Select Recipients</div>
            <p style="font-size: 12px; color: var(--theme-dim); margin: 0 0 8px 0;">Select characters to award <strong>${badge.name}</strong>:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 250px; overflow-y: auto;">
              ${playerCheckboxes}
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            const newEarnedBy = Object.keys(formData).filter(k => formData[k]);
            const newlyAwarded = newEarnedBy.filter(id => !previousEarned.includes(id));
            
            badge.earnedBy = newEarnedBy;
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
            
            if (newlyAwarded.length > 0) {
                this._sendBadgeNotifications(badge, newlyAwarded);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { width: 480 }).render(true);
  }

  _sendBadgeNotifications(badge, actorIds) {
      if (!game.settings.get('intoterica', 'notifyBadges')) return;

      const isImage = badge.icon && (badge.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(badge.icon));
      
      actorIds.forEach(actorId => {
          const actor = game.actors.get(actorId);
          if (actor) {
              ChatMessage.create({
                  content: `
                    <div class="intoterica-chat-card">
                      <h3>Merit Badge Awarded!</h3>
                      <div class="card-content">
                        <div style="font-size: 14px; margin-bottom: 5px;">Awarded to <strong>${actor.name}</strong></div>
                        ${isImage ? `<img src="${badge.icon}" style="display: block; margin: 10px auto; width: 64px; height: 64px; border: none; object-fit: contain;">` : `<div style="font-size: 48px; margin: 10px 0;">${badge.icon}</div>`}
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${badge.name}</div>
                        <div style="font-style: italic; opacity: 0.8; font-size: 12px;">${badge.description}</div>
                      </div>
                    </div>
                  `
              });
          }
      });
  }

  async _onEditBadge(event) {
    event.preventDefault();
    const badgeId = event.currentTarget.dataset.badgeId;
    const settings = game.settings.get('intoterica', 'data');
    const badge = settings.meritBadges.find(b => b.id === badgeId);
    if (!badge) return;

    IntotericaApp.createDialog({
      title: `Edit Badge: ${badge.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Badge Details</div>
            <div class="form-grid-name-icon">
              <div class="form-group">
                <label>Badge Name</label>
                <input type="text" name="name" value="${badge.name}" placeholder="Badge name" autofocus required />
              </div>
              <div class="form-group">
                <label>Icon / Emoji</label>
                <div class="file-picker-group">
                  <input type="text" name="icon" value="${badge.icon}" />
                  <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Description & Criteria</label>
              <textarea name="description" placeholder="Achievement description..." rows="3">${badge.description || ''}</textarea>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            
            badge.name = formData.name;
            badge.description = formData.description;
            badge.icon = formData.icon;

            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        delete: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Delete",
            callback: async () => {
                settings.meritBadges = settings.meritBadges.filter(b => b.id !== badgeId);
                await this._saveData(settings);
                this._broadcastUpdate();
                this.render();
            }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                callback: (path) => input.val(path)
            }).render(true);
        });
      },
      default: "save"
    }, { width: 480 }).render(true);
  }

  _onFilterQuests(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questFilter = event.currentTarget.dataset.filter || 'active';
    this.render();
  }

  _onSearchQuests(event) {
    this.questSearch = event.currentTarget.value || '';
    this._preserveSearchFocus = true;
    clearTimeout(this._questSearchTimer);
    this._questSearchTimer = setTimeout(() => {
      this.render();
    }, 120);
  }

  _onClearQuestSearch(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questSearch = '';
    this._preserveSearchFocus = false;
    this.render();
  }

  _onToggleQuestFilterToolbar(event) {
    event.preventDefault();
    event.stopPropagation();
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.render();
  }

  _onChangeQuestFactionFilter(event) {
    event.preventDefault();
    this.questFactionFilter = event.currentTarget.value || '';
    this.render();
  }

  _onChangeQuestGiverFilter(event) {
    event.preventDefault();
    this.questGiverFilter = event.currentTarget.value || '';
    this.render();
  }

  _onChangeQuestDifficultyFilter(event) {
    event.preventDefault();
    this.questDifficultyFilter = event.currentTarget.value || '';
    this.render();
  }

  _onChangeQuestSort(event) {
    event.preventDefault();
    this.questSort = event.currentTarget.value || 'default';
    this.render();
  }

  _onResetQuestFilters(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questFactionFilter = '';
    this.questGiverFilter = '';
    this.questDifficultyFilter = '';
    this.questSort = 'default';
    this.questSearch = '';
    this.render();
  }

  _onToggleExpandQuest(event) {
    event.preventDefault();
    const questId = event.currentTarget.dataset.questId;
    if (!questId) return;
    if (this.expandedQuestIds.has(questId)) {
      this.expandedQuestIds.delete(questId);
    } else {
      this.expandedQuestIds.add(questId);
    }
    this.render();
  }

  async _onToggleQuestPin(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can manage quests.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;
    
    quest.isPrimary = !quest.isPrimary;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${quest.title}" ${quest.isPrimary ? 'pinned as primary objective' : 'unpinned'}.`);
  }

  async _onToggleQuestTask(event) {
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can update quest objectives.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const taskId = event.currentTarget.dataset.taskId;
    const isChecked = event.currentTarget.checked;

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest || !Array.isArray(quest.tasks)) return;

    const task = quest.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = isChecked;
    if (isChecked) {
      task.failed = false;
    }
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
  }

  async _onToggleQuestTaskFail(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can update quest objectives.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const taskId = event.currentTarget.dataset.taskId;

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest || !Array.isArray(quest.tasks)) return;

    const task = quest.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.failed = !task.failed;
    if (task.failed) {
      task.completed = false;
    }
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
  }


  async _onCompleteQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can complete quests.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    await this._showRewardDistributionDialog(quest);
  }

  async _showRewardDistributionDialog(quest) {
    const settings = game.settings.get('intoterica', 'data');
    const rewards = quest.rewards || {};
    const playerActors = IntotericaApp.getPlayerActors();

    // Determine target recipients
    const isAssignAll = quest.assignedAll !== false && (!quest.assignedTo || quest.assignedTo.length === 0);
    const assignedIds = Array.isArray(quest.assignedTo) ? quest.assignedTo : [];
    const recipientActors = isAssignAll 
      ? playerActors 
      : playerActors.filter(a => assignedIds.includes(a.id));

    // Currencies list
    const systemCurrencies = IntotericaApp.getSystemCurrencies();
    const currencies = rewards.currencies || {};
    const activeCurrencies = Object.entries(currencies).filter(([k, v]) => Number(v) > 0);
    const hasLegacyCurrency = !activeCurrencies.length && rewards.currency;

    // Items list
    const items = Array.isArray(rewards.items) ? rewards.items : [];

    // Faction XP list
    const factionXpList = Array.isArray(rewards.factionXp) ? rewards.factionXp.filter(x => Number(x.amount) > 0) : [];
    if (!factionXpList.length && Number(rewards.xp) > 0) {
      const defaultFac = settings.factions?.[0];
      if (defaultFac) {
        factionXpList.push({ factionId: defaultFac.id, factionName: defaultFac.name, amount: Number(rewards.xp) });
      }
    }

    // Reputation impact
    const reputationsList = Array.isArray(rewards.reputations) && rewards.reputations.length > 0
      ? rewards.reputations.filter(r => Number(r.amount) !== 0)
      : (rewards.reputation && Number(rewards.reputation.amount || rewards.reputation.delta) !== 0 ? [rewards.reputation] : []);
    const hasRep = reputationsList.length > 0;

    // XP Automation Mode & Failed Objectives Proration
    const xpAutomationMode = game.settings.get('intoterica', 'questXpAutomation') || 'full';
    
    // Evaluate mandatory vs optional tasks
    const tasks = Array.isArray(quest.tasks) ? quest.tasks : [];
    const nonOptionalTasks = tasks.filter(t => !t.optional);
    const evalTasks = nonOptionalTasks.length > 0 ? nonOptionalTasks : tasks;
    const totalEval = evalTasks.length;
    const failedEval = evalTasks.filter(t => t.failed).length;

    let xpRatio = 1.0;
    let xpStatusNote = "";
    if (xpAutomationMode === 'disabled') {
      xpRatio = 0;
      xpStatusNote = "XP Automation Disabled in Settings";
    } else if (xpAutomationMode === 'proportional') {
      if (totalEval > 0 && failedEval > 0) {
        xpRatio = Math.max(0, (totalEval - failedEval) / totalEval);
        const pct = Math.round(xpRatio * 100);
        xpStatusNote = `Prorated: ${failedEval} of ${totalEval} objectives failed (${pct}% awarded)`;
      }
    }

    const hasAnyReward = activeCurrencies.length > 0 || hasLegacyCurrency || items.length > 0 || (factionXpList.length > 0 && xpAutomationMode !== 'disabled') || hasRep;

    if (!hasAnyReward || recipientActors.length === 0) {
      // No active rewards or player characters to distribute to; complete directly
      quest.status = 'Completed';
      const completedIds = isAssignAll ? recipientActors.map(a => a.id) : assignedIds;
      quest.completedBy = completedIds;
      quest.assignedTo = completedIds;
      quest.assignedAll = false;
      if (Array.isArray(quest.tasks)) {
        quest.tasks.forEach(t => {
          if (!t.failed) {
            t.completed = true;
          }
        });
      }
      quest.lastModified = Date.now();
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
      this._sendQuestChatNotification(quest, 'completed');
      ui.notifications.info(`Quest "${quest.title}" marked as Completed!`);
      return;
    }

    // Render Distribution Confirmation Dialog
    const currenciesSummary = activeCurrencies.map(([k, v]) => `<strong>${v} ${systemCurrencies[k] || k.toUpperCase()}</strong>`).join(', ') || (rewards.currency ? `<strong>${rewards.currency}</strong>` : 'None');

    IntotericaApp.createDialog({
      title: `Distribute Quest Rewards: ${quest.title}`,
      content: `
        <form class="intoterica-form" style="max-height: 560px; overflow-y: auto; padding-right: 2px;">
          <div style="background: rgba(43, 138, 62, 0.08); border: 1px solid rgba(43, 138, 62, 0.3); border-radius: 6px; padding: 10px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-trophy" style="font-size: 28px; color: #2b8a3e;"></i>
            <div>
              <div style="font-size: 14px; font-weight: bold; color: var(--dialog-section-title, #191813);">${Handlebars.escapeExpression(quest.title)}</div>
              <div style="font-size: 11px; opacity: 0.85;">Review and distribute quest rewards to player actor sheets and faction standing.</div>
            </div>
          </div>

          <!-- Recipients Selection -->
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-users"></i> Target Recipients (${recipientActors.length} Characters)</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px;">
              ${recipientActors.map(a => `
                <label class="player-assign-card assigned" style="padding: 4px 6px; display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" class="dist-recipient-cb" value="${a.id}" checked style="margin: 0; width: 13px; height: 13px; cursor: pointer;" />
                  <img src="${a.img || 'icons/svg/mystery-man.svg'}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;" />
                  <span style="font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.name}">${a.name}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Currency Distribution -->
          ${(activeCurrencies.length > 0 || hasLegacyCurrency) ? `
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-coins" style="color: #d4af37;"></i> Currency Rewards</div>
              <div style="font-size: 12px; margin-bottom: 6px;">Total Reward: ${currenciesSummary}</div>
              <div style="display: flex; gap: 12px; font-size: 11px;">
                <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="radio" name="currencyDistMode" value="split" checked style="margin: 0;" />
                  <span>Split equally among recipients</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="radio" name="currencyDistMode" value="full" style="margin: 0;" />
                  <span>Grant full amount to each recipient</span>
                </label>
              </div>
            </div>
          ` : ''}

          <!-- Items Distribution -->
          ${items.length > 0 ? `
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-box-open" style="color: #4facfe;"></i> Items & Equipment</div>
              <div style="font-size: 10px; color: var(--theme-dim); margin-bottom: 8px; padding: 4px 8px; background: rgba(79,172,254,0.08); border-left: 3px solid #4facfe; border-radius: 2px;">
                <i class="fas fa-info-circle"></i> Use the <strong>Assign to</strong> dropdown on each item to choose which character(s) receive it.
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${items.map((it, idx) => `
                  <div class="reward-item-row" style="display: flex; align-items: center; gap: 10px; background: var(--theme-surface); border: 1px solid var(--theme-border); border-radius: 6px; padding: 6px 10px;">
                    <img src="${it.img || 'icons/svg/item-bag.svg'}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: contain; flex-shrink: 0;" />
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Handlebars.escapeExpression(it.name)}<span style="color: var(--theme-accent); font-size: 10px; margin-left: 4px;">x${it.quantity || 1}</span></div>
                      <div style="font-size: 10px; color: var(--theme-dim); margin-top: 2px;">Assign to:</div>
                    </div>
                    <div style="flex-shrink: 0; min-width: 0; max-width: 240px;">
                      <select name="item_recipients_${idx}" multiple style="width: 100%; min-width: 160px; font-size: 11px; border: 1px solid var(--theme-border); border-radius: 4px; background: var(--theme-bg); color: var(--theme-text); padding: 2px 4px; max-height: 80px;">
                        ${recipientActors.map(a => `<option value="${a.id}" selected>${Handlebars.escapeExpression(a.name)}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="font-size: 10px; color: var(--theme-dim); margin-top: 6px;"><i class="fas fa-hand-pointer"></i> Hold <kbd>Ctrl</kbd> (or <kbd>Cmd</kbd>) to select multiple characters per item.</div>
            </div>
          ` : ''}

          <!-- Faction XP & Reputation -->
          ${(factionXpList.length > 0 || hasRep) ? `
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-shield-alt" style="color: var(--theme-accent);"></i> Faction Standing & XP</div>
              ${factionXpList.map(fx => {
                const fac = (settings.factions || []).find(f => f.id === fx.factionId || f.name === fx.factionName);
                const finalAmount = Math.round(fx.amount * xpRatio);
                const enrolledRecipients = playerActors.filter(a => (fac?.members || []).some(m => m.id === a.id && (m.type === 'Player' || !m.type)));
                const enrolledNames = enrolledRecipients.map(a => a.name).join(', ');
                return `
                  <div style="font-size: 11px; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="color: #f59f00; font-weight: bold;">⭐ +${finalAmount} XP</span>
                      <span>to <strong>${fx.factionName || fac?.name || 'Faction'}</strong> ${xpStatusNote ? `<em style="color: var(--theme-dim); font-size: 10px;">(${xpStatusNote})</em>` : '(Auto-promotes ranks upon threshold)'}</span>
                    </div>
                    <div style="font-size: 10px; margin-left: 20px; margin-top: 2px;">
                      ${enrolledRecipients.length > 0
                        ? `<span style="color: #40c057;"><i class="fas fa-user-check"></i> Enrolled members receiving XP:</span> <strong>${Handlebars.escapeExpression(enrolledNames)}</strong>`
                        : `<span style="color: #fa5252;"><i class="fas fa-exclamation-triangle"></i> No selected recipients are enrolled members of this faction (XP is only awarded to members).</span>`
                      }
                    </div>
                  </div>
                `;
              }).join('')}
              ${reputationsList.map(rep => {
                const fac = (settings.factions || []).find(f => f.id === rep.factionId);
                const delta = Number(rep.amount || rep.delta) || 0;
                return `
                  <div style="font-size: 11px; margin-top: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="color: ${delta >= 0 ? '#2b8a3e' : '#c92a2a'}; font-weight: bold;">
                        🛡️ ${delta >= 0 ? '+' : ''}${delta} Reputation
                      </span>
                      <span>with <strong>${rep.factionName || fac?.name || 'Faction'}</strong> (${isAssignAll ? 'Whole Party Standing' : 'Individual / Party Standing'})</span>
                    </div>
                    <div style="font-size: 10px; color: var(--theme-dim); margin-left: 20px; margin-top: 2px;">
                      <i class="fas fa-users" style="color: #4facfe;"></i> Reputation applies to all recipients regardless of membership.
                    </div>
                  </div>
                `;
              }).join('')}
              <label style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; margin-top: 6px;">
                <input type="checkbox" name="applyFactionRewards" checked style="margin: 0;" />
                <span>Apply Faction XP (enrolled members only) and Reputation (all recipients)</span>
              </label>
            </div>
          ` : ''}
        </form>
      `,
      buttons: {
        distribute: {
          icon: '<i class="fas fa-gift"></i>',
          label: "Distribute & Complete",
          callback: async (html) => {
            const targetActorIds = html.find('.dist-recipient-cb:checked').map((i, el) => el.value).get();
            const targetActors = playerActors.filter(a => targetActorIds.includes(a.id));
            const splitMode = html.find('input[name="currencyDistMode"]:checked').val() || 'split';
            const doApplyFaction = html.find('input[name="applyFactionRewards"]').is(':checked');

            // 1. Distribute Currencies
            if (activeCurrencies.length > 0 && targetActors.length > 0) {
              const divisor = splitMode === 'split' ? targetActors.length : 1;
              for (const actor of targetActors) {
                await IntotericaApp.addCurrencyToActor(actor, currencies, divisor);
              }
            }

            // 2. Grant Items (per-item recipient assignment)
            if (items.length > 0) {
              for (let idx = 0; idx < items.length; idx++) {
                const itemRecipientIds = html.find(`select[name="item_recipients_${idx}"]`).val() || [];
                const itemActors = playerActors.filter(a => itemRecipientIds.includes(a.id));
                if (itemActors.length > 0) {
                  for (const actor of itemActors) {
                    await IntotericaApp.grantItemsToActor(actor, [items[idx]]);
                  }
                }
              }
            }

            // 3. Apply Faction XP & Reputation
            if (doApplyFaction) {
              // Faction XP (strictly for enrolled members)
              if (xpAutomationMode !== 'disabled') {
                for (const fx of factionXpList) {
                  const finalAmount = Math.round(Number(fx.amount) * xpRatio);
                  if (finalAmount > 0 && fx.factionId) {
                    const fac = (settings.factions || []).find(f => f.id === fx.factionId || f.name === fx.factionName);
                    const memberActorIds = (targetActorIds || []).filter(pid => (fac?.members || []).some(m => m.id === pid && (m.type === 'Player' || !m.type)));
                    if (memberActorIds.length > 0) {
                      await this._processXPAward(fx.factionId, finalAmount, memberActorIds);
                    }
                  }
                }
              }

              // Faction Reputation (awarded to all)
              if (hasRep) {
                for (const rep of reputationsList) {
                  const repFactionId = rep.factionId;
                  const delta = Number(rep.amount || rep.delta) || 0;
                  const fac = (settings.factions || []).find(f => f.id === repFactionId);
                  if (fac && delta !== 0) {
                    if (fac.autoCalc === false) {
                      fac.partyReputation = fac.reputation;
                      fac.autoCalc = true;
                    }
                    if (isAssignAll) {
                      fac.partyReputation = (fac.partyReputation || 0) + delta;
                    } else {
                      for (const pid of targetActorIds) {
                        const m = fac.members?.find(mem => mem.id === pid);
                        if (m) {
                          m.reputation = (m.reputation || 0) + delta;
                        } else {
                          // Non-members receive reputation via party standing
                          fac.partyReputation = (fac.partyReputation || 0) + delta;
                        }
                      }
                    }
                  }
                }
                await this._saveData(settings);
                this._broadcastUpdate();
              }
            }

            // 4. Mark Quest as Completed (preserve failed objectives!)
            quest.status = 'Completed';
            quest.completedBy = targetActorIds;
            quest.assignedTo = targetActorIds;
            quest.assignedAll = false;
            if (Array.isArray(quest.tasks)) {
              quest.tasks.forEach(t => {
                if (!t.failed) {
                  t.completed = true;
                }
              });
            }
            quest.lastModified = Date.now();
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
            this._sendQuestChatNotification(quest, 'completed');
            ui.notifications.info(`Quest "${quest.title}" completed and rewards distributed!`);
          }
        },
        completeOnly: {
          icon: '<i class="fas fa-check"></i>',
          label: "Complete Without Distributing",
          callback: async () => {
            quest.status = 'Completed';
            const completedIds = isAssignAll ? recipientActors.map(a => a.id) : assignedIds;
            quest.completedBy = completedIds;
            quest.assignedTo = completedIds;
            quest.assignedAll = false;
            if (Array.isArray(quest.tasks)) {
              quest.tasks.forEach(t => {
                if (!t.failed) {
                  t.completed = true;
                }
              });
            }
            quest.lastModified = Date.now();
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
            this._sendQuestChatNotification(quest, 'completed');
            ui.notifications.info(`Quest "${quest.title}" marked as Completed.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },

      default: "distribute"
    }, { width: 560 }).render(true);
  }

  async _onFailQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can fail quests.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    quest.status = 'Failed';
    const isAssignAll = quest.assignedAll !== false && (!quest.assignedTo || quest.assignedTo.length === 0);
    const failedIds = isAssignAll ? IntotericaApp.getPlayerActors().map(a => a.id) : (Array.isArray(quest.assignedTo) ? quest.assignedTo : []);
    quest.failedBy = failedIds;
    quest.assignedTo = failedIds;
    quest.assignedAll = false;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    this._sendQuestChatNotification(quest, 'failed');
    ui.notifications.warn(`Quest "${quest.title}" marked as Failed.`);
  }

  async _onReopenQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can reopen quests.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    quest.status = 'Active';
    delete quest.completedBy;
    delete quest.failedBy;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${quest.title}" reopened.`);
  }

  async _onShareQuestChat(event) {
    event.preventDefault();
    event.stopPropagation();
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    this._sendQuestChatNotification(quest, 'share');
  }

  _sendQuestChatNotification(quest, type = 'share') {
    if (!game.settings.get('intoterica', 'notifyQuests') && type !== 'share') return;

    let headerTitle = "Quest Journal";
    let icon = "📜";
    if (type === 'completed') {
      headerTitle = "Quest Completed!";
      icon = "🏆";
    } else if (type === 'failed') {
      headerTitle = "Quest Failed";
      icon = "❌";
    } else if (type === 'new') {
      headerTitle = "New Quest Available!";
      icon = "⚔️";
    }

    const tasksHtml = (quest.tasks && quest.tasks.length > 0) ? `
      <div style="margin: 8px 0; text-align: left; font-size: 12px;">
        <strong>Objectives:</strong>
        <ul style="margin: 4px 0 0 0; padding-left: 18px; list-style-type: none;">
          ${quest.tasks.map(t => `<li style="margin-bottom: 2px;">${t.completed ? '✅' : '◻️'} <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${t.text}</span></li>`).join('')}
        </ul>
      </div>
    ` : '';

    const rewards = quest.rewards || {};
    const factionXpList = Array.isArray(rewards.factionXp) ? rewards.factionXp.filter(fx => Number(fx.amount) > 0) : [];
    const reputationsList = Array.isArray(rewards.reputations)
      ? rewards.reputations.filter(r => Number(r.amount) !== 0)
      : (rewards.reputation && Number(rewards.reputation.amount) !== 0 ? [rewards.reputation] : []);
    const currencyStr = rewards.currency || (rewards.currencies && Object.entries(rewards.currencies).filter(([k,v]) => Number(v)>0).map(([k,v]) => `${v} ${k.toUpperCase()}`).join(', '));
    const itemsList = Array.isArray(rewards.items) ? rewards.items : [];
    const hasAnyReward = factionXpList.length > 0 || reputationsList.length > 0 || currencyStr || itemsList.length > 0 || rewards.xp || rewards.text;

    let rewardsHtml = '';
    if (hasAnyReward) {
      rewardsHtml = `
        <div style="margin-top: 6px; font-size: 11px; padding: 6px; background: rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; gap: 4px; text-align: left;">
          <strong>Rewards:</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            ${factionXpList.map(fx => `<span style="background: rgba(245, 159, 0, 0.2); color: #f59f00; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px;">⭐ +${fx.amount} XP (${fx.factionName})</span>`).join('')}
            ${(!factionXpList.length && rewards.xp) ? `<span style="background: rgba(245, 159, 0, 0.2); color: #f59f00; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px;">⭐ ${rewards.xp} XP</span>` : ''}
            ${reputationsList.map(rep => `<span style="background: ${rep.amount >= 0 ? 'rgba(43, 138, 62, 0.2)' : 'rgba(201, 42, 42, 0.2)'}; color: ${rep.amount >= 0 ? '#2b8a3e' : '#c92a2a'}; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px;">🛡️ ${rep.amount >= 0 ? '+' : ''}${rep.amount} Rep (${rep.factionName})</span>`).join('')}
            ${currencyStr ? `<span style="background: rgba(212, 175, 55, 0.2); color: #d4af37; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px;">🪙 ${currencyStr}</span>` : ''}
            ${itemsList.map(it => `<span style="background: rgba(79, 172, 254, 0.2); color: #4facfe; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px; display: inline-flex; align-items: center; gap: 3px;"><img src="${it.img || 'icons/svg/item-bag.svg'}" style="width: 14px; height: 14px; border-radius: 2px;" /> ${it.name} ${it.quantity > 1 ? `(x${it.quantity})` : ''}</span>`).join('')}
            ${rewards.text ? `<span>📦 ${rewards.text}</span>` : ''}
          </div>
        </div>
      `;
    }

    const descHtml = IntotericaApp.formatMarkdown(quest.description || "");

    ChatMessage.create({
      content: `
        <div class="intoterica-chat-card">
          <h3>${headerTitle}</h3>
          <div class="card-content">
            <div style="font-size: 36px; margin: 4px 0;">${icon}</div>
            <div style="font-size: 16px; font-weight: bold; color: var(--theme-accent); margin-bottom: 4px;">${quest.title}</div>
            ${quest.image ? `<img src="${quest.image}" style="max-height: 120px; width: 100%; object-fit: cover; border-radius: 4px; margin-bottom: 6px; border: 1px solid var(--theme-border);">` : ''}
            <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; opacity: 0.8; margin-bottom: 6px;">Difficulty: ${quest.difficulty || 'Medium'} • Status: ${quest.status}</div>
            ${descHtml ? `<div style="font-size: 12px; opacity: 0.9; margin-bottom: 6px; text-align: left; line-height: 1.4;">${descHtml}</div>` : ''}
            ${tasksHtml}
            ${rewardsHtml}
          </div>
        </div>
      `
    });
  }

  async _onAddQuest(event) {
    event.preventDefault();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can create quests.");
      return;
    }

    const settings = game.settings.get('intoterica', 'data');
    const playerActors = IntotericaApp.getPlayerActors();
    const factions = settings.factions || [];
    const systemCurrencies = IntotericaApp.getSystemCurrencies();

    const currencyInputsHtml = Object.entries(systemCurrencies).map(([key, label]) => `
      <div class="quest-currency-card" title="${Handlebars.escapeExpression(label)}">
        <div class="currency-card-header">
          <i class="fas fa-coins" style="color: #d4af37; font-size: 10px;"></i>
          <span class="currency-tag">${Handlebars.escapeExpression((label || key).toUpperCase())}</span>
        </div>
        <input type="number" class="currency-val-input" data-denom="${Handlebars.escapeExpression(key)}" placeholder="0" min="0" />
      </div>
    `).join('');

    const descEditorHtml = IntotericaApp.createRichTextEditorHtml('description', '', 'Provide quest narrative, background lore, clues, and objectives...');
    
    IntotericaApp.createDialog({
      title: "Create Quest",
      content: `
        <form class="intoterica-form" style="max-height: 640px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="details">
              <i class="fas fa-scroll"></i> Quest Details
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="rewards">
              <i class="fas fa-trophy"></i> Rewards
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="gm">
              <i class="fas fa-user-shield"></i> GM Secret Notes & Pin
            </button>
          </div>

          <!-- TAB 1: Quest Details -->
          <div class="dialog-tab-content active" data-tab="details" style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Top Integrated Header: Art Banner + Title & Metadata -->
            <div style="display: flex; gap: 14px; align-items: stretch; background: var(--dialog-card-bg, rgba(255, 255, 255, 0.5)); border: 1px solid var(--dialog-section-border, rgba(120, 46, 34, 0.25)); border-radius: 6px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
              
              <!-- Left: Clickable Portrait Banner -->
              <div class="quest-art-banner" title="Click to choose splash image">
                <img class="quest-preview-img" src="icons/svg/item-bag.svg" style="opacity: 0.35;" />
                <div class="quest-art-overlay"><i class="fas fa-camera"></i> Change Art</div>
                <input type="hidden" name="image" value="" class="quest-img-input" />
              </div>

              <!-- Right: Title + Metadata Strip -->
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; gap: 6px;">
                <div>
                  <input type="text" name="title" placeholder="Quest Title (e.g. Investigate the Sunken Crypt)..." class="quest-title-large" autofocus required />
                </div>
                
                <div class="quest-meta-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-signal"></i> Difficulty</label>
                    <select name="difficulty" class="quest-dialog-select">
                      ${IntotericaApp.getDifficultyOptions("Medium")}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-hourglass-half"></i> Status</label>
                    <select name="status" class="quest-dialog-select">
                      <option value="Active" selected>Active</option>
                      <option value="Available">Available</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                      <option value="Hidden">Hidden</option>
                    </select>
                  </div>
                </div>

                <!-- Commissioned By & Giver Section -->
                <div class="quest-commission-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-shield-alt"></i> Commissioned by (Faction)</label>
                    <select name="commissionedFaction" class="quest-dialog-select">
                      <option value="">— Independent / None —</option>
                      ${factions.map(f => `<option value="${f.name}">${f.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-user-circle"></i> Quest Giver / Issuer</label>
                    <select class="quest-giver-select quest-dialog-select" title="Choose from World Folders, NPCs, Factions...">
                      ${IntotericaApp.getQuestGiverOptions("")}
                    </select>
                    <input type="text" name="giver" class="quest-giver-custom-input" style="display: none; margin-top: 4px;" placeholder="Type custom giver name..." />
                  </div>
                </div>

              </div>

            </div>

            <!-- Player Assignment Section -->
            <div class="quest-assignment-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--dialog-section-title, #782e22); display: flex; align-items: center; gap: 5px;">
                  <i class="fas fa-users"></i> Assigned Players / Characters
                </div>
                <label class="assign-all-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #ff6400); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin: 0; user-select: none;">
                  <input type="checkbox" name="assignAll" class="assign-all-checkbox" checked style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                  <span>Assign to All Players (Whole Party)</span>
                </label>
              </div>
              ${playerActors.length ? `
                <div class="quest-player-assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px;">
                  ${playerActors.map(p => {
                    const avatar = p.img || p.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
                    return `
                      <label class="player-assign-card assigned" data-actor-id="${p.id}">
                        <input type="checkbox" name="assign_${p.id}" class="player-assign-cb" value="${p.id}" checked style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                        <img src="${avatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;" />
                        <span style="font-size: 11px; font-weight: 600; color: var(--dialog-input-text, #191813); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${p.name}">${p.name}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `<p style="font-size: 11px; font-style: italic; color: var(--theme-dim); margin: 0;">No player characters detected on the app.</p>`}
            </div>

            <!-- Bottom 2-Column Ledger: Description (Left) + Objectives & Tasks (Right) -->
            <div class="quest-editor-body" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 12px; align-items: stretch;">
              
              <!-- Left Column: Quest Description with Journal-Style Rich Text Editor -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title">
                  <span><i class="fas fa-feather-alt"></i> Quest Description</span>
                </div>
                ${descEditorHtml}
              </div>

              <!-- Right Column: Objectives & Tasks Builder -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title"><i class="fas fa-tasks"></i> Objectives & Tasks</div>
                <div class="quest-tasks-builder" style="flex: 1; max-height: 280px; overflow-y: auto; padding-right: 2px;">
                  <div class="quest-task-entry" draggable="true">
                    <input type="hidden" class="task-input-id" value="${foundry.utils.randomID()}" />
                    <div class="quest-task-main-row">
                      <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                      <input type="checkbox" class="task-input-completed" title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer;" />
                      <i class="fas fa-folder task-substory-static-icon" style="color: #1971c2; font-size: 14px; flex-shrink: 0; display: none;" title="Substory Header"></i>
                      <input type="text" class="task-input-text" placeholder="Objective description..." style="flex: 1; min-width: 0;" />
                      <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                    <div class="quest-task-badges-row">
                      <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="display: none;">
                        <i class="fas fa-plus"></i> Objective
                      </button>
                      <div class="quest-task-substory-badge" title="Toggle Substory (Header / Folder)">
                        <input type="checkbox" class="task-input-substory" style="display: none;" />
                        <i class="fas fa-folder"></i> Substory
                      </div>
                      <div class="quest-task-hide-badge" title="Toggle Hidden from Players">
                        <input type="checkbox" class="task-input-hidden" style="display: none;" />
                        <i class="fas fa-eye-slash"></i> Hidden
                      </div>
                      <div class="quest-task-opt-badge" title="Toggle Optional">
                        <input type="checkbox" class="task-input-optional" style="display: none;" />
                        <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                      </div>
                      <div class="quest-task-fail-badge" title="Toggle Failed State">
                        <input type="checkbox" class="task-input-failed" style="display: none;" />
                        <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                      </div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                  <button type="button" class="add-task-row" style="flex: 1;"><i class="fas fa-plus"></i> Add Objective</button>
                  <button type="button" class="add-substory-row" style="flex: 1; background: rgba(25, 113, 194, 0.15); border: 1px solid rgba(25, 113, 194, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px; font-weight: 600;"><i class="fas fa-folder-plus"></i> Add Substory</button>
                </div>
              </div>

            </div>

          </div>

          <!-- TAB 2: Automated Rewards -->
          <div class="dialog-tab-content" data-tab="rewards" style="display: none; flex-direction: column; gap: 12px;">
            <div class="quest-panel" style="padding: 12px;">
              <div class="quest-panel-title" style="margin-bottom: 12px; font-size: 13px;">
                <i class="fas fa-trophy" style="color: #f59f00;"></i> Automated Quest Rewards
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">

                <!-- 1. Multi-Faction XP -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-star" style="color: #f59f00;"></i> Faction XP</span>
                    <button type="button" class="add-faction-xp-row" style="font-size: 11px; padding: 3px 8px; background: rgba(245, 159, 0, 0.15); border: 1px solid rgba(245, 159, 0, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer;"><i class="fas fa-plus"></i> Add Faction XP</button>
                  </div>
                  <div class="faction-xp-container" style="display: flex; flex-direction: column; gap: 6px;">
                    <!-- Faction XP rows injected here -->
                  </div>
                </div>

                <!-- 2. Multi-Faction Reputation -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="affect-rep-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #782e22); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0; user-select: none;">
                      <input type="checkbox" name="affectRep" class="affect-rep-checkbox" style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                      <span><i class="fas fa-shield-alt"></i> Affect Reputation?</span>
                    </label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="rep-target-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.08); color: var(--theme-dim);">Whole Party</span>
                      <button type="button" class="add-rep-row" style="display: none; font-size: 11px; padding: 3px 8px; background: rgba(43, 138, 62, 0.15); border: 1px solid rgba(43, 138, 62, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; align-items: center; gap: 4px;">
                        <i class="fas fa-plus"></i> Add Faction
                      </button>
                    </div>
                  </div>
                  <div class="rep-container" style="display: none; flex-direction: column; gap: 6px; margin-top: 6px;">
                    <!-- Reputation rows injected here -->
                  </div>
                </div>

                <!-- 3. System Currencies -->
                <div class="reward-section-box">
                  <div class="reward-section-subtitle" style="margin-bottom: 6px;"><i class="fas fa-coins" style="color: #d4af37;"></i> Currency</div>
                  <div class="quest-currency-grid">
                    ${currencyInputsHtml}
                  </div>
                </div>

                <!-- 4. Compendium / Directory Item Drag & Drop -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-box-open" style="color: #4facfe;"></i> Items & Equipment</span>
                    <span style="font-size: 10px; color: var(--theme-dim); font-style: italic;">Drop items from Directory/Compendiums</span>
                  </div>
                  <div class="quest-item-dropzone" style="min-height: 56px; border: 1px dashed var(--dialog-section-border, rgba(120, 46, 34, 0.4)); border-radius: 4px; background: rgba(0,0,0,0.03); padding: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-start;">
                    <div class="dropzone-placeholder" style="width: 100%; text-align: center; font-size: 11px; color: var(--theme-dim); padding: 10px 0;">
                      <i class="fas fa-hand-holding"></i> Drag & Drop Items Here
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- TAB 3: GM Controls -->
          <div class="dialog-tab-content" data-tab="gm" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-user-shield"></i> GM Secret Notes</div>
              <div class="form-group">
                <label>GM Notes (Hidden from Players)</label>
                <textarea name="gmNotes" placeholder="Secret clues, encounter triggers, NPC motivations, hidden DCs..." rows="5"></textarea>
              </div>

              <div class="form-toggle-card" style="margin-top: 8px; border-color: rgba(245, 159, 0, 0.4); background: rgba(245, 159, 0, 0.08);">
                <input type="checkbox" name="isPrimary" id="q-is-primary" />
                <label for="q-is-primary" style="font-weight: 700; color: #f59f00;"><i class="fas fa-star"></i> Set as Primary Objective (Pinned at Top of Tracker)</label>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create Quest",
          callback: async (html) => {
            const { form, data: formData } = IntotericaApp.getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            IntotericaApp.syncRichEditors(html);

            // Extract description from rich text editor
            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";

            // Extract tasks
            const taskRows = html.find('.quest-task-entry');
            const tasks = [];
            taskRows.each((i, row) => {
              const $row = $(row);
              const text = $row.find('.task-input-text').val().trim();
              const isSubstory = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
              const optional = $row.find('.task-input-optional').is(':checked');
              const failed = $row.find('.task-input-failed').is(':checked');
              const hidden = $row.find('.task-input-hidden').is(':checked');
              if (text) {
                tasks.push({
                  id: foundry.utils.randomID(),
                  text,
                  completed: false,
                  failed,
                  optional,
                  hidden,
                  isSubstory,
                  isSubquest: isSubstory
                });
              }
            });

            // Extract assigned players
            const assignAll = html.find('.assign-all-checkbox').is(':checked');
            const assignedTo = assignAll ? [] : html.find('.player-assign-cb:checked').map((i, el) => el.value).get();

            // Extract giver
            let giverValue = "";
            const giverSelectVal = html.find('.quest-giver-select').val();
            if (giverSelectVal && giverSelectVal !== '__custom__') {
              giverValue = giverSelectVal;
            } else if (html.find('.quest-giver-custom-input').val()) {
              giverValue = html.find('.quest-giver-custom-input').val().trim();
            }

            // Extract Faction XP
            const factionXp = [];
            let totalFactionXp = 0;
            html.find('.faction-xp-row').each((i, el) => {
              const $r = $(el);
              const fId = $r.find('.faction-xp-select').val();
              const amount = parseInt($r.find('.faction-xp-amount').val()) || 0;
              const fObj = factions.find(f => f.id === fId);
              if (fId && amount > 0) {
                factionXp.push({ factionId: fId, factionName: fObj?.name || "", amount });
                totalFactionXp += amount;
              }
            });

            // Extract Reputation Impact (Multi-Faction)
            const affectRep = html.find('.affect-rep-checkbox').is(':checked');
            const reputations = [];
            if (affectRep) {
              html.find('.rep-row').each((i, el) => {
                const $r = $(el);
                const repFacId = $r.find('.rep-faction-select').val();
                const repDelta = parseInt($r.find('.rep-delta-input').val()) || 0;
                const fObj = factions.find(f => f.id === repFacId);
                if (repFacId && repDelta !== 0) {
                  reputations.push({
                    factionId: repFacId,
                    factionName: fObj?.name || "",
                    amount: repDelta
                  });
                }
              });
            }

            // Extract Currencies
            const currencies = {};
            const currencyParts = [];
            html.find('.currency-val-input').each((i, el) => {
              const denom = $(el).data('denom');
              const val = parseInt($(el).val()) || 0;
              if (denom && val > 0) {
                currencies[denom] = val;
                currencyParts.push(`${val} ${denom.toUpperCase()}`);
              }
            });

            // Extract Items
            const items = [];
            html.find('.reward-item-chip').each((i, el) => {
              const $c = $(el);
              items.push({
                id: $c.data('itemId') || foundry.utils.randomID(),
                uuid: $c.data('uuid') || "",
                name: $c.data('name') || "Item",
                img: $c.data('img') || "icons/svg/item-bag.svg",
                type: $c.data('type') || "loot",
                quantity: parseInt($c.find('.reward-item-qty').val()) || 1,
                itemData: $c.data('itemData') || null
              });
            });

            const titleFromDom = html.find('input[name="title"]').val() ?? form?.querySelector('input[name="title"]')?.value ?? formData.title;
            const cleanTitle = (typeof titleFromDom === 'string' && titleFromDom.trim().length > 0) ? titleFromDom.trim() : "Untitled Quest";

            const questData = {
              title: cleanTitle,
              name: cleanTitle,
              difficulty: formData.difficulty || "Medium",
              status: formData.status || "Active",
              giver: giverValue,
              commissionedFaction: formData.commissionedFaction || "",
              image: formData.image || "",
              description: descriptionHtml,
              tasks,
              rewards: {
                xp: totalFactionXp,
                factionXp,
                reputations,
                reputation: reputations[0] || null,
                currencies,
                currency: currencyParts.join(', '),
                items,
                text: ""
              },
              assignedAll: assignAll,
              assignedTo: assignedTo,
              gmNotes: formData.gmNotes || "",
              isPrimary: formData.isPrimary === true
            };

            await this._createQuest(questData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        // Initialize Rich Text Editor
        IntotericaApp.initRichTextEditor(html);

        // Tab switching
        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        // Click-to-pick Art Banner
        html.find('.quest-art-banner').click(function(ev) {
          ev.preventDefault();
          const $banner = $(this);
          const currentImg = $banner.find('.quest-img-input').val();
          new FilePicker({
            type: "image",
            current: currentImg || undefined,
            callback: (path) => {
              $banner.find('.quest-img-input').val(path);
              $banner.find('.quest-preview-img').attr('src', path).css('opacity', '1');
            }
          }).render(true);
        });

        // Assign All vs Individual Player Checkboxes
        const $assignAll = html.find('.assign-all-checkbox');
        const $playerCbs = html.find('.player-assign-cb');
        const $repTargetBadge = html.find('.rep-target-badge');

        $assignAll.change(function() {
          const isChecked = $(this).is(':checked');
          $playerCbs.prop('checked', isChecked);
          $playerCbs.each(function() {
            const $card = $(this).closest('.player-assign-card');
            $card.toggleClass('assigned', isChecked);
          });
          $repTargetBadge.text(isChecked ? 'Whole Party' : 'Assigned Characters');
        });

        $playerCbs.change(function() {
          const $card = $(this).closest('.player-assign-card');
          const isChecked = $(this).is(':checked');
          $card.toggleClass('assigned', isChecked);

          const total = $playerCbs.length;
          const checkedCount = $playerCbs.filter(':checked').length;
          const allChecked = total > 0 && checkedCount === total;
          $assignAll.prop('checked', allChecked);
          $repTargetBadge.text(allChecked ? 'Whole Party' : 'Assigned Characters');
        });

        // Quest Giver dropdown + custom input toggle
        const $giverSelect = html.find('.quest-giver-select');
        const $giverInput = html.find('.quest-giver-custom-input');

        $giverSelect.change(function() {
          const val = $(this).val();
          if (val === '__custom__') {
            $giverInput.show().val('').focus();
          } else {
            $giverInput.val(val).hide();
          }
        });

        // Task Builder Helpers
        const renderTaskRowHtml = ({ id = foundry.utils.randomID(), text = '', completed = false, failed = false, optional = false, hidden = false, isSubstory = false } = {}) => {
          return `
            <div class="quest-task-entry ${isSubstory ? 'is-substory-header' : ''}" draggable="true">
              <input type="hidden" class="task-input-id" value="${id}" />
              <div class="quest-task-main-row">
                <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                <input type="checkbox" class="task-input-completed" ${completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSubstory ? 'display: none;' : ''}" />
                <i class="fas fa-folder task-substory-static-icon" style="${isSubstory ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
                <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(text)}" placeholder="${isSubstory ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
                <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              <div class="quest-task-badges-row">
                <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSubstory ? '' : 'display: none;'}">
                  <i class="fas fa-plus"></i> Objective
                </button>
                <div class="quest-task-substory-badge ${isSubstory ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
                  <input type="checkbox" class="task-input-substory" ${isSubstory ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-folder"></i> Substory
                </div>
                <div class="quest-task-hide-badge ${hidden ? 'active' : ''}" title="Toggle Hidden from Players">
                  <input type="checkbox" class="task-input-hidden" ${hidden ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-eye-slash"></i> Hidden
                </div>
                <div class="quest-task-opt-badge ${optional ? 'active' : ''}" title="Toggle Optional" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-optional" ${optional ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                </div>
                <div class="quest-task-fail-badge ${failed ? 'active' : ''}" title="Toggle Failed State" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-failed" ${failed ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                </div>
              </div>
            </div>
          `;
        };

        const updateTaskHierarchy = () => {
          let inSubstory = false;
          html.find('.quest-task-entry').each(function() {
            const $row = $(this);
            const isSub = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
            if (isSub) {
              inSubstory = true;
              $row.addClass('is-substory-header').removeClass('is-substory-child');
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').hide();
              $row.find('.task-substory-static-icon, .add-child-task-btn').show();
              $row.find('.task-input-text').attr('placeholder', 'Substory title / folder...');
            } else {
              $row.removeClass('is-substory-header');
              if (inSubstory) {
                $row.addClass('is-substory-child');
              } else {
                $row.removeClass('is-substory-child');
              }
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').show();
              $row.find('.task-substory-static-icon, .add-child-task-btn').hide();
              $row.find('.task-input-text').attr('placeholder', 'Objective description...');
            }
          });
        };

        updateTaskHierarchy();

        // Substory badge toggle
        html.on('click', '.quest-task-substory-badge, .quest-task-subquest-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-substory, .task-input-subquest');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          updateTaskHierarchy();
        });

        // Hide badge toggle
        html.on('click', '.quest-task-hide-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-hidden');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        // Optional badge toggle
        html.on('click', '.quest-task-opt-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-optional');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        // Failed badge toggle
        html.on('click', '.quest-task-fail-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-failed');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        // Add task row
        html.find('.add-task-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Add substory row
        html.find('.add-substory-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: true }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Add child objective under substory
        html.on('click', '.add-child-task-btn', function(ev) {
          ev.preventDefault();
          const $header = $(this).closest('.quest-task-entry');
          let $insertTarget = $header;
          let $next = $header.next('.quest-task-entry');
          while ($next.length && !$next.find('.task-input-substory').is(':checked') && !$next.find('.task-input-subquest').is(':checked')) {
            $insertTarget = $next;
            $next = $next.next('.quest-task-entry');
          }
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          $insertTarget.after(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Delete task row
        html.on('click', '.delete-task-row', function(ev) {
          ev.preventDefault();
          $(this).closest('.quest-task-entry').remove();
          updateTaskHierarchy();
        });

        // Task Drag & Drop Reordering in Dialog Builder
        let draggedTaskEl = null;
        html.find('.quest-tasks-builder').on('dragstart', '.quest-task-entry', function(ev) {
          if ($(ev.target).is('input, button, select, textarea')) {
            ev.preventDefault();
            return;
          }
          draggedTaskEl = this;
          ev.originalEvent.dataTransfer.effectAllowed = 'move';
          ev.originalEvent.dataTransfer.setData('text/plain', 'reorder-task');
          $(this).addClass('dragging');
        });

        html.find('.quest-tasks-builder').on('dragend', '.quest-task-entry', function() {
          draggedTaskEl = null;
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('dragover', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          html.find('.quest-tasks-builder .quest-task-entry').not(this).removeClass('drag-over-top drag-over-bottom');
          if (ev.clientY < midY) {
            $(this).addClass('drag-over-top').removeClass('drag-over-bottom');
          } else {
            $(this).addClass('drag-over-bottom').removeClass('drag-over-top');
          }
        });

        html.find('.quest-tasks-builder').on('dragleave', '.quest-task-entry', function() {
          $(this).removeClass('drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('drop', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (ev.clientY < midY) {
            $(this).before(draggedTaskEl);
          } else {
            $(this).after(draggedTaskEl);
          }
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
          draggedTaskEl = null;
          updateTaskHierarchy();
        });


        // Faction XP Rows Builder
        const $factionXpContainer = html.find('.faction-xp-container');
        const addFactionXpRow = (facId = "", amount = 100) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="faction-xp-row">
              <i class="fas fa-star" style="color: #f59f00; font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="faction-xp-select quest-dialog-select">
                ${factions.map(f => {
                  const hasRanks = Array.isArray(f.ranks) && f.ranks.length > 0;
                  const rankNote = hasRanks ? `(${f.ranks.length} Ranks)` : `(No Ranks - XP Optional)`;
                  return `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)} ${rankNote}</option>`;
                }).join('')}
              </select>
              <div class="faction-xp-amount-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">XP:</span>
                <input type="number" class="faction-xp-amount" value="${amount}" min="0" placeholder="XP" />
              </div>
              <button type="button" class="remove-faction-xp-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $factionXpContainer.append(row);
          row.find('.remove-faction-xp-row').click(() => row.remove());
        };

        html.find('.add-faction-xp-row').click(ev => {
          ev.preventDefault();
          addFactionXpRow("", 100);
        });

        // Multi-Faction Reputation Rows Builder
        const $repContainer = html.find('.rep-container');
        const addRepRow = (facId = "", amount = 10) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="rep-row">
              <i class="fas fa-shield-alt" style="color: var(--theme-accent, #782e22); font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="rep-faction-select quest-dialog-select">
                ${factions.map(f => `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`).join('')}
              </select>
              <div class="rep-standing-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">Standing:</span>
                <input type="number" class="rep-delta-input" value="${amount}" placeholder="+/-" step="1" />
              </div>
              <button type="button" class="remove-rep-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $repContainer.append(row);
          row.find('.remove-rep-row').click(() => row.remove());
        };

        html.find('.add-rep-row').click(ev => {
          ev.preventDefault();
          addRepRow("", 10);
        });

        // Affect Reputation Toggle
        html.find('.affect-rep-checkbox').change(function() {
          const isChecked = $(this).is(':checked');
          $repContainer.css('display', isChecked ? 'flex' : 'none');
          html.find('.add-rep-row').css('display', isChecked ? 'inline-flex' : 'none');
          if (isChecked && $repContainer.find('.rep-row').length === 0) {
            addRepRow("", 10);
          }
        });

        // Item Dropzone Drag & Drop
        const $dropzone = html.find('.quest-item-dropzone');
        const addItemChip = (itemObj) => {
          $dropzone.find('.dropzone-placeholder').hide();
          const chip = $(`
            <div class="reward-item-chip" data-item-id="${itemObj.id}" data-uuid="${itemObj.uuid}" data-name="${Handlebars.escapeExpression(itemObj.name)}" data-img="${itemObj.img}" data-type="${itemObj.type}">
              <img src="${itemObj.img}" class="reward-item-thumb" />
              <span class="reward-item-name" title="${Handlebars.escapeExpression(itemObj.name)}">${Handlebars.escapeExpression(itemObj.name)}</span>
              <input type="number" class="reward-item-qty" value="${itemObj.quantity || 1}" min="1" title="Quantity" />
              <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
            </div>
          `);
          chip.data('itemData', itemObj.itemData);
          $dropzone.append(chip);
          chip.find('.remove-reward-item').click(function() {
            chip.remove();
            if ($dropzone.find('.reward-item-chip').length === 0) {
              $dropzone.find('.dropzone-placeholder').show();
            }
          });
        };

        $dropzone.on('dragover', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', 'var(--theme-accent, #ff6400)');
        });
        $dropzone.on('dragleave', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
        });
        $dropzone.on('drop', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
          
          let data = null;
          try {
            data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
          } catch (e) {
            if (typeof TextEditor.getDragEventData === 'function') {
              data = TextEditor.getDragEventData(ev.originalEvent || ev);
            }
          }
          if (!data || data.type !== 'Item') return;

          let item = null;
          if (data.uuid) {
            try { item = await fromUuid(data.uuid); } catch (e) {}
          }
          if (!item && data.id) {
            item = game.items.get(data.id);
          }
          if (!item && data.data) {
            item = data.data;
          }
          if (!item) return;

          const itemObj = {
            id: item.id || foundry.utils.randomID(),
            uuid: data.uuid || item.uuid || "",
            name: item.name || "Item",
            img: item.img || "icons/svg/item-bag.svg",
            type: item.type || "loot",
            quantity: 1,
            itemData: typeof item.toObject === 'function' ? item.toObject() : null
          };

          addItemChip(itemObj);
        });
      },
      default: "create"
    }, { width: 800 }).render(true);
  }

  async _createQuest(data) {
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can create quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    if (!settings.quests) settings.quests = [];

    const questTitle = data.title || data.name || "Untitled Quest";
    const assignAll = data.assignedAll !== false && (!data.assignedTo || data.assignedTo.length === 0);

    const newQuest = {
      id: foundry.utils.randomID(),
      title: questTitle,
      name: questTitle,
      description: data.description || "",
      difficulty: data.difficulty || "Medium",
      status: data.status || "Active",
      giver: data.giver || "",
      commissionedFaction: data.commissionedFaction || "",
      image: data.image || "",
      tasks: data.tasks || [],
      rewards: data.rewards || { xp: 0, factionXp: [], reputation: null, currencies: {}, currency: "", items: [], text: "" },
      assignedAll: assignAll,
      assignedTo: assignAll ? [] : (Array.isArray(data.assignedTo) ? data.assignedTo : []),
      gmNotes: data.gmNotes || "",
      isPrimary: data.isPrimary === true,
      date: this._getGameDate()
    };
    
    // Auto-assign NPC quest giver as Known NPC
    if (data.giver && typeof data.giver === 'string' && data.giver.trim()) {
      const giverClean = data.giver.trim().toLowerCase();
      const giverActor = game.actors?.find(a => a.id === data.giver || a.name?.trim().toLowerCase() === giverClean);
      if (giverActor && !giverActor.hasPlayerOwner) {
        if (!settings.knownNPCs) settings.knownNPCs = [];
        if (!settings.knownNPCs.includes(giverActor.id)) {
          settings.knownNPCs.push(giverActor.id);
        }
      }
    }

    settings.quests.push(newQuest);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    this._sendQuestChatNotification(newQuest, 'new');
    ui.notifications.info(`Quest "${questTitle}" created`);
  }

  async _onEditQuest(event) {
    event.preventDefault();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can edit quests.");
      return;
    }

    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    const questTitle = quest.title || quest.name || "";
    const playerActors = IntotericaApp.getPlayerActors();
    const tasks = Array.isArray(quest.tasks) ? quest.tasks : [];
    const rewards = quest.rewards || {};
    const factions = settings.factions || [];
    const systemCurrencies = IntotericaApp.getSystemCurrencies();
    
    const isAssignAll = quest.assignedAll !== false && (!quest.assignedTo || quest.assignedTo.length === 0);
    const assignedTo = Array.isArray(quest.assignedTo) ? quest.assignedTo : [];

    const tasksHtml = tasks.map((t) => {
      const isSub = Boolean(t.isSubstory || t.isSubquest);
      return `
        <div class="quest-task-entry ${isSub ? 'is-substory-header' : ''}" draggable="true">
          <input type="hidden" class="task-input-id" value="${t.id || foundry.utils.randomID()}" />
          <div class="quest-task-main-row">
            <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
            <input type="checkbox" class="task-input-completed" ${t.completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSub ? 'display: none;' : ''}" />
            <i class="fas fa-folder task-substory-static-icon" style="${isSub ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
            <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(t.text || '')}" placeholder="${isSub ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
            <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
          <div class="quest-task-badges-row">
            <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSub ? '' : 'display: none;'}">
              <i class="fas fa-plus"></i> Objective
            </button>
            <div class="quest-task-substory-badge ${isSub ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
              <input type="checkbox" class="task-input-substory" ${isSub ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-folder"></i> Substory
            </div>
            <div class="quest-task-hide-badge ${t.hidden ? 'active' : ''}" title="Toggle Hidden from Players">
              <input type="checkbox" class="task-input-hidden" ${t.hidden ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-eye-slash"></i> Hidden
            </div>
            <div class="quest-task-opt-badge ${t.optional ? 'active' : ''}" title="Toggle Optional" style="${isSub ? 'display: none;' : ''}">
              <input type="checkbox" class="task-input-optional" ${t.optional ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
            </div>
            <div class="quest-task-fail-badge ${t.failed ? 'active' : ''}" title="Toggle Failed State" style="${isSub ? 'display: none;' : ''}">
              <input type="checkbox" class="task-input-failed" ${t.failed ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
            </div>
          </div>
        </div>
      `;
    }).join('');

    const savedCurrencies = rewards.currencies || {};
    const currencyInputsHtml = Object.entries(systemCurrencies).map(([key, label]) => {
      const currentVal = savedCurrencies[key] || '';
      return `
        <div class="quest-currency-card" title="${Handlebars.escapeExpression(label)}">
          <div class="currency-card-header">
            <i class="fas fa-coins" style="color: #d4af37; font-size: 10px;"></i>
            <span class="currency-tag">${Handlebars.escapeExpression((label || key).toUpperCase())}</span>
          </div>
          <input type="number" class="currency-val-input" data-denom="${Handlebars.escapeExpression(key)}" value="${currentVal}" placeholder="0" min="0" />
        </div>
      `;
    }).join('');

    const existingReps = Array.isArray(rewards.reputations) && rewards.reputations.length > 0
      ? rewards.reputations
      : (rewards.reputation && Number(rewards.reputation.amount || rewards.reputation.delta) !== 0 ? [rewards.reputation] : []);
    const hasRep = existingReps.length > 0;

    const items = Array.isArray(rewards.items) ? rewards.items : [];
    const itemsHtml = items.map(it => `
      <div class="reward-item-chip" data-item-id="${it.id || foundry.utils.randomID()}" data-uuid="${it.uuid || ''}" data-name="${Handlebars.escapeExpression(it.name)}" data-img="${it.img || 'icons/svg/item-bag.svg'}" data-type="${it.type || 'loot'}">
        <img src="${it.img || 'icons/svg/item-bag.svg'}" class="reward-item-thumb" />
        <span class="reward-item-name" title="${Handlebars.escapeExpression(it.name)}">${Handlebars.escapeExpression(it.name)}</span>
        <input type="number" class="reward-item-qty" value="${it.quantity || 1}" min="1" title="Quantity" />
        <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
      </div>
    `).join('');

    const descEditorHtml = IntotericaApp.createRichTextEditorHtml('description', quest.description || '', 'Provide quest narrative, background lore, clues, and objectives...');

    IntotericaApp.createDialog({
      title: `Edit Quest: ${questTitle || 'Untitled Quest'}`,
      content: `
        <form class="intoterica-form" style="max-height: 640px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="details">
              <i class="fas fa-scroll"></i> Quest Details
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="rewards">
              <i class="fas fa-trophy"></i> Rewards
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="gm">
              <i class="fas fa-user-shield"></i> GM Secret Notes & Pin
            </button>
          </div>

          <!-- TAB 1: Quest Details -->
          <div class="dialog-tab-content active" data-tab="details" style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Top Integrated Header: Art Banner + Title & Metadata -->
            <div style="display: flex; gap: 14px; align-items: stretch; background: var(--dialog-card-bg, rgba(255, 255, 255, 0.5)); border: 1px solid var(--dialog-section-border, rgba(120, 46, 34, 0.25)); border-radius: 6px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
              
              <!-- Left: Clickable Portrait Banner -->
              <div class="quest-art-banner" title="Click to choose splash image">
                <img class="quest-preview-img" src="${quest.image || 'icons/svg/item-bag.svg'}" style="${quest.image ? '' : 'opacity: 0.35;'}" />
                <div class="quest-art-overlay"><i class="fas fa-camera"></i> Change Art</div>
                <input type="hidden" name="image" value="${quest.image || ''}" class="quest-img-input" />
              </div>

              <!-- Right: Title + Metadata Strip -->
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; gap: 6px;">
                <div>
                  <input type="text" name="title" value="${Handlebars.escapeExpression(questTitle)}" placeholder="Quest Title (e.g. The Sunken Crypt)..." class="quest-title-large" autofocus required />
                </div>
                
                <div class="quest-meta-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-signal"></i> Difficulty</label>
                    <select name="difficulty" class="quest-dialog-select">
                      ${IntotericaApp.getDifficultyOptions(quest.difficulty)}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-hourglass-half"></i> Status</label>
                    <select name="status" class="quest-dialog-select">
                      <option value="Active" ${quest.status === 'Active' ? 'selected' : ''}>Active</option>
                      <option value="Available" ${quest.status === 'Available' ? 'selected' : ''}>Available</option>
                      <option value="Completed" ${quest.status === 'Completed' ? 'selected' : ''}>Completed</option>
                      <option value="Failed" ${quest.status === 'Failed' ? 'selected' : ''}>Failed</option>
                      <option value="Hidden" ${quest.status === 'Hidden' ? 'selected' : ''}>Hidden</option>
                    </select>
                  </div>
                </div>

                <!-- Commissioned By & Giver Section -->
                <div class="quest-commission-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-shield-alt"></i> Commissioned by (Faction)</label>
                    <select name="commissionedFaction" class="quest-dialog-select">
                      <option value="">— Independent / None —</option>
                      ${factions.map(f => `<option value="${f.name}" ${quest.commissionedFaction === f.name ? 'selected' : ''}>${f.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-user-circle"></i> Quest Giver / Issuer</label>
                    <select class="quest-giver-select quest-dialog-select" title="Choose from World Folders, NPCs, Factions...">
                      ${IntotericaApp.getQuestGiverOptions(quest.giver)}
                    </select>
                    <input type="text" name="giver" value="${quest.giver || ''}" class="quest-giver-custom-input" style="display: none; margin-top: 4px;" placeholder="Type custom giver name..." />
                  </div>
                </div>

              </div>

            </div>

            <!-- Player Assignment Section -->
            <div class="quest-assignment-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--dialog-section-title, #782e22); display: flex; align-items: center; gap: 5px;">
                  <i class="fas fa-users"></i> Assigned Players / Characters
                </div>
                <label class="assign-all-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #ff6400); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin: 0; user-select: none;">
                  <input type="checkbox" name="assignAll" class="assign-all-checkbox" ${isAssignAll ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                  <span>Assign to All Players (Whole Party)</span>
                </label>
              </div>
              ${playerActors.length ? `
                <div class="quest-player-assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px;">
                  ${playerActors.map(p => {
                    const isAssigned = isAssignAll || assignedTo.includes(p.id);
                    const avatar = p.img || p.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
                    return `
                      <label class="player-assign-card ${isAssigned ? 'assigned' : ''}" data-actor-id="${p.id}">
                        <input type="checkbox" name="assign_${p.id}" class="player-assign-cb" value="${p.id}" ${isAssigned ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                        <img src="${avatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;" />
                        <span style="font-size: 11px; font-weight: 600; color: var(--dialog-input-text, #191813); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${p.name}">${p.name}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `<p style="font-size: 11px; font-style: italic; color: var(--theme-dim); margin: 0;">No player characters detected on the app.</p>`}
            </div>

            <!-- Bottom 2-Column Ledger: Description (Left) + Objectives & Tasks (Right) -->
            <div class="quest-editor-body" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 12px; align-items: stretch;">
              
              <!-- Left Column: Quest Description with Journal-Style Rich Text Editor -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title">
                  <span><i class="fas fa-feather-alt"></i> Quest Description</span>
                </div>
                ${descEditorHtml}
              </div>

              <!-- Right Column: Objectives & Tasks Builder -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title"><i class="fas fa-tasks"></i> Objectives & Tasks</div>
                <div class="quest-tasks-builder" style="flex: 1; max-height: 280px; overflow-y: auto; padding-right: 2px;">
                  ${tasksHtml}
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                  <button type="button" class="add-task-row" style="flex: 1;"><i class="fas fa-plus"></i> Add Objective</button>
                  <button type="button" class="add-substory-row" style="flex: 1; background: rgba(25, 113, 194, 0.15); border: 1px solid rgba(25, 113, 194, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px; font-weight: 600;"><i class="fas fa-folder-plus"></i> Add Substory</button>
                </div>
              </div>

            </div>

          </div>

          <!-- TAB 2: Automated Rewards -->
          <div class="dialog-tab-content" data-tab="rewards" style="display: none; flex-direction: column; gap: 12px;">
            <div class="quest-panel" style="padding: 12px;">
              <div class="quest-panel-title" style="margin-bottom: 12px; font-size: 13px;">
                <i class="fas fa-trophy" style="color: #f59f00;"></i> Automated Quest Rewards
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">

                <!-- 1. Multi-Faction XP -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-star" style="color: #f59f00;"></i> Faction XP</span>
                    <button type="button" class="add-faction-xp-row" style="font-size: 11px; padding: 3px 8px; background: rgba(245, 159, 0, 0.15); border: 1px solid rgba(245, 159, 0, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer;"><i class="fas fa-plus"></i> Add Faction XP</button>
                  </div>
                  <div class="faction-xp-container" style="display: flex; flex-direction: column; gap: 6px;">
                    <!-- Faction XP rows injected here -->
                  </div>
                </div>

                <!-- 2. Multi-Faction Reputation -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="affect-rep-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #782e22); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0; user-select: none;">
                      <input type="checkbox" name="affectRep" class="affect-rep-checkbox" ${hasRep ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                      <span><i class="fas fa-shield-alt"></i> Affect Reputation?</span>
                    </label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="rep-target-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.08); color: var(--theme-dim);">
                        ${isAssignAll ? 'Whole Party' : 'Assigned Characters'}
                      </span>
                      <button type="button" class="add-rep-row" style="${hasRep ? 'display: inline-flex;' : 'display: none;'} font-size: 11px; padding: 3px 8px; background: rgba(43, 138, 62, 0.15); border: 1px solid rgba(43, 138, 62, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; align-items: center; gap: 4px;">
                        <i class="fas fa-plus"></i> Add Faction
                      </button>
                    </div>
                  </div>
                  <div class="rep-container" style="${hasRep ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 6px; margin-top: 6px;">
                    <!-- Reputation rows injected here -->
                  </div>
                </div>

                <!-- 3. System Currencies -->
                <div class="reward-section-box">
                  <div class="reward-section-subtitle" style="margin-bottom: 6px;"><i class="fas fa-coins" style="color: #d4af37;"></i> Currency</div>
                  <div class="quest-currency-grid">
                    ${currencyInputsHtml}
                  </div>
                </div>

                <!-- 4. Compendium / Directory Item Drag & Drop -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-box-open" style="color: #4facfe;"></i> Items & Equipment</span>
                    <span style="font-size: 10px; color: var(--theme-dim); font-style: italic;">Drop items from Directory/Compendiums</span>
                  </div>
                  <div class="quest-item-dropzone" style="min-height: 56px; border: 1px dashed var(--dialog-section-border, rgba(120, 46, 34, 0.4)); border-radius: 4px; background: rgba(0,0,0,0.03); padding: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-start;">
                    <div class="dropzone-placeholder" style="${items.length ? 'display: none;' : ''} width: 100%; text-align: center; font-size: 11px; color: var(--theme-dim); padding: 10px 0;">
                      <i class="fas fa-hand-holding"></i> Drag & Drop Items Here
                    </div>
                    ${itemsHtml}
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- TAB 3: GM Controls -->
          <div class="dialog-tab-content" data-tab="gm" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-user-shield"></i> GM Secret Notes</div>
              <div class="form-group">
                <label>GM Notes (Hidden from Players)</label>
                <textarea name="gmNotes" placeholder="Secret clues, encounter triggers, NPC motivations, hidden DCs..." rows="5">${quest.gmNotes || ''}</textarea>
              </div>

              <div class="form-toggle-card" style="margin-top: 8px; border-color: rgba(245, 159, 0, 0.4); background: rgba(245, 159, 0, 0.08);">
                <input type="checkbox" name="isPrimary" id="q-is-primary-edit" ${quest.isPrimary ? 'checked' : ''} />
                <label for="q-is-primary-edit" style="font-weight: 700; color: #f59f00;"><i class="fas fa-star"></i> Set as Primary Objective (Pinned at Top of Tracker)</label>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Changes",
          callback: async (html) => {
            const { form, data: formData } = IntotericaApp.getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            IntotericaApp.syncRichEditors(html);

            // Extract description from rich text editor
            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";

            // Extract tasks
            const taskRows = html.find('.quest-task-entry');
            const updatedTasks = [];
            taskRows.each((i, row) => {
              const $row = $(row);
              const text = $row.find('.task-input-text').val().trim();
              const completed = $row.find('.task-input-completed').is(':checked');
              const failed = $row.find('.task-input-failed').is(':checked');
              const optional = $row.find('.task-input-optional').is(':checked');
              const isSubstory = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
              const hidden = $row.find('.task-input-hidden').is(':checked');
              const id = $row.find('.task-input-id').val() || foundry.utils.randomID();
              if (text) {
                updatedTasks.push({
                  id,
                  text,
                  completed: failed ? false : completed,
                  failed,
                  optional,
                  hidden,
                  isSubstory,
                  isSubquest: isSubstory
                });
              }
            });

            // Extract assigned players
            const assignAll = html.find('.assign-all-checkbox').is(':checked');
            const updatedAssignedTo = assignAll ? [] : html.find('.player-assign-cb:checked').map((i, el) => el.value).get();

            // Extract giver
            let giverValue = "";
            const giverSelectVal = html.find('.quest-giver-select').val();
            if (giverSelectVal && giverSelectVal !== '__custom__') {
              giverValue = giverSelectVal;
            } else if (html.find('.quest-giver-custom-input').val()) {
              giverValue = html.find('.quest-giver-custom-input').val().trim();
            }

            // Extract Faction XP
            const factionXp = [];
            let totalFactionXp = 0;
            html.find('.faction-xp-row').each((i, el) => {
              const $r = $(el);
              const fId = $r.find('.faction-xp-select').val();
              const amount = parseInt($r.find('.faction-xp-amount').val()) || 0;
              const fObj = factions.find(f => f.id === fId);
              if (fId && amount > 0) {
                factionXp.push({ factionId: fId, factionName: fObj?.name || "", amount });
                totalFactionXp += amount;
              }
            });

            // Extract Reputation Impact (Multi-Faction)
            const affectRep = html.find('.affect-rep-checkbox').is(':checked');
            const reputations = [];
            if (affectRep) {
              html.find('.rep-row').each((i, el) => {
                const $r = $(el);
                const repFacId = $r.find('.rep-faction-select').val();
                const repDelta = parseInt($r.find('.rep-delta-input').val()) || 0;
                const fObj = factions.find(f => f.id === repFacId);
                if (repFacId && repDelta !== 0) {
                  reputations.push({
                    factionId: repFacId,
                    factionName: fObj?.name || "",
                    amount: repDelta
                  });
                }
              });
            }

            // Extract Currencies
            const currencies = {};
            const currencyParts = [];
            html.find('.currency-val-input').each((i, el) => {
              const denom = $(el).data('denom');
              const val = parseInt($(el).val()) || 0;
              if (denom && val > 0) {
                currencies[denom] = val;
                currencyParts.push(`${val} ${denom.toUpperCase()}`);
              }
            });

            // Extract Items
            const updatedItems = [];
            html.find('.reward-item-chip').each((i, el) => {
              const $c = $(el);
              updatedItems.push({
                id: $c.data('itemId') || foundry.utils.randomID(),
                uuid: $c.data('uuid') || "",
                name: $c.data('name') || "Item",
                img: $c.data('img') || "icons/svg/item-bag.svg",
                type: $c.data('type') || "loot",
                quantity: parseInt($c.find('.reward-item-qty').val()) || 1,
                itemData: $c.data('itemData') || null
              });
            });

            const titleFromDom = html.find('input[name="title"]').val() ?? form?.querySelector('input[name="title"]')?.value ?? formData.title;
            const cleanTitle = (typeof titleFromDom === 'string' && titleFromDom.trim().length > 0) ? titleFromDom.trim() : (quest.title || quest.name || "Untitled Quest");
            const updatedData = {
              title: cleanTitle,
              name: cleanTitle,
              difficulty: formData.difficulty || "Medium",
              status: formData.status || "Active",
              giver: giverValue,
              commissionedFaction: formData.commissionedFaction || "",
              image: formData.image || "",
              description: descriptionHtml,
              tasks: updatedTasks,
              rewards: {
                xp: totalFactionXp,
                factionXp,
                reputations,
                reputation: reputations[0] || null,
                currencies,
                currency: currencyParts.join(', '),
                items: updatedItems,
                text: ""
              },
              assignedAll: assignAll,
              assignedTo: updatedAssignedTo,
              gmNotes: formData.gmNotes || "",
              isPrimary: formData.isPrimary === true
            };

            await this._updateQuest(questId, updatedData);
          }
        },
        delete: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Delete",
          callback: async () => {
            await this._deleteQuest(questId);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        // Initialize Rich Text Editor
        IntotericaApp.initRichTextEditor(html);

        // Tab switching
        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        // Click-to-pick Art Banner
        html.find('.quest-art-banner').click(function(ev) {
          ev.preventDefault();
          const $banner = $(this);
          const currentImg = $banner.find('.quest-img-input').val();
          new FilePicker({
            type: "image",
            current: currentImg || undefined,
            callback: (path) => {
              $banner.find('.quest-img-input').val(path);
              $banner.find('.quest-preview-img').attr('src', path).css('opacity', '1');
            }
          }).render(true);
        });

        // Assign All vs Individual Player Checkboxes
        const $assignAll = html.find('.assign-all-checkbox');
        const $playerCbs = html.find('.player-assign-cb');
        const $repTargetBadge = html.find('.rep-target-badge');

        $assignAll.change(function() {
          const isChecked = $(this).is(':checked');
          $playerCbs.prop('checked', isChecked);
          $playerCbs.each(function() {
            const $card = $(this).closest('.player-assign-card');
            $card.toggleClass('assigned', isChecked);
          });
          $repTargetBadge.text(isChecked ? 'Whole Party' : 'Assigned Characters');
        });

        $playerCbs.change(function() {
          const $card = $(this).closest('.player-assign-card');
          const isChecked = $(this).is(':checked');
          $card.toggleClass('assigned', isChecked);

          const total = $playerCbs.length;
          const checkedCount = $playerCbs.filter(':checked').length;
          const allChecked = total > 0 && checkedCount === total;
          $assignAll.prop('checked', allChecked);
          $repTargetBadge.text(allChecked ? 'Whole Party' : 'Assigned Characters');
        });

        // Quest Giver dropdown + custom input toggle
        const $giverSelect = html.find('.quest-giver-select');
        const $giverInput = html.find('.quest-giver-custom-input');

        $giverSelect.change(function() {
          const val = $(this).val();
          if (val === '__custom__') {
            $giverInput.show().val('').focus();
          } else {
            $giverInput.val(val).hide();
          }
        });

        // Task Builder Helpers
        const renderTaskRowHtml = ({ id = foundry.utils.randomID(), text = '', completed = false, failed = false, optional = false, hidden = false, isSubstory = false } = {}) => {
          return `
            <div class="quest-task-entry ${isSubstory ? 'is-substory-header' : ''}" draggable="true">
              <input type="hidden" class="task-input-id" value="${id}" />
              <div class="quest-task-main-row">
                <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                <input type="checkbox" class="task-input-completed" ${completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSubstory ? 'display: none;' : ''}" />
                <i class="fas fa-folder task-substory-static-icon" style="${isSubstory ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
                <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(text)}" placeholder="${isSubstory ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
                <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              <div class="quest-task-badges-row">
                <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSubstory ? '' : 'display: none;'}">
                  <i class="fas fa-plus"></i> Objective
                </button>
                <div class="quest-task-substory-badge ${isSubstory ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
                  <input type="checkbox" class="task-input-substory" ${isSubstory ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-folder"></i> Substory
                </div>
                <div class="quest-task-hide-badge ${hidden ? 'active' : ''}" title="Toggle Hidden from Players">
                  <input type="checkbox" class="task-input-hidden" ${hidden ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-eye-slash"></i> Hidden
                </div>
                <div class="quest-task-opt-badge ${optional ? 'active' : ''}" title="Toggle Optional" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-optional" ${optional ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                </div>
                <div class="quest-task-fail-badge ${failed ? 'active' : ''}" title="Toggle Failed State" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-failed" ${failed ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                </div>
              </div>
            </div>
          `;
        };

        const updateTaskHierarchy = () => {
          let inSubstory = false;
          html.find('.quest-task-entry').each(function() {
            const $row = $(this);
            const isSub = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
            if (isSub) {
              inSubstory = true;
              $row.addClass('is-substory-header').removeClass('is-substory-child');
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').hide();
              $row.find('.task-substory-static-icon, .add-child-task-btn').show();
              $row.find('.task-input-text').attr('placeholder', 'Substory title / folder...');
            } else {
              $row.removeClass('is-substory-header');
              if (inSubstory) {
                $row.addClass('is-substory-child');
              } else {
                $row.removeClass('is-substory-child');
              }
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').show();
              $row.find('.task-substory-static-icon, .add-child-task-btn').hide();
              $row.find('.task-input-text').attr('placeholder', 'Objective description...');
            }
          });
        };

        updateTaskHierarchy();

        // Substory badge toggle
        html.on('click', '.quest-task-substory-badge, .quest-task-subquest-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-substory, .task-input-subquest');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          updateTaskHierarchy();
        });

        // Hide badge toggle
        html.on('click', '.quest-task-hide-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-hidden');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        // Optional badge toggle
        html.on('click', '.quest-task-opt-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-optional');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        // Failed badge toggle
        html.on('click', '.quest-task-fail-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-failed');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          if (checked) {
            $badge.closest('.quest-task-entry').find('.task-input-completed').prop('checked', false);
          }
        });

        // Add task row
        html.find('.add-task-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Add substory row
        html.find('.add-substory-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: true }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Add child objective under substory
        html.on('click', '.add-child-task-btn', function(ev) {
          ev.preventDefault();
          const $header = $(this).closest('.quest-task-entry');
          let $insertTarget = $header;
          let $next = $header.next('.quest-task-entry');
          while ($next.length && !$next.find('.task-input-substory').is(':checked') && !$next.find('.task-input-subquest').is(':checked')) {
            $insertTarget = $next;
            $next = $next.next('.quest-task-entry');
          }
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          $insertTarget.after(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        // Delete task row
        html.on('click', '.delete-task-row', function(ev) {
          ev.preventDefault();
          $(this).closest('.quest-task-entry').remove();
          updateTaskHierarchy();
        });

        // Task Drag & Drop Reordering in Dialog Builder
        let draggedTaskEl = null;
        html.find('.quest-tasks-builder').on('dragstart', '.quest-task-entry', function(ev) {
          if ($(ev.target).is('input, button, select, textarea')) {
            ev.preventDefault();
            return;
          }
          draggedTaskEl = this;
          ev.originalEvent.dataTransfer.effectAllowed = 'move';
          ev.originalEvent.dataTransfer.setData('text/plain', 'reorder-task');
          $(this).addClass('dragging');
        });

        html.find('.quest-tasks-builder').on('dragend', '.quest-task-entry', function() {
          draggedTaskEl = null;
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('dragover', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          html.find('.quest-tasks-builder .quest-task-entry').not(this).removeClass('drag-over-top drag-over-bottom');
          if (ev.clientY < midY) {
            $(this).addClass('drag-over-top').removeClass('drag-over-bottom');
          } else {
            $(this).addClass('drag-over-bottom').removeClass('drag-over-top');
          }
        });

        html.find('.quest-tasks-builder').on('dragleave', '.quest-task-entry', function() {
          $(this).removeClass('drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('drop', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (ev.clientY < midY) {
            $(this).before(draggedTaskEl);
          } else {
            $(this).after(draggedTaskEl);
          }
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
          draggedTaskEl = null;
          updateTaskHierarchy();
        });

        // Faction XP Rows Builder & Injection
        const $factionXpContainer = html.find('.faction-xp-container');
        const addFactionXpRow = (facId = "", amount = 100) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="faction-xp-row">
              <i class="fas fa-star" style="color: #f59f00; font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="faction-xp-select quest-dialog-select">
                ${factions.map(f => {
                  const hasRanks = Array.isArray(f.ranks) && f.ranks.length > 0;
                  const rankNote = hasRanks ? `(${f.ranks.length} Ranks)` : `(No Ranks - XP Optional)`;
                  return `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)} ${rankNote}</option>`;
                }).join('')}
              </select>
              <div class="faction-xp-amount-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">XP:</span>
                <input type="number" class="faction-xp-amount" value="${amount}" min="0" placeholder="XP" />
              </div>
              <button type="button" class="remove-faction-xp-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $factionXpContainer.append(row);
          row.find('.remove-faction-xp-row').click(() => row.remove());
        };

        // Populate existing Faction XP
        const existingFactionXp = Array.isArray(rewards.factionXp) ? rewards.factionXp : [];
        if (existingFactionXp.length > 0) {
          existingFactionXp.forEach(fx => addFactionXpRow(fx.factionId, fx.amount));
        } else if (Number(rewards.xp) > 0 && factions.length > 0) {
          addFactionXpRow(factions[0].id, Number(rewards.xp));
        }

        html.find('.add-faction-xp-row').click(ev => {
          ev.preventDefault();
          addFactionXpRow("", 100);
        });

        // Multi-Faction Reputation Rows Builder & Injection
        const $repContainer = html.find('.rep-container');
        const addRepRow = (facId = "", amount = 10) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="rep-row">
              <i class="fas fa-shield-alt" style="color: var(--theme-accent, #782e22); font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="rep-faction-select quest-dialog-select">
                ${factions.map(f => `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`).join('')}
              </select>
              <div class="rep-standing-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">Standing:</span>
                <input type="number" class="rep-delta-input" value="${amount}" placeholder="+/-" step="1" />
              </div>
              <button type="button" class="remove-rep-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $repContainer.append(row);
          row.find('.remove-rep-row').click(() => row.remove());
        };

        // Populate existing Reputation
        if (existingReps.length > 0) {
          existingReps.forEach(r => addRepRow(r.factionId, r.amount !== undefined ? r.amount : r.delta));
        }

        html.find('.add-rep-row').click(ev => {
          ev.preventDefault();
          addRepRow("", 10);
        });

        // Affect Reputation Toggle
        html.find('.affect-rep-checkbox').change(function() {
          const isChecked = $(this).is(':checked');
          $repContainer.css('display', isChecked ? 'flex' : 'none');
          html.find('.add-rep-row').css('display', isChecked ? 'inline-flex' : 'none');
          if (isChecked && $repContainer.find('.rep-row').length === 0) {
            addRepRow("", 10);
          }
        });

        // Item Dropzone Drag & Drop
        const $dropzone = html.find('.quest-item-dropzone');
        $dropzone.find('.remove-reward-item').click(function() {
          $(this).closest('.reward-item-chip').remove();
          if ($dropzone.find('.reward-item-chip').length === 0) {
            $dropzone.find('.dropzone-placeholder').show();
          }
        });

        const addItemChip = (itemObj) => {
          $dropzone.find('.dropzone-placeholder').hide();
          const chip = $(`
            <div class="reward-item-chip" data-item-id="${itemObj.id}" data-uuid="${itemObj.uuid}" data-name="${Handlebars.escapeExpression(itemObj.name)}" data-img="${itemObj.img}" data-type="${itemObj.type}">
              <img src="${itemObj.img}" class="reward-item-thumb" />
              <span class="reward-item-name" title="${Handlebars.escapeExpression(itemObj.name)}">${Handlebars.escapeExpression(itemObj.name)}</span>
              <input type="number" class="reward-item-qty" value="${itemObj.quantity || 1}" min="1" title="Quantity" />
              <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
            </div>
          `);
          chip.data('itemData', itemObj.itemData);
          $dropzone.append(chip);
          chip.find('.remove-reward-item').click(function() {
            chip.remove();
            if ($dropzone.find('.reward-item-chip').length === 0) {
              $dropzone.find('.dropzone-placeholder').show();
            }
          });
        };

        $dropzone.on('dragover', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', 'var(--theme-accent, #ff6400)');
        });
        $dropzone.on('dragleave', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
        });
        $dropzone.on('drop', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
          
          let data = null;
          try {
            data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
          } catch (e) {
            if (typeof TextEditor.getDragEventData === 'function') {
              data = TextEditor.getDragEventData(ev.originalEvent || ev);
            }
          }
          if (!data || data.type !== 'Item') return;

          let item = null;
          if (data.uuid) {
            try { item = await fromUuid(data.uuid); } catch (e) {}
          }
          if (!item && data.id) {
            item = game.items.get(data.id);
          }
          if (!item && data.data) {
            item = data.data;
          }
          if (!item) return;

          const itemObj = {
            id: item.id || foundry.utils.randomID(),
            uuid: data.uuid || item.uuid || "",
            name: item.name || "Item",
            img: item.img || "icons/svg/item-bag.svg",
            type: item.type || "loot",
            quantity: 1,
            itemData: typeof item.toObject === 'function' ? item.toObject() : null
          };

          addItemChip(itemObj);
        });
      },
      default: "save"
    }, { width: 800 }).render(true);
  }

  async _updateQuest(questId, data) {
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can edit quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) {
      console.warn(`Intoterica | Could not find quest to update with id: ${questId}`);
      return;
    }

    if (!quest.id) quest.id = questId;

    Object.assign(quest, data);

    if (quest.status === 'Completed') {
      if (!quest.completedBy || quest.completedBy.length === 0) {
        const compIds = (quest.assignedTo && quest.assignedTo.length > 0) ? quest.assignedTo : (quest.assignedAll !== false ? IntotericaApp.getPlayerActors().map(a => a.id) : []);
        quest.completedBy = compIds;
        quest.assignedTo = compIds;
        quest.assignedAll = false;
      }
    } else if (quest.status === 'Failed') {
      if (!quest.failedBy || quest.failedBy.length === 0) {
        const failIds = (quest.assignedTo && quest.assignedTo.length > 0) ? quest.assignedTo : (quest.assignedAll !== false ? IntotericaApp.getPlayerActors().map(a => a.id) : []);
        quest.failedBy = failIds;
        quest.assignedTo = failIds;
        quest.assignedAll = false;
      }
    }

    // Auto-assign NPC quest giver as Known NPC
    if (data.giver && typeof data.giver === 'string' && data.giver.trim()) {
      const giverClean = data.giver.trim().toLowerCase();
      const giverActor = game.actors?.find(a => a.id === data.giver || a.name?.trim().toLowerCase() === giverClean);
      if (giverActor && !giverActor.hasPlayerOwner) {
        if (!settings.knownNPCs) settings.knownNPCs = [];
        if (!settings.knownNPCs.includes(giverActor.id)) {
          settings.knownNPCs.push(giverActor.id);
        }
      }
    }

    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${data.title}" updated.`);
  }

  async _deleteQuest(questId) {
    if (!game.user.isGM && !IntotericaApp.hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can delete quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    settings.quests = (settings.quests || []).filter(q => q.id !== questId);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info("Quest deleted.");
  }

  async _onAdjustReputation(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const delta = parseInt(event.currentTarget.dataset.delta);
    const settings = game.settings.get('intoterica', 'data');
    
    const faction = settings.factions.find(f => f.id === factionId);
    if (faction) {
      // Migration: If currently manual, migrate rep to partyReputation first
      if (faction.autoCalc === false) {
          faction.partyReputation = faction.reputation;
          faction.autoCalc = true;
      }

      const oldRep = this._calculateFactionRep(faction);
      const oldStatus = this._getRepStatus(oldRep);
      
      faction.partyReputation = (faction.partyReputation || 0) + delta;
      
      await this._saveData(settings);
      this._broadcastUpdate();
      this.selectedFaction = faction;
      this.render();
      
      const newRep = this._calculateFactionRep(faction);
      const newStatus = this._getRepStatus(newRep);

      if (game.settings.get('intoterica', 'notifyFactions') && oldStatus.label !== newStatus.label) {
        ChatMessage.create({
          content: `
            <div class="intoterica-chat-card">
              <h3>Faction Update: ${faction.name}</h3>
              <div class="card-content">
                <div style="font-size: 48px; margin: 10px 0;">${newStatus.face}</div>
                <div style="font-size: 16px; font-weight: bold; color: ${newStatus.color};">${newStatus.label}</div>
                <div style="margin-top: 5px;">Party Reputation: <strong>${newRep}</strong></div>
              </div>
            </div>`
        });
      }
    }
  }

  async _onAddFaction(event) {
    event.preventDefault();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permFactions')) {
      ui.notifications.warn("Only Game Masters can create factions.");
      return;
    }
    
    const descEditorHtml = IntotericaApp.createRichTextEditorHtml('description', '', 'Faction history, goals, allies, and enemies...');

    IntotericaApp.createDialog({
      title: "Create Faction",
      content: `
        <form class="intoterica-form" style="max-height: 580px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="profile">
              <i class="fas fa-shield-alt"></i> Faction Profile
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="ranks">
              <i class="fas fa-layer-group"></i> Ranks Configuration
            </button>
          </div>

          <!-- TAB 1: Profile -->
          <div class="dialog-tab-content active" data-tab="profile" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-id-card"></i> Faction Identity</div>
              <div class="form-grid-name-icon" style="display: grid; grid-template-columns: 1fr 140px; gap: 10px; align-items: flex-start;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-weight: bold; font-size: 11px; margin-bottom: 4px; display: block;">Faction Name *</label>
                  <input type="text" name="name" placeholder="e.g. Iron Vanguard" autofocus required style="height: 32px;" />
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-weight: bold; font-size: 11px; margin-bottom: 4px; display: block;">Icon / Emblem</label>
                  <div class="file-picker-group" style="display: flex; gap: 4px;">
                    <input type="text" name="image" value="⚔️" style="height: 32px;" />
                    <button type="button" class="file-picker" title="Browse File" style="padding: 0 8px;"><i class="fas fa-file-import"></i></button>
                  </div>
                </div>
              </div>

              <div class="form-toggle-card" style="margin-top: 10px;">
                <input type="checkbox" name="allowEnlistment" id="fac-enlist-new" />
                <label for="fac-enlist-new" style="font-size: 11px; font-weight: 600;"><i class="fas fa-signature"></i> Allow Player Enlistment (Players can request membership)</label>
              </div>
            </div>

            <!-- Faction Description / Lore -->
            <div class="form-section" style="display: flex; flex-direction: column; min-width: 0;">
              <div class="form-section-title"><i class="fas fa-book-open"></i> Faction Description & Lore</div>
              ${descEditorHtml}
            </div>
          </div>

          <!-- TAB 2: Ranks Configuration -->
          <div class="dialog-tab-content" data-tab="ranks" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-layer-group"></i> Rank Ladder & Modifiers</span>
                <span style="font-size: 10px; color: var(--theme-dim); font-weight: normal;">Ordered lowest to highest</span>
              </div>
              <div class="ranks-header" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; color: var(--theme-dim); padding: 0 4px;">
                <div>Rank Title</div>
                <div style="text-align: center;">XP Req.</div>
                <div style="text-align: center;">Rep Mod.</div>
                <div></div>
              </div>
              <div class="ranks-container faction-ranks-scroll" style="max-height: 360px; overflow-y: auto; padding-right: 2px; display: flex; flex-direction: column; gap: 6px;">
                <div class="rank-row" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; align-items: center; background: var(--dialog-input-bg, #fff); border: 1px solid var(--dialog-section-border, rgba(120,46,34,0.2)); border-radius: 4px; padding: 4px 6px;">
                  <input type="text" class="rank-name" value="Initiate" placeholder="Rank name" style="height: 28px;" />
                  <input type="number" class="rank-xp" value="0" placeholder="0" style="text-align: center; height: 28px;" />
                  <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="1.0" style="text-align: center; height: 28px;" />
                  <button type="button" class="delete-rank" title="Remove Rank" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 13px;"><i class="fas fa-times"></i></button>
                </div>
              </div>
              <button type="button" class="add-rank" style="margin-top: 8px;"><i class="fas fa-plus"></i> Add Rank Tier</button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create Faction",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            IntotericaApp.syncRichEditors(html);

            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";
            
            const rows = html.find('.rank-row');
            const ranks = [];
            rows.each((i, row) => {
                const $row = $(row);
                const name = $row.find('.rank-name').val();
                const xp = parseInt($row.find('.rank-xp').val()) || 0;
                const modifier = parseFloat($row.find('.rank-mod').val()) || 1.0;
                if (name) ranks.push({ name, xp, modifier });
            });
            formData.ranks = ranks;
            formData.description = descriptionHtml;

            await this._createFaction(formData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        IntotericaApp.initRichTextEditor(html);

        // Tab switching
        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                current: input.val() || undefined,
                callback: (path) => input.val(path)
            }).render(true);
        });
        
        html.find('.add-rank').click(ev => {
            const row = $(`
              <div class="rank-row" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; align-items: center; background: var(--dialog-input-bg, #fff); border: 1px solid var(--dialog-section-border, rgba(120,46,34,0.2)); border-radius: 4px; padding: 4px 6px;">
                <input type="text" class="rank-name" placeholder="Rank name" style="height: 28px;" />
                <input type="number" class="rank-xp" value="0" placeholder="0" style="text-align: center; height: 28px;" />
                <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="1.0" style="text-align: center; height: 28px;" />
                <button type="button" class="delete-rank" title="Remove Rank" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 13px;"><i class="fas fa-times"></i></button>
              </div>
            `);
            html.find('.ranks-container').append(row);
            row.find('.delete-rank').click(e => $(e.currentTarget).closest('.rank-row').remove());
        });

        html.find('.delete-rank').click(ev => {
            $(ev.currentTarget).closest('.rank-row').remove();
        });
      },
      default: "create"
    }, { width: 580 }).render(true);
  }

  async _createFaction(data) {
    const settings = game.settings.get('intoterica', 'data');
    
    let ranks = [];
    if (Array.isArray(data.ranks)) {
      ranks = data.ranks;
    } else if (typeof data.ranks === 'string') {
      ranks = data.ranks.split('\n').filter(line => line.trim()).map(line => {
        const [name, xp, modifier] = line.split(',').map(s => s.trim());
        return { name, xp: parseInt(xp) || 0, modifier: parseFloat(modifier) || 1.0 };
      });
    }

    const newFaction = {
      id: foundry.utils.randomID(),
      name: data.name,
      description: data.description || "",
      image: data.image || "⚔️",
      reputation: 0,
      autoCalc: false,
      partyReputation: 0,
      allowEnlistment: data.allowEnlistment || false,
      ranks: ranks,
      members: []
    };
    
    settings.factions.push(newFaction);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Faction "${data.name}" created`);
  }

  async _onEditFaction(event) {
    event.preventDefault();
    if (!game.user.isGM && !IntotericaApp.hasPermission('permFactions')) {
      ui.notifications.warn("Only Game Masters can edit factions.");
      return;
    }
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (!faction) return;

    const ranksHtml = (faction.ranks || []).map(r => `
      <div class="rank-row" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; align-items: center; background: var(--dialog-input-bg, #fff); border: 1px solid var(--dialog-section-border, rgba(120,46,34,0.2)); border-radius: 4px; padding: 4px 6px;">
        <input type="text" class="rank-name" value="${Handlebars.escapeExpression(r.name || '')}" placeholder="Rank name" style="height: 28px;" />
        <input type="number" class="rank-xp" value="${r.xp || 0}" placeholder="0" style="text-align: center; height: 28px;" />
        <input type="number" class="rank-mod" value="${r.modifier !== undefined ? r.modifier : 1.0}" step="0.1" placeholder="1.0" style="text-align: center; height: 28px;" />
        <button type="button" class="delete-rank" title="Remove Rank" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 13px;"><i class="fas fa-times"></i></button>
      </div>
    `).join('');

    const descEditorHtml = IntotericaApp.createRichTextEditorHtml('description', faction.description || '', 'Faction history, goals, allies, and enemies...');

    IntotericaApp.createDialog({
      title: `Edit Faction: ${faction.name}`,
      content: `
        <form class="intoterica-form" style="max-height: 580px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="profile">
              <i class="fas fa-shield-alt"></i> Faction Profile
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="ranks">
              <i class="fas fa-layer-group"></i> Ranks Configuration
            </button>
          </div>

          <!-- TAB 1: Profile -->
          <div class="dialog-tab-content active" data-tab="profile" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-id-card"></i> Faction Identity</div>
              <div class="form-grid-name-icon" style="display: grid; grid-template-columns: 1fr 140px; gap: 10px; align-items: flex-start;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-weight: bold; font-size: 11px; margin-bottom: 4px; display: block;">Faction Name *</label>
                  <input type="text" name="name" value="${Handlebars.escapeExpression(faction.name || '')}" autofocus required style="height: 32px;" />
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-weight: bold; font-size: 11px; margin-bottom: 4px; display: block;">Icon / Emblem</label>
                  <div class="file-picker-group" style="display: flex; gap: 4px;">
                    <input type="text" name="image" value="${faction.image || '⚔️'}" style="height: 32px;" />
                    <button type="button" class="file-picker" title="Browse File" style="padding: 0 8px;"><i class="fas fa-file-import"></i></button>
                  </div>
                </div>
              </div>

              <div class="form-toggle-card" style="margin-top: 10px;">
                <input type="checkbox" name="allowEnlistment" id="fac-enlist-edit" ${faction.allowEnlistment ? 'checked' : ''} />
                <label for="fac-enlist-edit" style="font-size: 11px; font-weight: 600;"><i class="fas fa-signature"></i> Allow Player Enlistment (Players can request membership)</label>
              </div>
            </div>

            <!-- Faction Description / Lore -->
            <div class="form-section" style="display: flex; flex-direction: column; min-width: 0;">
              <div class="form-section-title"><i class="fas fa-book-open"></i> Faction Description & Lore</div>
              ${descEditorHtml}
            </div>
          </div>

          <!-- TAB 2: Ranks Configuration -->
          <div class="dialog-tab-content" data-tab="ranks" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-layer-group"></i> Rank Ladder & Modifiers</span>
                <span style="font-size: 10px; color: var(--theme-dim); font-weight: normal;">Ordered lowest to highest</span>
              </div>
              <div class="ranks-header" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; color: var(--theme-dim); padding: 0 4px;">
                <div>Rank Title</div>
                <div style="text-align: center;">XP Req.</div>
                <div style="text-align: center;">Rep Mod.</div>
                <div></div>
              </div>
              <div class="ranks-container faction-ranks-scroll" style="max-height: 360px; overflow-y: auto; padding-right: 2px; display: flex; flex-direction: column; gap: 6px;">
                ${ranksHtml}
              </div>
              <button type="button" class="add-rank" style="margin-top: 8px;"><i class="fas fa-plus"></i> Add Rank Tier</button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Changes",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            IntotericaApp.syncRichEditors(html);

            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";
            
            const rows = html.find('.rank-row');
            const ranks = [];
            rows.each((i, row) => {
                const $row = $(row);
                const name = $row.find('.rank-name').val();
                const xp = parseInt($row.find('.rank-xp').val()) || 0;
                const modifier = parseFloat($row.find('.rank-mod').val()) || 1.0;
                if (name) ranks.push({ name, xp, modifier });
            });
            formData.ranks = ranks;
            formData.description = descriptionHtml;

            await this._updateFaction(factionId, formData);
          }
        },
        delete: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Delete",
            callback: async () => {
                await this._deleteFaction(factionId);
            }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        IntotericaApp.initRichTextEditor(html);

        // Tab switching
        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                current: input.val() || undefined,
                callback: (path) => input.val(path)
            }).render(true);
        });

        html.find('.add-rank').click(ev => {
            const row = $(`
              <div class="rank-row" style="display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 6px; align-items: center; background: var(--dialog-input-bg, #fff); border: 1px solid var(--dialog-section-border, rgba(120,46,34,0.2)); border-radius: 4px; padding: 4px 6px;">
                <input type="text" class="rank-name" placeholder="Rank name" style="height: 28px;" />
                <input type="number" class="rank-xp" value="0" placeholder="0" style="text-align: center; height: 28px;" />
                <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="1.0" style="text-align: center; height: 28px;" />
                <button type="button" class="delete-rank" title="Remove Rank" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 13px;"><i class="fas fa-times"></i></button>
              </div>
            `);
            html.find('.ranks-container').append(row);
            row.find('.delete-rank').click(e => $(e.currentTarget).closest('.rank-row').remove());
        });

        html.find('.delete-rank').click(ev => {
            $(ev.currentTarget).closest('.rank-row').remove();
        });
      },
      default: "save"
    }, { width: 580 }).render(true);
  }

  async _updateFaction(factionId, data) {
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (!faction) return;

    let ranks = [];
    if (Array.isArray(data.ranks)) {
        ranks = data.ranks;
    } else if (typeof data.ranks === 'string') { // Legacy support
        ranks = data.ranks.split('\n').filter(line => line.trim()).map(line => {
            const [name, xp, modifier] = line.split(',').map(s => s.trim());
            return { name, xp: parseInt(xp) || 0, modifier: parseFloat(modifier) || 1.0 };
        });
    }

    faction.name = data.name;
    faction.description = data.description;
    faction.image = data.image;
    faction.allowEnlistment = data.allowEnlistment;
    faction.ranks = ranks;

    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
  }

  async _deleteFaction(factionId) {
      const settings = game.settings.get('intoterica', 'data');
      settings.factions = settings.factions.filter(f => f.id !== factionId);
      await this._saveData(settings);
      this.selectedFaction = null;
      this._broadcastUpdate();
      this.render();
  }

  async _onAddMember(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const actors = game.actors.map(a => ({id: a.id, name: a.name})).sort((a, b) => a.name.localeCompare(b.name));
    
    IntotericaApp.createDialog({
      title: "Add Faction Member",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-user-plus"></i> Member Details</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Select Character</label>
                <select name="actorId">
                  ${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Initial Rank (0 = lowest)</label>
                <input type="number" name="rank" value="0" min="0" />
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-user-plus"></i>',
          label: "Add Member",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            await this._addFactionMember(factionId, formData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "add"
    }, { width: 440 }).render(true);
  }

  async _addFactionMember(factionId, data) {
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const actor = game.actors.get(data.actorId);
    
    if (faction && actor) {
      faction.members.push({
        id: actor.id,
        name: actor.name,
        type: actor.hasPlayerOwner ? "Player" : "NPC",
        rank: parseInt(data.rank),
        xp: 0,
        reputation: 0
      });
      
      await this._saveData(settings);
      this._broadcastUpdate();
      this.selectedFaction = faction;
      this.render();
      ui.notifications.info(`${actor.name} added to ${faction.name}`);
    }
  }

  async _onRemoveMember(event) {
      event.preventDefault();
      const factionId = event.currentTarget.dataset.factionId;
      const memberId = event.currentTarget.dataset.memberId;
      
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === factionId);
      
      if (faction) {
          faction.members = faction.members.filter(m => m.id !== memberId);
          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();
      }
  }

  _onDragMemberStart(event) {
      const memberId = event.currentTarget.dataset.memberId;
      const factionId = event.currentTarget.dataset.factionId;
      if (memberId && factionId) {
          const dragData = {
              type: 'FactionMember',
              factionId: factionId,
              memberId: memberId
          };
          event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }
  }

  async _onDropFactionMember(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!this.selectedFaction) return;
      
      let data;
      try {
          data = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch (e) { return; }

      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
      if (!faction) return;

      let targetRank = 0;
      if (event.currentTarget.dataset.rankIndex !== undefined) {
          targetRank = parseInt(event.currentTarget.dataset.rankIndex);
      }

      if (data.type === 'FactionMember') {
          if (data.factionId !== faction.id) return;
          const member = faction.members.find(m => m.id === data.memberId);
          if (member && member.rank !== targetRank) {
              member.rank = targetRank;
              await this._saveData(settings);
              this._broadcastUpdate();
              this.render();
          }
          return;
      }
      
      if (data.type !== 'Actor' && !data.uuid) return;
      
      let actorId = data.uuid ? data.uuid.split('.').pop() : data.id;
      const actor = game.actors.get(actorId);

      if (actor) {
          if (faction.members.some(m => m.id === actor.id)) return;
          
          faction.members.push({
              id: actor.id,
              name: actor.name,
              type: actor.hasPlayerOwner ? "Player" : "NPC",
              rank: targetRank,
              xp: 0,
              reputation: 0
          });
          
          await this._saveData(settings);
          this._broadcastUpdate();
          this.selectedFaction = faction;
          this.render();
      }
  }

  async _onUpdateMemberRank(event) {
      event.preventDefault();
      const memberId = event.currentTarget.dataset.memberId;
      const rankIdx = parseInt(event.currentTarget.value);
      
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
      const member = faction?.members.find(m => m.id === memberId);
      
      const enableFactionXP = game.settings.get('intoterica', 'enableFactionXP');
      if (member && member.type === 'Player' && enableFactionXP) return;

      if (member) {
          member.rank = rankIdx;
          await this._saveData(settings);
          this._broadcastUpdate();
      }
  }

  async _onUpdateRank(event) {
      event.preventDefault();
      const idx = parseInt(event.currentTarget.dataset.idx);
      const field = event.currentTarget.dataset.field;
      let value = event.currentTarget.value;
      
      if (field === 'xp') value = parseInt(value) || 0;
      if (field === 'modifier') value = parseFloat(value) || 1.0;

      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
      
      if (faction && faction.ranks[idx]) {
          faction.ranks[idx][field] = value;
          await this._saveData(settings);
          this._broadcastUpdate();
      }
  }

  async _onAddRank(event) {
      event.preventDefault();
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
      
      if (faction) {
          faction.ranks.push({ name: "New Rank", xp: 0, modifier: 1.0, description: "" });
          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();
      }
  }

  async _onDeleteRank(event) {
      event.preventDefault();
      const idx = parseInt(event.currentTarget.dataset.idx);
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
      
      if (faction) {
          faction.ranks.splice(idx, 1);
          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();
      }
  }

  async _onEnlistFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const actor = game.user.character;
    
    if (!IntotericaApp.hasPermission('permFactions')) {
        game.socket.emit('module.intoterica', {
            type: 'dispatch',
            action: 'enlistFaction',
            payload: { factionId, actorId: actor?.id }
        });
        return;
    }

    if (faction && actor) {
        if (faction.members.some(m => m.id === actor.id)) return;
        faction.members.push({
            id: actor.id,
            name: actor.name,
            type: "Player",
            rank: 0,
            xp: 0,
            reputation: 0
        });
        await this._saveData(settings);
        this._broadcastUpdate();
        this.render();
        ui.notifications.info(`Enlisted in ${faction.name}!`);
    }
  }

  async _performEnlistFaction(factionId, actorId) {
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const actor = game.actors.get(actorId);

    if (faction && actor) {
        if (faction.members.some(m => m.id === actor.id)) return;
        faction.members.push({
            id: actor.id,
            name: actor.name,
            type: "Player",
            rank: 0,
            xp: 0,
            reputation: 0
        });
        await this._saveData(settings);
        this._broadcastUpdate();
    }
  }

  async _onReplyMail(originalMessage) {
    // Determine recipients (Reply All logic: Sender + Original To + Original CC - Self)
    const originalTo = Array.isArray(originalMessage.to) ? originalMessage.to : [originalMessage.to];
    const originalCc = Array.isArray(originalMessage.cc) ? originalMessage.cc : [originalMessage.cc];
    
    // Determine From ID (Reply as the actor who received it if owned)
    const myActors = game.actors.filter(a => a.isOwner);
    const myActorIds = myActors.map(a => a.id);
    let myRecipientId = [...originalTo, ...originalCc].find(id => myActorIds.includes(id));
    if (!myRecipientId) {
        const foundActor = myActors.find(a => [...originalTo, ...originalCc].some(t => typeof t === 'string' && t.trim().toLowerCase() === a.name?.trim().toLowerCase()));
        if (foundActor) myRecipientId = foundActor.id;
    }
    const replyFromId = myRecipientId || game.user.character?.id || (myActors[0]?.id) || game.user.id;

    let recipients = new Set([...originalTo, ...originalCc]);
    let replyToId = originalMessage.fromId;
    if (!game.actors.get(replyToId) && originalMessage.from && typeof originalMessage.from === 'string') {
        const matchingSender = game.actors.find(a => a.name?.trim().toLowerCase() === originalMessage.from.trim().toLowerCase());
        if (matchingSender) replyToId = matchingSender.id;
    }
    if (replyToId) recipients.add(replyToId);
    if (replyFromId) recipients.delete(replyFromId);

    const subject = originalMessage.subject || "(No Subject)";
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    const replyData = {
        fromId: replyFromId,
        to: Array.from(recipients),
        subject: replySubject,
        body: ""
    };
    
    this.mailComposeData = replyData;
    this.mailViewSubject = null;
    this.render();
  }

  async _onComposeMail(event) {
    event.preventDefault();
    this.mailComposeData = {};
    this.mailViewSubject = null;
    this.render();
  }

  _onReplyAction(event) {
      event.preventDefault();
      const settings = game.settings.get('intoterica', 'data');
      if (this.mailViewSubject !== null) {
          const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
          const threadMessages = settings.inbox.filter(m => {
              const mSubject = m.subject || "(No Subject)";
              return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
          }).sort((a, b) => new Date(b.date) - new Date(a.date));
          
          if (threadMessages.length > 0) {
              this._onReplyMail(threadMessages[0]);
          }
      }
  }

  async _onSendMailAction(event) {
    event.preventDefault();
    const form = $(this.element).find('.email-compose-form')[0];
    if (!form) return;
    const fd = new FormData(form);
    const formData = Object.fromEntries(fd.entries());
    
    // Parse to/cc from string to array
    formData.to = formData.to ? formData.to.split(',').filter(Boolean) : [];
    formData.cc = formData.cc ? formData.cc.split(',').filter(Boolean) : [];

    await this._sendMail(formData);
    this.mailComposeData = null;
    this.render();
  }

  _onCancelCompose(event) {
      event.preventDefault();
      this.mailComposeData = null;
      this.render();
  }

  _openAddressBook(selectedIds, players, npcs, callback) {
      const content = `
        <form class="intoterica-form" style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
          <!-- Players Section -->
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-users"></i> Player Characters</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${players.map(p => `
                <div class="form-toggle-card">
                  <input type="checkbox" name="${p.id}" id="ab-${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''} />
                  <label for="ab-${p.id}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</label>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- NPCs Section -->
          <div class="form-section" style="margin-top: 10px;">
            <div class="form-section-title"><i class="fas fa-address-book"></i> Known NPCs</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${npcs.length ? npcs.map(n => `
                <div class="form-toggle-card">
                  <input type="checkbox" name="${n.id}" id="ab-${n.id}" ${selectedIds.includes(n.id) ? 'checked' : ''} />
                  <label for="ab-${n.id}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.name}</label>
                </div>
              `).join('') : '<div style="color: var(--theme-dim); font-style: italic; font-size: 12px; padding: 4px;">No NPCs in address book.</div>'}
            </div>
          </div>
        </form>
      `;

      IntotericaApp.createDialog({
          title: "Address Book",
          content: content,
          buttons: {
              confirm: {
                  icon: '<i class="fas fa-check"></i>',
                  label: "Apply Selection",
                  callback: (html) => {
                      const newSelected = [];
                      html.find('input[type="checkbox"]:checked').each((i, el) => {
                          newSelected.push(el.name);
                      });
                      callback(newSelected);
                  }
              },
              cancel: {
                  icon: '<i class="fas fa-times"></i>',
                  label: "Cancel"
              }
          },
          default: "confirm"
      }, { width: 520 }).render(true);
  }

  async _sendMail(data) {
    const settings = game.settings.get('intoterica', 'data') || {};
    let fromId = data.fromId;
    let senderName = data.from;
    let senderImage = data.image || "icons/svg/mystery-man.svg";

    if (fromId && fromId.startsWith('faction:')) {
        const fId = fromId.split(':')[1];
        const f = (settings.factions || []).find(fac => fac.id === fId || fac.name === fId);
        if (f) {
            senderName = f.name;
            senderImage = f.icon || f.banner || "icons/svg/shield.svg";
        }
    } else if (fromId && fromId.startsWith('user:')) {
        const uId = fromId.split(':')[1];
        const u = game.users?.get(uId);
        if (u) {
            senderName = u.name;
            senderImage = u.avatar || "icons/svg/mystery-man.svg";
        }
    } else {
        let sender = fromId ? game.actors?.get(fromId) : null;
        if (!sender && data.from && typeof data.from === 'string') {
            sender = game.actors?.find(a => a.name?.trim().toLowerCase() === data.from.trim().toLowerCase());
        }
        if (!sender && game.user.character) {
            sender = game.user.character;
        }
        if (sender) {
            fromId = sender.id;
            senderName = sender.name;
            senderImage = sender.prototypeToken?.texture?.src || sender.img || "icons/svg/mystery-man.svg";
        }
    }

    if (!fromId) {
        fromId = game.user.character?.id || `user:${game.user.id}`;
    }
    if (!senderName) {
        senderName = game.user.character?.name || game.user.name || "Unknown";
    }

    const newMessage = {
      id: foundry.utils.randomID(),
      from: senderName,
      fromId: fromId,
      to: data.to,
      cc: data.cc || [],
      image: senderImage,
      subject: data.subject,
      body: data.body,
      date: data.date || this._getGameDate(),
      readBy: [],
      status: "unread"
    };
    
    if (!IntotericaApp.hasPermission('permMail')) {
        if (!game.users.some(u => u.isGM && u.active)) {
            // Queue message for later delivery
            const pending = game.user.getFlag('intoterica', 'pendingOutbox') || [];
            pending.push(newMessage);
            await game.user.setFlag('intoterica', 'pendingOutbox', pending);
            ui.notifications.info("Message queued. It will be delivered when a GM logs in.");
            this.render();
            return;
        }

        game.socket.emit('module.intoterica', {
            type: 'dispatch',
            action: 'sendMail',
            payload: { ...data, fromId }
        });
        ui.notifications.info(`Mail sent!`);
        return;
    }

    settings.inbox.unshift(newMessage);

    await this._saveData(settings);
    this._broadcastUpdate({ action: 'newMessage' });

    // Play sound locally since socket doesn't loop back
    if (game.settings.get('intoterica', 'enableSounds')) {
        const soundPath = IntotericaApp.getSoundPath('mail');
        let volume = game.settings.get('intoterica', 'volumeNotification');
        
        // Apply Theme Scale
        const themeKey = game.settings.get('intoterica', 'theme');
        const themeConfig = IntotericaApp.THEMES[themeKey];
        if (themeConfig && themeConfig.volumeScale) {
            volume = Math.min(1.0, volume * themeConfig.volumeScale);
        }
        
        if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: volume, autoplay: true, loop: false}, false);
    }
    this.render();
    
    // Determine if sender is a player character
    const isPlayerSender = sender && sender.hasPlayerOwner;

    // GM Notification for player messages
    if (isPlayerSender) {
        const senderName = sender.name;
        const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);
        if (gmUsers.length > 0) {
            ChatMessage.create({
                content: `
                    <div class="intoterica-chat-card">
                        <div class="card-content" style="padding: 5px; font-size: 12px;">
                            <strong>${senderName}</strong> has sent a message.
                        </div>
                    </div>
                `,
                whisper: gmUsers
            });
        }
    }

    // Notifications
    const recipients = Array.isArray(data.to) ? data.to : [data.to];
    const recipientUsers = game.users.filter(u => {
        if (!u.character) return false;
        if (recipients.includes(u.character.id)) return true;
        const charName = u.character.name?.trim().toLowerCase();
        return recipients.some(r => typeof r === 'string' && r.trim().toLowerCase() === charName);
    });
    
    if (game.settings.get('intoterica', 'notifyMail')) {
    
    recipientUsers.forEach(u => {
        ChatMessage.create({
            content: `
                <div class="intoterica-chat-card">
                  <h3>You've got mail!</h3>
                  <div class="card-content">
                    <div style="font-size: 48px; margin: 10px 0;">✉️</div>
                    <div style="margin-bottom: 5px;"><strong>${u.character.name}</strong></div>
                    <div style="font-size: 12px;">From: ${newMessage.from}</div>
                    <div style="font-style: italic; margin-top: 5px; opacity: 0.8;">${newMessage.subject}</div>
                    <button class="intoterica-open-inbox" data-message-id="${newMessage.id}" style="margin-top: 10px; width: 100%;">Access Inbox</button>
                  </div>
                </div>
            `,
            whisper: [u.id],
            sound: null // Sound handled by socket/AudioHelper with volume control
        });
    });
    }

    ui.notifications.info(`Mail sent!`);
  }

  async _onEditClock(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const clock = settings.worldClock || { era: 1, day: 1 };

    IntotericaApp.createDialog({
      title: "Edit World Clock",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-hourglass-half"></i> World Date</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Current Era</label>
                <input type="number" name="era" value="${clock.era}" min="1" />
              </div>
              <div class="form-group">
                <label>Current Day</label>
                <input type="number" name="day" value="${clock.day}" min="1" />
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Date",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            settings.worldClock = {
              era: parseInt(formData.era),
              day: parseInt(formData.day)
            };
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { width: 380 }).render(true);
  }

  async _onRemoveProfileQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    const btn = $(event.currentTarget);
    const questEl = btn.closest('[data-quest-id]');
    const questId = btn.data('questId') || questEl.data('questId');
    const isManual = String(btn.data('isManual') || questEl.data('isManual')) === "true";
    
    const settings = game.settings.get('intoterica', 'data');
    if (!settings.profileHistory) settings.profileHistory = {};
    if (!settings.profileHistory[this.profileActorId]) settings.profileHistory[this.profileActorId] = { hidden: [], added: [] };
    
    const history = settings.profileHistory[this.profileActorId];
    
    if (isManual) {
        history.added = history.added.filter(q => q.id !== questId);
    } else {
        if (!history.hidden.includes(questId)) history.hidden.push(questId);
    }
    
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
  }

  async _onAddLegacyQuest(event) {
    event.preventDefault();
    IntotericaApp.createDialog({
      title: "Add Legacy Quest Entry",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-history"></i> Legacy Quest Details</div>
            <div class="form-group">
              <label>Quest Title *</label>
              <input type="text" name="title" placeholder="e.g. Slaying of the Red Dragon" autofocus required />
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Completion Status</label>
                <select name="status">
                  <option value="Completed">Completed</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              <div class="form-group">
                <label>Image / Emblem</label>
                <div class="file-picker-group">
                  <input type="text" name="image" placeholder="icons/..." />
                  <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
                </div>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add to History",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            
            const settings = game.settings.get('intoterica', 'data');
            if (!settings.profileHistory) settings.profileHistory = {};
            if (!settings.profileHistory[this.profileActorId]) settings.profileHistory[this.profileActorId] = { hidden: [], added: [] };
            
            const newQuest = { id: foundry.utils.randomID(), title: formData.title, status: formData.status, image: formData.image, isManual: true };
            settings.profileHistory[this.profileActorId].added.push(newQuest);
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => { html.find('.file-picker').click(ev => new FilePicker({ type: "image", callback: (path) => html.find('input[name="image"]').val(path) }).render(true)); },
      default: "add"
    }, { width: 480 }).render(true);
  }

  async _onToggleAutoRep(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const isAuto = event.currentTarget.checked;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    
    if (faction) {
      faction.autoCalc = isAuto;
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
    }
  }

  async _onFactionRepSliderChange(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const value = parseInt(event.currentTarget.value);
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (faction) {
      const oldRep = faction.reputation;
      const oldStatus = this._getRepStatus(oldRep);
      faction.reputation = value;
      const delta = value - oldRep;

      if (delta !== 0) {
        await this._saveData(settings);
        this._broadcastUpdate();
        if (this.selectedFaction && this.selectedFaction.id === factionId) this.selectedFaction.reputation = value;
        setTimeout(() => this.render(), 50);
        
        const newStatus = this._getRepStatus(faction.reputation);

        if (game.settings.get('intoterica', 'notifyFactions') && oldStatus.label !== newStatus.label) {
            ChatMessage.create({
              content: `
                <div class="intoterica-chat-card">
                  <h3>Faction Update: ${faction.name}</h3>
                  <div class="card-content">
                    <div style="font-size: 48px; margin: 10px 0;">${newStatus.face}</div>
                    <div style="font-size: 16px; font-weight: bold; color: ${newStatus.color};">${newStatus.label}</div>
                    <div style="margin-top: 5px;">Party Reputation: <strong>${faction.reputation}</strong></div>
                  </div>
                </div>`
            });
        }
      }
    }
  }

  async _onPartyRepChange(event) {
      event.preventDefault();
      const factionId = event.currentTarget.dataset.factionId;
      const value = parseInt(event.currentTarget.value);
      
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === factionId);
      
      if (faction) {
          if (faction.autoCalc === false) {
              faction.partyReputation = faction.reputation;
              faction.autoCalc = true;
          }

          const oldFactionRep = this._calculateFactionRep(faction);
          const oldFactionStatus = this._getRepStatus(oldFactionRep);

          faction.partyReputation = value;
          
          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();

          const newFactionRep = this._calculateFactionRep(faction);
          const newFactionStatus = this._getRepStatus(newFactionRep);

          if (game.settings.get('intoterica', 'notifyFactions') && oldFactionStatus.label !== newFactionStatus.label) {
                ChatMessage.create({
                  content: `
                    <div class="intoterica-chat-card">
                      <h3>Faction Update: ${faction.name}</h3>
                      <div class="card-content">
                        <div style="font-size: 48px; margin: 10px 0;">${newFactionStatus.face}</div>
                        <div style="font-size: 16px; font-weight: bold; color: ${newFactionStatus.color};">${newFactionStatus.label}</div>
                        <div style="margin-top: 5px;">Party Reputation: <strong>${newFactionRep}</strong></div>
                      </div>
                    </div>`
                });
          }
      }
  }

  async _onMemberRepChange(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const memberId = event.currentTarget.dataset.memberId;
    const value = parseInt(event.currentTarget.value);
    
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const member = faction?.members.find(m => m.id === memberId);
    
    if (member) {
      const oldRep = member.reputation || 0;
      const oldStatus = this._getRepStatus(oldRep);
      
      // Capture old faction rep if autoCalc is on
      const oldFactionRep = this._calculateFactionRep(faction);
      const oldFactionStatus = this._getRepStatus(oldFactionRep);

      member.reputation = value;
      const delta = value - oldRep;

      if (delta !== 0) {
        if (faction.autoCalc === false) {
            faction.partyReputation = faction.reputation;
            faction.autoCalc = true;
        }

        await this._saveData(settings);
        this._broadcastUpdate();
        setTimeout(() => this.render(), 50);

        // Member Notification
        const newStatus = this._getRepStatus(member.reputation);
        if (game.settings.get('intoterica', 'notifyFactions') && oldStatus.label !== newStatus.label) {
            ChatMessage.create({
              content: `
                <div class="intoterica-chat-card">
                  <h3>Faction Member Update: ${faction.name}</h3>
                  <div class="card-content">
                    <div style="font-size: 48px; margin: 10px 0;">${newStatus.face}</div>
                    <div style="font-size: 16px; font-weight: bold; color: ${newStatus.color};">${newStatus.label}</div>
                    <div style="margin-top: 5px;"><strong>${member.name}</strong> Reputation: <strong>${member.reputation}</strong></div>
                  </div>
                </div>`
            });
        }

        // Faction Notification
        const newFactionRep = this._calculateFactionRep(faction);
        const newFactionStatus = this._getRepStatus(newFactionRep);
        
        if (game.settings.get('intoterica', 'notifyFactions') && oldFactionStatus.label !== newFactionStatus.label) {
            ChatMessage.create({
              content: `
                <div class="intoterica-chat-card">
                  <h3>Faction Update: ${faction.name}</h3>
                  <div class="card-content">
                    <div style="font-size: 48px; margin: 10px 0;">${newFactionStatus.face}</div>
                    <div style="font-size: 16px; font-weight: bold; color: ${newFactionStatus.color};">${newFactionStatus.label}</div>
                    <div style="margin-top: 5px;">Party Reputation: <strong>${newFactionRep}</strong></div>
                  </div>
                </div>`
            });
        }
      }
    }
  }

  async _onAwardXP(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const factions = settings.factions || [];
    if (factions.length === 0) {
      ui.notifications.warn("No factions available to award XP.");
      return;
    }

    const allPlayerActors = game.actors.filter(a => a.hasPlayerOwner);
    const fallbackPlayers = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
    const players = allPlayerActors.length > 0 ? allPlayerActors : fallbackPlayers;

    const initialFactionId = this.selectedFaction?.id || factions[0]?.id || "";

    const renderPlayerList = (facId) => {
      const targetFac = factions.find(f => f.id === facId) || factions[0];
      const memberIds = new Set((targetFac?.members || []).filter(m => m.type === 'Player' || !m.type).map(m => m.id));
      
      if (players.length === 0) {
        return `<div style="grid-column: span 2; font-size: 11px; color: var(--theme-dim); padding: 8px; text-align: center;">No player characters found.</div>`;
      }

      return players.map(p => {
        const isMember = memberIds.has(p.id);
        const memberData = isMember ? (targetFac.members || []).find(m => m.id === p.id) : null;
        const rankName = (isMember && targetFac.ranks && targetFac.ranks[memberData?.rank]?.name) || `Rank ${memberData?.rank || 0}`;
        return `
          <div class="form-toggle-card xp-target-card ${isMember ? 'is-member' : 'is-non-member'}" style="opacity: ${isMember ? '1' : '0.45'}; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--theme-border); background: var(--theme-surface);">
            <label style="display: flex; align-items: center; gap: 8px; margin: 0; cursor: ${isMember ? 'pointer' : 'not-allowed'}; width: 100%;">
              <input type="checkbox" name="player_${p.id}" id="xp-p-${p.id}" ${isMember ? 'checked' : 'disabled'} style="margin: 0;" />
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; font-size: 12px;">${Handlebars.escapeExpression(p.name)}</span>
                ${isMember 
                  ? `<span style="font-size: 10px; color: #40c057;"><i class="fas fa-check-circle"></i> Member (${rankName} • ${memberData?.xp || 0} XP)</span>`
                  : `<span style="font-size: 10px; color: var(--theme-dim);"><i class="fas fa-times-circle"></i> Not Enrolled</span>`
                }
              </div>
            </label>
          </div>
        `;
      }).join('');
    };

    const dialogContent = `
      <form class="intoterica-form" style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
        <!-- Award Configuration -->
        <div class="form-section">
          <div class="form-section-title"><i class="fas fa-star" style="color: #f59f00;"></i> Award Configuration</div>
          <div class="form-grid-2">
            <div class="form-group">
              <label>Target Faction</label>
              <select name="factionId" id="award-xp-faction-select">
                ${factions.map(f => `<option value="${f.id}" ${f.id === initialFactionId ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Base XP Amount</label>
              <input type="number" name="amount" value="100" min="1" />
            </div>
          </div>
        </div>

        <!-- Target Players -->
        <div class="form-section" style="margin-top: 10px;">
          <div class="form-section-title"><i class="fas fa-users" style="color: var(--theme-accent);"></i> Target Members</div>
          <div style="font-size: 11px; padding: 6px 8px; border-radius: 4px; background: rgba(79, 172, 254, 0.1); border-left: 3px solid var(--theme-accent); margin-bottom: 8px;">
            <i class="fas fa-info-circle"></i> Faction XP is only awarded to characters who are enrolled members of the target faction. Non-members cannot receive Faction XP.
          </div>
          <div id="award-xp-players-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            ${renderPlayerList(initialFactionId)}
          </div>
        </div>
      </form>
    `;

    const d = IntotericaApp.createDialog({
      title: "Award Faction XP",
      content: dialogContent,
      render: (html) => {
        const select = html.find('#award-xp-faction-select');
        const container = html.find('#award-xp-players-container');
        select.on('change', (e) => {
          const newFacId = e.target.value;
          container.html(renderPlayerList(newFacId));
        });
      },
      buttons: {
        award: {
          icon: '<i class="fas fa-star"></i>',
          label: "Award XP",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            const factionId = formData.factionId;
            const amount = parseInt(formData.amount);
            const playerIds = Object.keys(formData).filter(k => k.startsWith('player_') && formData[k]).map(k => k.replace('player_', ''));
            
            await this._processXPAward(factionId, amount, playerIds);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "award"
    }, { width: 500 });
    d.render(true);
  }

  async _processXPAward(factionId, baseAmount, playerIds) {
    const settings = game.settings.get('intoterica', 'data');
    const context = await this._prepareContext();
    const faction = settings.factions.find(f => f.id === factionId);
    const processedFaction = context.factions.find(f => f.id === factionId);
    
    if (!faction || !processedFaction) return;

    const modifier = processedFaction.xpMod || 1.0;
    const finalXP = Math.round(baseAmount * modifier);

    let updates = [];

    (playerIds || []).forEach(pid => {
      const member = (faction.members || []).find(m => m.id === pid && (m.type === 'Player' || !m.type));
      if (member) {
        if (typeof member.xp === 'undefined') member.xp = 0;
        member.xp += finalXP;
        
        // Check Rank Up
        let ranks = faction.ranks;
        if (ranks.length > 0 && typeof ranks[0] === 'string') {
             ranks = ranks.map(r => ({ name: r, xp: 0 }));
        }

        const currentRankIdx = member.rank;
        const nextRankIdx = currentRankIdx + 1;
        
        let rankUpMsg = "";
        if (nextRankIdx < ranks.length) {
          const nextRank = ranks[nextRankIdx];
          if (member.xp >= nextRank.xp) {
            member.rank = nextRankIdx;
            rankUpMsg = `<br><strong>Promoted to ${nextRank.name}!</strong>`;
          }
        }
        
        updates.push(`${member.name}: +${finalXP} XP${rankUpMsg}`);
      }
    });

    if (updates.length > 0) {
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
      
      if (game.settings.get('intoterica', 'notifyFactions')) {
        ChatMessage.create({
          content: `
            <div class="intoterica-chat-card">
              <h3>Faction Update: ${faction.name}</h3>
              <div class="card-content" style="text-align: left;">
                <div style="font-size: 12px; opacity: 0.8;">XP Modifier: x${modifier} (${processedFaction.statusLabel})</div>
                <ul style="margin: 5px 0; padding-left: 20px;">${updates.map(u => `<li>${u}</li>`).join('')}</ul>
              </div>
            </div>`
        });
      }
      ui.notifications.info(`Awarded ${finalXP} XP to ${updates.length} members.`);
    } else {
      ui.notifications.warn("No enrolled members in this faction were eligible to receive XP.");
    }
  }

  async _onAdjustPlayerRank(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === this.selectedFaction.id);
    if (!faction) return;

    const playerMembers = faction.members.filter(m => m.type === 'Player');
    if (playerMembers.length === 0) {
        ui.notifications.warn("No player members in this faction.");
        return;
    }

    IntotericaApp.createDialog({
      title: `Adjust Rank: ${faction.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Member Rank</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Select Player</label>
                <select name="memberId">
                  ${playerMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>New Rank</label>
                <select name="rankIdx">
                  ${(faction.ranks || []).map((r, i) => `<option value="${i}">${r.name}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Update Rank",
          callback: async (html) => {
            const { data: formData } = IntotericaApp.getFormData(html);
            await this._processRankAdjustment(faction.id, formData.memberId, parseInt(formData.rankIdx));
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { width: 440 }).render(true);
  }

  async _processRankAdjustment(factionId, memberId, newRankIdx) {
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === factionId);
      const member = faction?.members.find(m => m.id === memberId);
      
      if (member && faction.ranks[newRankIdx]) {
          const oldRankName = faction.ranks[member.rank]?.name || member.rank;
          const newRankName = faction.ranks[newRankIdx].name;
          
          member.rank = newRankIdx;
          
          await this._saveData(settings);
          this._broadcastUpdate();
          this.render();
          
          if (game.settings.get('intoterica', 'notifyFactions')) {
              ChatMessage.create({
                  content: `
                    <div class="intoterica-chat-card">
                      <h3>Faction Promotion: ${faction.name}</h3>
                      <div class="card-content">
                        <div style="font-size: 14px; margin-bottom: 5px;"><strong>${member.name}</strong></div>
                        <div>Rank adjusted from <strong>${oldRankName}</strong> to <strong>${newRankName}</strong></div>
                      </div>
                    </div>`
              });
          }
          ui.notifications.info(`Updated ${member.name}'s rank to ${newRankName}.`);
      }
  }

  // Helper to save data, routing through socket if user is not GM
  async _saveData(settings) {
    const clone = foundry.utils.deepClone(settings);
    if (game.user.isGM) {
      try {
        await game.settings.set('intoterica', 'data', clone);
      } catch (_e) {
        /* fallback to storage doc */
      }
      try {
        const settingDoc = game.settings.storage?.get("world")?.get("intoterica.data");
        if (settingDoc) {
          await settingDoc.update({ value: clone }, { diff: false });
        }
      } catch (_e) {
        /* storage doc update optional if settings.set succeeded */
      }
    } else {
      // Non-GMs cannot write to world settings directly
      // Emit socket event for GM to handle the save
      game.socket.emit('module.intoterica', { type: 'dispatch', action: 'updateData', payload: clone });
    }
  }

  // Broadcast updates to all connected clients
  _broadcastUpdate(payload = {}) {
    game.socket.emit('module.intoterica', {
      type: 'update',
      ...payload
    });
  }

  // Re-render when receiving updates from other clients
  static handleSocketUpdate() {
    // In V2, check if instance exists and is rendered
    if (IntotericaApp._instance?.rendered) {
      IntotericaApp._instance.render();
    }
  }

  static async handleDispatch(data) {
    if (!game.user.isGM) return; // Only GMs can execute writes to world settings
    
    // Use existing instance if available, otherwise create temporary one for method access
    const instance = IntotericaApp._instance || new IntotericaApp();

    switch (data.action) {
        case 'sendMail':
            await instance._sendMail(data.payload);
            break;
        case 'readMessage':
            await instance._performReadMessage(data.payload.messageId, data.payload.userId);
            break;
        case 'enlistFaction':
            await instance._performEnlistFaction(data.payload.factionId, data.payload.actorId);
            break;
        case 'updateData':
            await game.settings.set('intoterica', 'data', data.payload);
            instance._broadcastUpdate();
            break;
    }
  }

  static async openInbox(messageId) {
    const app = IntotericaApp._instance || new IntotericaApp();
    if (!app.rendered) await app.render({ force: true });
    
    app.currentView = 'mail';
    
    if (messageId) {
        const settings = game.settings.get('intoterica', 'data');
        const message = settings.inbox.find(m => m.id === messageId);
        if (message) {
            app.mailViewSubject = message.subject || "(No Subject)";
            app.mailComposeData = null;
        }
    }
    app.render({ force: true });
  }
}

// Expose the application class globally so macros and other scripts can access it.
if (typeof window !== 'undefined') window.IntotericaApp = IntotericaApp;

Hooks.on('ready', async () => {
  $(document).on('click', '.intoterica-open-inbox', (event) => {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    if (window.IntotericaApp) {
      window.IntotericaApp.openInbox(messageId);
    }
  });

  // Migration: Update audio settings from mp3 to ogg
  const audioSettings = ['soundIdle', 'soundNav', 'soundMail'];
  for (const key of audioSettings) {
    const val = game.settings.get('intoterica', key);
    if (val && typeof val === 'string' && val.includes('modules/intoterica/sounds/') && val.endsWith('.mp3')) {
      const newVal = val.replace('.mp3', '.ogg');
      console.log(`Intoterica | Migrating setting ${key} from .mp3 to .ogg`);
      await game.settings.set('intoterica', key, newVal);
    }
  }
});

// Expose globally so other scripts and macros can call IntotericaApp.toggle()
window.IntotericaApp = IntotericaApp;
