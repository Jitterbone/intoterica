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
      "default": "Intoterica Default",
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
};
