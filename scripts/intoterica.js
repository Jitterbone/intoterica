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
    "modules/intoterica/templates/mail.hbs",
    "modules/intoterica/templates/data-manager.hbs"
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

// Left-hand sidebar launcher (Foundry V13/V14 compatible control group)
Hooks.on('getSceneControlButtons', (controls) => {
  // Read the world-scoped icon setting (falls back gracefully before settings are ready)
  let groupIcon = 'fas fa-book';
  try { groupIcon = game.settings.get('intoterica', 'sidebarIcon') || groupIcon; } catch (_e) { /* settings not yet ready */ }

  // Individual page tools — each opens/navigates to its page on first click
  const pageTools = [
    { name: 'dashboard',   title: 'Dashboard',        icon: 'fas fa-chart-line',   view: 'dashboard'  },
    { name: 'quests',      title: 'Quest Journal',    icon: 'fas fa-scroll',       view: 'quests'     },
    { name: 'factions',    title: 'Factions',         icon: 'fas fa-users',        view: 'factions'   },
    { name: 'mail',        title: 'Inbox',            icon: 'fas fa-envelope',     view: 'mail'       },
    { name: 'achievements',title: 'Achievements',     icon: 'fas fa-trophy',       view: 'achievements'},
    { name: 'known-npcs',  title: 'Known NPCs',       icon: 'fas fa-user-friends', view: 'known-npcs' }
  ];

  // V13+ uses an object keyed by control name; V12 and earlier use an array.
  if (Array.isArray(controls)) {
    // Foundry V12 (legacy array API)
    controls.push({
      name: 'intoterica',
      title: 'Intoterica',
      icon: groupIcon,
      layer: 'tokens',
      visible: true,
      activeTool: 'select',
      tools: [
        {
          name: 'select',
          title: 'CONTROLS.CommonSelect',
          icon: 'fas fa-expand',
          visible: true
        },
        ...pageTools.map(t => ({
          name: t.name,
          title: t.title,
          icon: t.icon,
          visible: true,
          button: true,
          onClick: () => { if (window.IntotericaApp) window.IntotericaApp.openTo(t.view); }
        }))
      ]
    });
  } else {
    // Foundry V13+ (object API)
    const tools = {
      select: {
        name: 'select',
        title: 'CONTROLS.CommonSelect',
        icon: 'fas fa-expand',
        visible: true
      }
    };
    for (const t of pageTools) {
      tools[t.name] = {
        name: t.name,
        title: t.title,
        icon: t.icon,
        visible: true,
        button: true,
        onChange: () => { if (window.IntotericaApp) window.IntotericaApp.openTo(t.view); }
      };
    }

    controls['intoterica'] = {
      name: 'intoterica',
      title: 'Intoterica',
      icon: groupIcon,
      layer: 'tokens',
      activeTool: 'select',
      visible: true,
      tools
    };
  }
});

// Helper to determine if the Intoterica sidebar control group is active across Foundry V10-V14
function isIntotericaActive() {
  if (!ui.controls) return false;
  const ctrl = ui.controls.control;
  const name = typeof ctrl === 'string' ? ctrl : ctrl?.name;
  if (name === 'intoterica') return true;

  return Boolean(document.querySelector(
    '#controls [data-control="intoterica"].active, ' +
    '#controls [data-action="control"][data-control="intoterica"].active, ' +
    '#controls [data-group="intoterica"].active, ' +
    '#controls [data-tab="intoterica"].active, ' +
    '#controls button[data-control="intoterica"].active, ' +
    '#controls button.active[data-control="intoterica"], ' +
    '[data-control="intoterica"].active, ' +
    '[data-control="intoterica"][aria-pressed="true"], ' +
    '[data-group="intoterica"][aria-pressed="true"]'
  ));
}

// Add Intoterica Profile Button to Token HUD (Right-Click on Token)
Hooks.on('renderTokenHUD', (hud, html, data) => {
  const token = hud.object;
  const actor = token?.actor;
  if (!actor) return;

  const isGM = game.user.isGM;
  const isOwner = token.isOwner || token.document?.isOwner || actor.isOwner || (game.user.character && actor.id === game.user.character.id);
  if (!isGM && !isOwner) return;

  const root = html instanceof HTMLElement ? html : (html?.[0] || html);
  if (!root) return;

  // Prevent duplicate insertion
  if (root.querySelector('.intoterica-token-hud-btn')) return;

  // Read configured icon setting
  let iconClass = 'fas fa-book';
  try {
    iconClass = game.settings.get('intoterica', 'sidebarIcon') || iconClass;
  } catch (_e) {}

  const button = document.createElement('div');
  button.className = 'control-icon intoterica-token-hud-btn';
  button.title = `Intoterica: Open Profile (${actor.name})`;
  button.innerHTML = `<i class="${iconClass}"></i>`;

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.IntotericaApp?.openProfile) {
      window.IntotericaApp.openProfile(actor.id);
    }
  });

  // Inject into HUD left column if available, otherwise right column or root
  const col = root.querySelector('.col.left') || root.querySelector('.col.right') || root;
  col.appendChild(button);
});