/**
 * Intoterica - Modern, modular Foundry VTT Application
 * Main Application Orchestrator
 */

import { DIFFICULTY_SCALES, THEMES } from "./core/constants.js";
import { hasPermission, PERMISSIONS } from "./core/permissions.js";
import { getSoundPath } from "./core/audio.js";
import {
  createDialog,
  getFormData,
  formatMarkdown,
  createRichTextEditorHtml,
  initRichTextEditor,
  syncRichEditors,
  getThemeClass
} from "./core/dialog.js";

import {
  getDifficultyInfo,
  getPlayerActors,
  getQuestGiverOptions,
  getSystemCurrencies,
  prepareQuestsContext
} from "./features/quests/quest-helpers.js";
import { questActions, bindQuestEvents } from "./features/quests/quest-actions.js";
import { questDialogs } from "./features/quests/quest-dialogs.js";

import {
  getRepStatus,
  calculateFactionRep,
  prepareFactionsContext
} from "./features/factions/faction-helpers.js";
import { factionActions, bindFactionEvents } from "./features/factions/faction-actions.js";
import { factionDialogs } from "./features/factions/faction-dialogs.js";

import {
  isMessageUnreadForUser,
  markMessagesAsReadForUser,
  getUnreadMailCount,
  getMailSenderOptions,
  prepareMailContext
} from "./features/mail/mail-helpers.js";
import { mailActions, bindMailEvents } from "./features/mail/mail-actions.js";

import {
  prepareBadgesContext,
  badgeActions,
  bindBadgeEvents
} from "./features/badges/badge-actions.js";

import {
  getGameDate,
  prepareClockContext,
  clockActions,
  bindClockEvents
} from "./features/clock/clock-actions.js";

import {
  openProfile,
  executeOpenProfile,
  getActorImageByNameOrId,
  prepareDashboardContext,
  profileActions,
  bindDashboardEvents
} from "./features/profiles/profile-actions.js";

