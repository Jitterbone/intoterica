export const registerSettings = () => {
  // Register module settings
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

  // Visual Theme Setting
  game.settings.register('intoterica', 'theme', {
    name: 'Interface Theme',
    hint: 'Select the visual style of the application.',
    scope: 'client', 
    config: true,
    type: String,
    choices: {
      "default": "Default",
      "access-point": "Access Point",
      "soviet": "Soviet Retro",
      "dark-fantasy": "Dark Fantasy 80s",
      "vaporwave": "Vaporwave",
      "custom": "Custom Configuration"
    },
    default: "default",
    onChange: () => {
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "IntotericaApp") app.render();
      });
    }
  });

  // World Clock Setting
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

  // Default View Setting
  game.settings.register('intoterica', 'defaultView', {
    name: 'Default Start View',
    hint: 'Which tab should be active when opening the application.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      "dashboard": "Dashboard",
      "quests": "Quest Journal",
      "factions": "Factions",
      "mail": "Inbox",
      "known-npcs": "Known NPCs"
    },
    default: "dashboard"
  });

  // Sound Settings
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
    hint: 'Volume for background loops (0.0 - 1.0).',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.2,
    onChange: () => {
       // Real-time update for running sound
       if (window.IntotericaApp?._instance?._idleSound) {
           window.IntotericaApp._instance._idleSound.volume = game.settings.get('intoterica', 'volumeAmbience');
       }
    }
  });

  game.settings.register('intoterica', 'volumeInterface', {
    name: 'Interface Volume',
    hint: 'Volume for clicks and navigation (0.0 - 1.0).',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.8
  });

  game.settings.register('intoterica', 'volumeNotification', {
    name: 'Notification Volume',
    hint: 'Volume for new message alerts (0.0 - 1.0).',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.6
  });

  game.settings.register('intoterica', 'soundIdle', {
    name: 'Background Ambience',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/IntotericaIdle.mp3"
  });

  game.settings.register('intoterica', 'soundNav', {
    name: 'Navigation Click Sound',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/NavSound.mp3"
  });

  game.settings.register('intoterica', 'soundMail', {
    name: 'New Message Sound',
    hint: 'Used when Theme is set to Custom Configuration.',
    scope: 'client',
    config: true,
    type: String,
    filePicker: "audio",
    default: "modules/intoterica/sounds/VeilMailSound.mp3"
  });

  // Notification Toggles
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

  // Permission Settings
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

  // Handle conditional visibility of settings
  Hooks.on('renderSettingsConfig', (app, html, data) => {
    const $html = $(html);
    const themeSelect = $html.find('select[name="intoterica.theme"]');
    if (!themeSelect.length) return;

    const dependentSettings = [
      'intoterica.soundIdle',
      'intoterica.soundNav',
      'intoterica.soundMail',
      'intoterica.customCSS',
      'intoterica.volumeAmbience',
      'intoterica.volumeInterface',
      'intoterica.volumeNotification'
    ];

    const updateVisibility = () => {
      const isCustom = themeSelect.val() === 'custom';
      dependentSettings.forEach(name => {
        const group = $html.find(`[name="${name}"]`).closest('.form-group');
        if (isCustom) group.show();
        else group.hide();
      });
    };

    themeSelect.on('change', updateVisibility);
    updateVisibility();

    // Convert Custom CSS input to textarea
    const cssInput = $html.find('input[name="intoterica.customCSS"]');
    if (cssInput.length) {
      const textarea = $(`<textarea name="intoterica.customCSS" style="min-height: 200px; font-family: monospace; white-space: pre;">${cssInput.val()}</textarea>`);
      cssInput.replaceWith(textarea);
    }
  });
};
