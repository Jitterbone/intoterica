import { IntotericaDataManager } from './data-manager.js';

export const registerSettings = () => {

  // ─── Data Management & Migration Menu ─────────────────────────────────────

  game.settings.registerMenu('intoterica', 'dataManager', {
    name: 'Intoterica Data & Migration',
    label: 'Open Data Manager',
    hint: 'Inspect raw module storage, export/import backups, and transfer character progress (quests, factions, badges, mail) between character sheets.',
    icon: 'fas fa-database',
    type: IntotericaDataManager,
    restricted: true
  });

  // ─── Hidden / internal ────────────────────────────────────────────────────

  game.settings.register('intoterica', 'data', {
    name: 'Intoterica Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      meritBadges: [],
      quests: [],
      factions: [],
      inbox: [],
      knownNPCs: [],
      closedThreads: [],
      worldClock: { era: 1, day: 1 }
    }
  });

  game.settings.register('intoterica', 'windowState', {
    scope: 'client',
    config: false,
    type: Object,
    default: {}
  });

  // ─── Appearance ───────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'theme', {
    name: 'Interface Theme',
    hint: 'Select the visual style of the application.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      "default":      "Default (Foundry)",
      "access-point": "Access Point",
      "soviet":       "Soviet Retro",
      "dark-fantasy": "Dark Fantasy 80s",
      "vaporwave":    "Vaporwave",
      "custom":       "Custom Configuration"
    },
    default: "default",
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  game.settings.register('intoterica', 'sidebarIcon', {
    name: 'Sidebar Launcher Icon',
    hint: 'The icon displayed for the Intoterica launcher in the left-hand sidebar. This is a world setting — all players will see the same icon.',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      "fas fa-book":           "Book (default)",
      "fas fa-desktop":        "Vintage Computer Monitor",
      "fas fa-scroll":         "Scroll",
      "fas fa-map":            "Map",
      "fas fa-compass":        "Compass",
      "fas fa-globe":          "Globe",
      "fas fa-journal-whills": "Jedi Holocron / Journal",
      "fas fa-star":           "Star",
      "fas fa-dragon":         "Dragon",
      "fas fa-hat-wizard":     "Wizard Hat"
    },
    default: "fas fa-book",
    requiresReload: true,
    onChange: () => {
      if (ui.controls) ui.controls.render();
    }
  });

  game.settings.register('intoterica', 'defaultView', {
    name: 'Default Start View',
    hint: 'Which tab should be active when opening the application.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      "dashboard":  "Dashboard",
      "quests":     "Quest Journal",
      "factions":   "Factions",
      "mail":       "Inbox",
      "known-npcs": "Known NPCs"
    },
    default: "dashboard"
  });

  // ─── World Clock ──────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'useWorldClock', {
    name: 'Sync with World Clock',
    hint: 'Use Foundry VTT world time (or Simple Calendar) instead of manual Era/Day.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  // ─── Factions ─────────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'enableFactionXP', {
    name: 'Enable Faction XP',
    hint: 'If enabled, player ranks are determined by XP. If disabled, GMs manually adjust ranks.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  // ─── Notifications ────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'showNotificationBadges', {
    name: 'Show Notification Bubbles',
    hint: 'Display unread mail count notification badges on the sidebar launcher and navigation icons.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      window.IntotericaSceneBadges?.();
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  game.settings.register('intoterica', 'notifyMail', {
    name: 'Chat: Mail Notifications',
    hint: 'Post "You\'ve got mail" cards to chat.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register('intoterica', 'notifyFactions', {
    name: 'Chat: Faction Updates',
    hint: 'Post reputation changes and XP awards to chat.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register('intoterica', 'notifyBadges', {
    name: 'Chat: Badge Awards',
    hint: 'Post merit badge awards to chat.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register('intoterica', 'notifyQuests', {
    name: 'Chat: Quest Updates',
    hint: 'Post quest updates, completions, and new quests to chat.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // ─── Quest System & Difficulty ─────────────────────────────────────────────

  game.settings.register('intoterica', 'difficultyScale', {
    name: 'Quest Difficulty System',
    hint: 'Choose the difficulty tier naming convention used across the Quest Journal.',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      "standard": "Standard (Easy, Medium, Hard, Epic, Legendary)",
      "metal": "Metal Tiers (Copper, Bronze, Silver, Gold, Platinum)",
      "rank": "Guild Rank (E-Rank, D-Rank, C-Rank, B-Rank, A-Rank, S-Rank)",
      "stars": "Star Rating (1-Star, 2-Star, 3-Star, 4-Star, 5-Star)",
      "numeric": "Tiers (Tier I, Tier II, Tier III, Tier IV, Tier V)"
    },
    default: "standard",
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  game.settings.register('intoterica', 'questXpAutomation', {
    name: 'Quest XP Automation',
    hint: 'Configure how XP rewards are distributed when a quest is completed.',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      "full": "Reward Full XP (Always grant full XP regardless of failed objectives)",
      "proportional": "Divide Failed Objectives (Deduct failed objectives proportionally from total XP)",
      "disabled": "Disable XP Automation (No automated XP rewards awarded upon completion)"
    },
    default: "full"
  });

  // ─── Permissions ──────────────────────────────────────────────────────────

  const ROLES = {
    1: "Player",
    2: "Trusted Player",
    3: "Assistant GM",
    4: "Game Master"
  };

  game.settings.register('intoterica', 'permFactions', {
    name: 'Permission: Manage Factions',
    hint: 'Minimum role required to create, edit, and delete factions.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  game.settings.register('intoterica', 'permQuests', {
    name: 'Permission: Manage Quests',
    hint: 'Minimum role required to create, edit, and complete quests.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  game.settings.register('intoterica', 'permBadges', {
    name: 'Permission: Manage Badges',
    hint: 'Minimum role required to create and award merit badges.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  game.settings.register('intoterica', 'permMail', {
    name: 'Permission: Manage Mail & NPCs',
    hint: 'Minimum role required to view all mail, moderate threads, and manage Known NPCs.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  game.settings.register('intoterica', 'permClock', {
    name: 'Permission: Edit Clock',
    hint: 'Minimum role required to modify the world clock.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  game.settings.register('intoterica', 'permProfiles', {
    name: 'Permission: View Full Profiles',
    hint: 'Minimum role required to view full profiles of other players.',
    scope: 'world',
    config: true,
    type: Number,
    choices: ROLES,
    default: 3
  });

  // ─── Sound ────────────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'enableSounds', {
    name: 'Enable Sounds',
    hint: 'Play interface sounds and background ambience.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") {
          if (!game.settings.get('intoterica', 'enableSounds') && app._idleSound) {
            app._idleSound.stop();
            app._idleSound = null;
          } else {
            app.render();
          }
        }
      });
    }
  });

  game.settings.register('intoterica', 'volumeAmbience', {
    name: 'Ambience Volume',
    hint: 'Volume for background loops (0.0 – 1.0). Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.2,
    onChange: () => {
      if (window.IntotericaApp?._instance?._idleSound) {
        window.IntotericaApp._instance._idleSound.volume = game.settings.get('intoterica', 'volumeAmbience');
      }
    }
  });

  game.settings.register('intoterica', 'volumeInterface', {
    name: 'Interface Volume',
    hint: 'Volume for clicks and navigation (0.0 – 1.0). Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.8
  });

  game.settings.register('intoterica', 'volumeNotification', {
    name: 'Notification Volume',
    hint: 'Volume for new message alerts (0.0 – 1.0). Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.6
  });

  game.settings.register('intoterica', 'soundIdle', {
    name: 'Background Ambience File',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/IntotericaIdle.ogg"
  });

  game.settings.register('intoterica', 'soundNav', {
    name: 'Navigation Click Sound File',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/NavSound.ogg"
  });

  game.settings.register('intoterica', 'soundMail', {
    name: 'New Message Sound File',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/VeilMailSound.ogg"
  });

  // ─── Advanced ─────────────────────────────────────────────────────────────

  game.settings.register('intoterica', 'customCSS', {
    name: 'Custom CSS',
    hint: '⚠️ ADVANCED: Enter custom CSS to style the interface. Only applied when Theme is set to "Custom Configuration".',
    scope: 'client',
    config: true,
    type: String,
    default: "",
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  // ─── Settings Config UI Styling ───────────────────────────────────────────
  // Injects styled section headers into the Foundry settings panel.

  Hooks.on('renderSettingsConfig', (app, html) => {
    const root = html instanceof HTMLElement ? html : (html[0] || html);
    if (!root) return;

    // Header styling
    const mainHeaderStyle = [
      'font-size: 1.15rem',
      'font-weight: 700',
      'border-bottom: 2px solid rgba(42, 122, 127, 0.85)',
      'color: #9bd7e5',
      'margin: 20px 0 10px 0',
      'padding-bottom: 4px',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'width: 100%',
      'text-transform: uppercase',
      'letter-spacing: 0.05em',
      'grid-column: 1 / -1',
      'flex-basis: 100%',
      'clear: both'
    ].join('; ');

    const subHeaderStyle = [
      'font-size: 0.92rem',
      'font-weight: 700',
      'color: #6ee7b7',
      'margin: 14px 0 6px 0',
      'padding: 3px 0 4px 8px',
      'border-left: 3px solid #2a7a7f',
      'border-bottom: 1px solid rgba(42, 122, 127, 0.35)',
      'background: rgba(42, 122, 127, 0.08)',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'width: 100%',
      'text-transform: uppercase',
      'letter-spacing: 0.03em',
      'grid-column: 1 / -1',
      'flex-basis: 100%',
      'clear: both'
    ].join('; ');

    // Helper — inserts an h3 (main) or h4 (sub) before a target element
    const insertHeader = (tag, cls, iconCls, iconColor, text, style, target) => {
      if (!target || root.querySelector(`.${cls}`)) return;
      const el = document.createElement(tag);
      el.className = cls;
      el.innerHTML = `<i class="${iconCls}" style="color:${iconColor}"></i> ${text}`;
      el.style.cssText = style;
      target.parentNode.insertBefore(el, target);
    };

    // Helper — find a setting row by setting id (v14: data-setting-id, v13: [name=...])
    const findRow = (id) =>
      root.querySelector(`[data-setting-id="intoterica.${id}"]`) ||
      root.querySelector(`[data-key="intoterica.${id}"]`) ||
      root.querySelector(`[name="intoterica.${id}"]`)?.closest('.form-group') ||
      root.querySelector(`button[data-action="intoterica.${id}"], button[data-key="intoterica.${id}"]`)?.closest('.form-group');

    // ── Data Management & Migration ──
    insertHeader('h3', 'intoterica-datamanager-header',
      'fas fa-database', '#38bdf8',
      'Data Management & Migration', mainHeaderStyle,
      findRow('dataManager'));

    // ── Appearance ──
    insertHeader('h3', 'intoterica-appearance-header',
      'fas fa-palette', '#a78bfa',
      'Appearance', mainHeaderStyle,
      findRow('theme'));

    // ── World Clock ──
    insertHeader('h3', 'intoterica-clock-header',
      'fas fa-clock', '#f1c40f',
      'World Clock', mainHeaderStyle,
      findRow('useWorldClock'));

    // ── Factions ──
    insertHeader('h3', 'intoterica-factions-header',
      'fas fa-users', '#9bd7e5',
      'Factions', mainHeaderStyle,
      findRow('enableFactionXP'));

    // ── Quest System ──
    insertHeader('h3', 'intoterica-quests-header',
      'fas fa-scroll', '#f59e0b',
      'Quest System & Difficulty', mainHeaderStyle,
      findRow('difficultyScale'));

    // ── Notifications ──
    insertHeader('h3', 'intoterica-notify-header',
      'fas fa-bell', '#6ee7b7',
      'Notifications', mainHeaderStyle,
      findRow('notifyMail'));

    // ── Permissions ──
    insertHeader('h3', 'intoterica-perms-header',
      'fas fa-lock', '#f87171',
      'Permissions', mainHeaderStyle,
      findRow('permFactions'));

    // ── Sound (main) ──
    insertHeader('h3', 'intoterica-sound-header',
      'fas fa-volume-high', '#9bd7e5',
      'Sound', mainHeaderStyle,
      findRow('enableSounds'));

    // ── Sound > Volumes (sub) ──
    insertHeader('h4', 'intoterica-volumes-sub-header',
      'fas fa-sliders', '#6ee7b7',
      'Volume Controls', subHeaderStyle,
      findRow('volumeAmbience'));

    // ── Sound > Files (sub) ──
    insertHeader('h4', 'intoterica-soundfiles-sub-header',
      'fas fa-music', '#6ee7b7',
      'Sound Files', subHeaderStyle,
      findRow('soundIdle'));

    // ── Advanced (sub within sound / bottom) ──
    insertHeader('h4', 'intoterica-advanced-sub-header',
      'fas fa-code', '#f87171',
      'Advanced', subHeaderStyle,
      findRow('customCSS'));

    // ── Visibility toggling for custom-theme-only settings ──
    const themeSelect = root.querySelector('select[name="intoterica.theme"]') ||
                        root.querySelector('[name="intoterica.theme"]') ||
                        root.querySelector('[data-setting-id="intoterica.theme"] select');
    if (!themeSelect) return;

    const customOnlyIds = [
      'volumeAmbience', 'volumeInterface', 'volumeNotification',
      'soundIdle', 'soundNav', 'soundMail', 'customCSS'
    ];
    const customOnlySubHeaders = [
      '.intoterica-volumes-sub-header',
      '.intoterica-soundfiles-sub-header',
      '.intoterica-advanced-sub-header'
    ];

    const updateVisibility = () => {
      const isCustom = themeSelect.value === 'custom';

      customOnlyIds.forEach(id => {
        const row = findRow(id);
        if (row) row.style.display = isCustom ? '' : 'none';
      });

      customOnlySubHeaders.forEach(sel => {
        const el = root.querySelector(sel);
        if (el) el.style.display = isCustom ? '' : 'none';
      });

      // Expand the Custom CSS input into a textarea
      if (isCustom) {
        const cssInput = root.querySelector('[name="intoterica.customCSS"]');
        if (cssInput && cssInput.tagName === 'INPUT') {
          const textarea = document.createElement('textarea');
          textarea.name = 'intoterica.customCSS';
          textarea.style.cssText = 'min-height: 200px; font-family: monospace; white-space: pre; width: 100%;';
          textarea.value = cssInput.value;
          cssInput.replaceWith(textarea);
        }
      }
    };

    themeSelect.addEventListener('change', updateVisibility);
    updateVisibility();
  });
};