export class IntotericaApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static _instance = null;

  static get VERSION() {
    const liveVersion = game.modules?.get('intoterica')?.version;
    return (liveVersion && liveVersion !== '1.1.0') ? liveVersion : "1.5.1";
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

  async _prepareContext(_options) {
    const settings = game.settings.get('intoterica', 'data') || {};
    const canManageMail = hasPermission('permMail');

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

    // Permissions
    const perms = {
      factions: hasPermission('permFactions'),
      quests: hasPermission('permQuests'),
      badges: hasPermission('permBadges'),
      mail: hasPermission('permMail'),
      clock: hasPermission('permClock'),
      profiles: hasPermission('permProfiles')
    };

    // Prepare Quests Context
    const questsContext = prepareQuestsContext(settings, this, perms);

    // Prepare Factions Context
    const processedFactions = prepareFactionsContext(settings, this, canManageMail);

    // Prepare Mail Context
    const mailContextData = prepareMailContext(settings, this, perms);

    // Prepare Badges Context
    const meritBadges = prepareBadgesContext(settings);

    // Prepare Clock Context
    const clockContext = prepareClockContext(settings, perms);

    // Prepare Dashboard & Profile Context
    const dashboardContext = prepareDashboardContext(settings, this, perms, questsContext.processedQuests || questsContext.allQuests, processedFactions);

    return {
      isGM: perms.mail,
      clockDisplay: clockContext.clockDisplay,
      canEditClock: clockContext.canEditClock,
      theme: game.settings.get('intoterica', 'theme'),
      themeClass: getThemeClass(),
      currentView: this.currentView,
      selectedFaction: this.selectedFaction,
      meritBadges,
      quests: questsContext.quests || questsContext.filteredQuests,
      questFilter: this.questFilter || 'active',
      questSearch: this.questSearch || '',
      questStats: questsContext.questStats,
      questFilterFactions: questsContext.questFilterFactions,
      questFilterGivers: questsContext.questFilterGivers,
      questFilterDifficulties: questsContext.questFilterDifficulties,
      questFactionFilter: this.questFactionFilter || '',
      questGiverFilter: this.questGiverFilter || '',
      questDifficultyFilter: this.questDifficultyFilter || '',
      questSort: this.questSort || 'default',
      showAdvancedFilters: this.showAdvancedFilters,
      hasActiveFilters: questsContext.hasActiveFilters,
      activeFilterCount: questsContext.activeFilterCount,
      factions: processedFactions,
      players: dashboardContext.players,
      profile: dashboardContext.profile,
      inbox: mailContextData.inbox,
      knownNPCs: mailContextData.knownNPCs,
      mailContext: mailContextData.mailContext,
      showDashboard: this.currentView === 'dashboard' && !this.profileActorId,
      showProfile: this.currentView === 'dashboard' && this.profileActorId,
      stats: {
        activeQuests: questsContext.activeQuests.length,
        unreadMail: mailContextData.unreadMailCount,
        earnedBadges: (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(game.user.character?.id)).length
      },
      worldClock: clockContext.worldClock,
      perms
    };
  }

  async _onRender(_context, _options) {
    const html = $(this.element);

    // Apply active theme class to the outer window application container
    const themeClass = getThemeClass();
    this.element.className = this.element.className.replace(/\btheme-[a-zA-Z0-9_-]+\b/g, '').trim();
    this.element.classList.add(themeClass);

    // Navigation Tabs
    html.find('.nav-item').click(this._onViewChange.bind(this));

    // Bind Feature Events
    bindQuestEvents(html, this, _context);
    bindFactionEvents(html, this, _context);
    bindMailEvents(html, this, _context);
    bindBadgeEvents(html, this);
    bindClockEvents(html, this);
    bindDashboardEvents(html, this, _context);

    // Start idle sound if enabled (Async - do not await to block UI)
    const enableSounds = game.settings.get('intoterica', 'enableSounds');
    const soundPath = getSoundPath('idle');

    if (enableSounds && !this._idleSound && soundPath && !this._isClosing) {
      const themeKey = game.settings.get('intoterica', 'theme');
      const themeConfig = THEMES[themeKey];
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

  _onViewChange(event) {
    event.preventDefault();
    if (game.settings.get('intoterica', 'enableSounds')) {
      const soundPath = getSoundPath('nav');
      let volume = game.settings.get('intoterica', 'volumeInterface');
      const themeKey = game.settings.get('intoterica', 'theme');
      const themeConfig = THEMES[themeKey];
      if (themeConfig && themeConfig.volumeScale) {
        volume = Math.min(1.0, volume * themeConfig.volumeScale);
      }
      if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: volume, autoplay: true, loop: false}, false);
    }

    const targetView = event.currentTarget.dataset.view;
    if (targetView && targetView !== this.currentView) {
      this.currentView = targetView;
      this.selectedFaction = null;
      this.profileActorId = null;
      this.mailComposeData = null;
      this.mailViewSubject = null;
      this.render();
    }
  }

  async _saveData(settings) {
    const clone = foundry.utils.deepClone(settings);
    if (game.user.isGM) {
      try {
        await game.settings.set('intoterica', 'data', clone);
      } catch (_e) {
        try {
          const settingDoc = game.settings.storage?.get("world")?.get("intoterica.data");
          if (settingDoc) {
            await settingDoc.update({ value: clone }, { diff: false });
          }
        } catch (_err) {
          console.error("Intoterica | Failed to save setting data:", _err);
        }
      }
    } else {
      game.socket.emit('module.intoterica', { type: 'dispatch', action: 'updateData', payload: clone });
    }
  }

  _broadcastUpdate(payload = {}) {
    game.socket.emit('module.intoterica', {
      type: 'update',
      ...payload
    });
  }

  static handleSocketUpdate() {
    window.IntotericaSceneBadges?.();
    if (IntotericaApp._instance?.rendered) {
      IntotericaApp._instance.render();
    }
  }

  static async handleDispatch(data) {
    if (!game.user.isGM) return;
    const instance = IntotericaApp._instance || new IntotericaApp();

    switch (data.action) {
      case 'sendMail':
        await instance._sendMail(data.payload);
        break;
      case 'readMessage':
        await instance._performReadMessage(data.payload.messageId, data.payload.userId);
        break;
      case 'markReadMultiple': {
        const user = game.users.get(data.payload.userId) || game.user;
        await IntotericaApp.markMessagesAsReadForUser(data.payload.items, user);
        break;
      }
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

// Composition: Attach all feature actions, dialogs, and methods onto IntotericaApp prototype
Object.assign(
  IntotericaApp.prototype,
  questActions,
  questDialogs,
  factionActions,
  factionDialogs,
  mailActions,
  badgeActions,
  clockActions,
  profileActions
);

// Delegate all static properties and methods onto IntotericaApp
IntotericaApp.THEMES = THEMES;
IntotericaApp.PERMISSIONS = PERMISSIONS;
IntotericaApp.DIFFICULTY_SCALES = DIFFICULTY_SCALES;
IntotericaApp.hasPermission = hasPermission;
IntotericaApp.getSoundPath = getSoundPath;
IntotericaApp.createDialog = createDialog;
IntotericaApp.getFormData = getFormData;
IntotericaApp.formatMarkdown = formatMarkdown;
IntotericaApp.createRichTextEditorHtml = createRichTextEditorHtml;
IntotericaApp.initRichTextEditor = initRichTextEditor;
IntotericaApp.syncRichEditors = syncRichEditors;
IntotericaApp.getThemeClass = getThemeClass;
IntotericaApp.getDifficultyInfo = getDifficultyInfo;
IntotericaApp.getPlayerActors = getPlayerActors;
IntotericaApp.getQuestGiverOptions = getQuestGiverOptions;
IntotericaApp.getSystemCurrencies = getSystemCurrencies;
IntotericaApp.isMessageUnreadForUser = isMessageUnreadForUser;
IntotericaApp.markMessagesAsReadForUser = markMessagesAsReadForUser;
IntotericaApp.getUnreadMailCount = getUnreadMailCount;
IntotericaApp.getMailSenderOptions = getMailSenderOptions;
IntotericaApp.openProfile = openProfile;
IntotericaApp._executeOpenProfile = executeOpenProfile;
IntotericaApp.getActorImageByNameOrId = getActorImageByNameOrId;

// Expose globally for macros, hooks, and external access
if (typeof window !== 'undefined') {
  window.IntotericaApp = IntotericaApp;
}

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
