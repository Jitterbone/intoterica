import { registerSettings } from './settings.js';
import { registerHelpers } from './helpers.js';
import { initializeSocket } from './socket.js';

// Register Handlebars Helpers and Settings
Hooks.once('init', async () => {
  console.log("Intoterica | Initializing");

  registerHelpers();
  registerSettings();

  // Pre-load and register template partials
  const templatePaths = [
    "modules/intoterica/templates/dashboard.hbs",
    "modules/intoterica/templates/quests.hbs",
    "modules/intoterica/templates/factions.hbs",
    "modules/intoterica/templates/achievements.hbs",
    "modules/intoterica/templates/mail.hbs"
  ];

  await foundry.applications.handlebars.loadTemplates(templatePaths);
});

Hooks.once('ready', () => {
  console.log("Intoterica | Ready");

  initializeSocket();
});

Hooks.on('preCreateChatMessage', (document, data, options, userId) => {
  if (data.content && data.content.includes('intoterica-chat-card')) {
    const theme = game.settings.get('intoterica', 'theme') || 'default';
    document.updateSource({ 'flags.intoterica.theme': theme });
  }
});

Hooks.on('renderChatMessageHTML', (message, html) => {
  const card = html.querySelector('.intoterica-chat-card');
  if (card) {
    const themeKey = message.getFlag('intoterica', 'theme') || game.settings.get('intoterica', 'theme') || 'default';
    const themeClass = window.IntotericaApp?.THEMES?.[themeKey]?.class || 'theme-foundry';
    card.classList.add(themeClass);
  }
});