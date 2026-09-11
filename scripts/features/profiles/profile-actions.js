/**
 * Intoterica Profile & Dashboard Actions
 * Character profile view, dashboard overview, and mission reports
 */

import { hasPermission } from "../../core/permissions.js";
import { createDialog, getFormData } from "../../core/dialog.js";
import { getDifficultyInfo } from "../quests/quest-helpers.js";
import { isMessageUnreadForUser, markMessagesAsReadForUser } from "../mail/mail-helpers.js";

let _profileDebounceTimer = null;

/**
 * Debounced helper to open a character's profile sheet.
 * @param {string|Actor|Token} actorOrId 
 */
export function openProfile(actorOrId) {
  if (_profileDebounceTimer) {
    clearTimeout(_profileDebounceTimer);
  }
  _profileDebounceTimer = setTimeout(() => {
    _profileDebounceTimer = null;
    executeOpenProfile(actorOrId);
  }, 40);
}

/**
 * Directly executes opening a character's profile sheet.
 * @param {string|Actor|Token} target 
 */
export function executeOpenProfile(target) {
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

  let app = window.IntotericaApp?._instance;
  if (!app || !app.rendered) {
    app = new window.IntotericaApp();
    window.IntotericaApp._instance = app;
  }
  app.currentView = 'dashboard';
  app.selectedFaction = null;
  app.profileActorId = actorId;
  app.render(true);
  if (typeof app.bringToTop === 'function') {
    try { app.bringToTop(); } catch (_e) { /* ignore */ }
  }
}

/**
 * Finds actor image by id or name with fallback.
 * @param {string} actorId 
 * @param {string} actorName 
 * @param {string} [fallback="icons/svg/mystery-man.svg"] 
 * @returns {string}
 */
export function getActorImageByNameOrId(actorId, actorName, fallback = "icons/svg/mystery-man.svg") {
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

/**
 * Prepares players overview and active profile context.
 * @param {Object} settings 
 * @param {Object} app 
 * @param {Object} perms 
 * @param {Array} processedQuests 
 * @param {Array} processedFactions 
 * @returns {{players: Array, profile: Object|null}}
 */
export function prepareDashboardContext(settings, app, perms = {}, processedQuests = [], processedFactions = []) {
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
        canExpand: perms.profiles || isSelf
      });
    }
  }

  // Profile Data
  let profile = null;
  if (app.profileActorId) {
    const actor = game.actors.get(app.profileActorId) || canvas?.tokens?.placeables?.find(t => t.actor?.id === app.profileActorId || t.id === app.profileActorId)?.actor;
    const isOwnCharacter = game.user.character?.id === app.profileActorId || actor?.isOwner;

    if (actor && (game.user.isGM || perms.profiles || isOwnCharacter)) {
      const actorId = actor.id;
      
      // Get Profile History (Hidden/Added quests)
      const profileHistory = (settings.profileHistory || {})[actorId] || { hidden: [], added: [] };
      
      // Determine quests for this actor
      const actorQuests = (processedQuests || []).filter(q => {
        if (profileHistory.hidden && profileHistory.hidden.includes(q.id)) return false;
        const statusLower = String(q.status || '').toLowerCase();
        const isPartyAssigned = q.assignedAll === true || q.isAssignAll || (!q.assignedTo || q.assignedTo.length === 0);
        const assignedList = Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []);
        const isExplicitlyAssigned = assignedList.some(id => 
          id === actorId || 
          String(id) === String(actorId) ||
          (actor.name && typeof id === 'string' && id.trim().toLowerCase() === actor.name.trim().toLowerCase()) ||
          (game.user.character?.id === actorId && id === game.user.id)
        );
        const isCompletedBy = Array.isArray(q.completedBy) && q.completedBy.includes(actorId);
        const isFailedBy = Array.isArray(q.failedBy) && q.failedBy.includes(actorId);
        
        if (statusLower === 'active') {
          return isPartyAssigned || isExplicitlyAssigned;
        }
        if (statusLower === 'completed') {
          if (Array.isArray(q.completedBy)) {
            return isCompletedBy;
          }
          if (assignedList.length > 0) {
            return isExplicitlyAssigned;
          }
          return isPartyAssigned;
        }
        if (statusLower === 'failed') {
          if (Array.isArray(q.failedBy)) {
            return isFailedBy;
          }
          if (assignedList.length > 0) {
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
      historyQuests = Array.from(new Map(historyQuests.map(q => [q.id, q])).values());

      const profileUsers = game.users ? game.users.filter(u => u.character?.id === actorId) : [];
      const targetUser = (profileUsers.length > 0 && !game.user.isGM) ? profileUsers[0] : game.user;
      const unreadProfileMessages = (settings.inbox || []).filter(m => {
        const to = Array.isArray(m.to) ? m.to : [m.to];
        const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
        const isRecipient = to.includes(actorId) || cc.includes(actorId) || 
          (actor.name && (to.some(t => typeof t === 'string' && t.trim().toLowerCase() === actor.name.trim().toLowerCase()) || cc.some(c => typeof c === 'string' && c.trim().toLowerCase() === actor.name.trim().toLowerCase())));
        if (!isRecipient) return false;
        return isMessageUnreadForUser(m, targetUser);
      });

      profile = {
        id: actorId,
        name: actor.name || "Unknown",
        img: (actor.img && actor.img !== "icons/svg/mystery-man.svg") ? actor.img : (actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg"),
        badges: (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(actorId)).map(b => ({
          ...b,
          isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
        })),
        factions: (processedFactions || []).filter(f => (f.members || []).some(m => m.id === actorId)).map(f => {
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
        messages: unreadProfileMessages,
        quests: historyQuests.filter(q => String(q.status).toLowerCase() === 'active'),
        completedQuests: historyQuests.filter(q => q.status === 'Completed'),
        failedQuests: historyQuests.filter(q => q.status === 'Failed')
      };
    } else {
      app.profileActorId = null;
    }
  }

  return {
    players,
    profile
  };
}

export const profileActions = {
  _onSelectPlayer(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    if (actorId) {
      openProfile(actorId);
    }
  },

  _onCloseProfile(event) {
    event.preventDefault();
    event.stopPropagation();
    this.profileActorId = null;
    setTimeout(() => this.render(), 10);
  },

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
  },

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
    const rankOptions = ranks.map((r, i) => `<option value="${i}" ${i === currentRankIdx ? 'selected' : ''}>${Handlebars.escapeExpression(r.name)}${r.xp != null ? ` (${r.xp} XP threshold)` : ''}</option>`).join('');

    createDialog({
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
  },

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
  },

  async _onAddLegacyQuest(event) {
    event.preventDefault();
    createDialog({
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
            const { data: formData } = getFormData(html);
            
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
};

/**
 * Binds profile and dashboard DOM events.
 * @param {JQuery} html 
 * @param {Object} app 
 * @param {Object} context 
 */
export function bindDashboardEvents(html, app, context) {
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (app._onSelectPlayer) {
    html.find('.player-card').click(app._onSelectPlayer.bind(app));
  }

  // Profile Back Button
  if (app._onCloseProfile) {
    html.find('.back-btn').off('click').on('click', app._onCloseProfile.bind(app));
  }
  html.find('.profile-quest-link').click(app._onProfileQuestClick.bind(app));
  html.find('.profile-message-link').click(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const messageId = event.currentTarget.dataset.messageId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const inbox = raw.inbox || [];
    const message = inbox.find(m => m.id === messageId);
    
    app.currentView = 'mail';
    app.profileActorId = null;
    
    if (message) {
      app.mailViewSubject = message.subject || "(No Subject)";
      app.mailComposeData = null;
      
      const norm = (message.subject || "(No Subject)").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      const matchingIds = inbox.filter(m => {
        const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
        return s === norm;
      }).map(m => m.id);

      await markMessagesAsReadForUser([message.id, message.subject, ...matchingIds], game.user);
    }
    
    app.render();
  });
  html.find('.profile-edit-faction-xp').click(app._onProfileEditFactionXP.bind(app));

  // Inject Faction Progress Bars in Profile
  if (app.profileActorId && context.profile) {
      const profileFactions = context.profile.factions;
      const miniCards = html.find('.mini-card');
      
      miniCards.each((i, el) => {
          const card = $(el);
          const title = card.find('.mini-title').text().trim();
          const factionData = (profileFactions || []).find(f => f.name === title);
          
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
  if (app.profileActorId && context.profile) {
    const content = html.find('.intoterica-content');
    
    const generateQuestHtml = (quests, statusClass) => {
      if (!quests || quests.length === 0) return '<div class="empty-text">None recorded</div>';
      return quests.map(q => {
        const tasks = Array.isArray(q.tasks) ? q.tasks : [];
        const completedTasks = tasks.filter(t => t.completed && !t.failed).length;
        const totalTasks = tasks.length;
        const diffInfo = getDifficultyInfo(q.difficulty);
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
            ${hasPermission('permQuests') ? `
              <i class="fas fa-trash remove-profile-quest" title="Remove from Report" data-quest-id="${q.id}" data-is-manual="${q.isManual || false}" style="color: #c92a2a; cursor: pointer; padding: 4px; margin-left: auto; flex-shrink: 0;"></i>
            ` : ''}
          </div>
        `;
      }).join('');
    };

    const reportHtml = `
      <div class="section-header" style="margin-top: 2rem;">
          <div class="section-title">Mission Report</div>
          ${hasPermission('permQuests') ? `<button type="button" class="add-legacy-quest" style="font-size: 12px;"><i class="fas fa-plus"></i> Add Entry</button>` : ''}
      </div>
      <div class="content-grid two-column" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="report-column">
           <h3 class="quest-section-header completed">Completed</h3>
           ${generateQuestHtml(context.profile.completedQuests, 'completed')}
        </div>
        <div class="report-column">
           <h3 class="quest-section-header failed">Failed</h3>
           ${generateQuestHtml(context.profile.failedQuests, 'failed')}
        </div>
      </div>
    `;
    
    content.append(reportHtml);
    content.find('.profile-quest-link').click(app._onProfileQuestClick.bind(app));

    if (hasPermission('permQuests')) {
        content.find('.remove-profile-quest').click(app._onRemoveProfileQuest.bind(app));
        content.find('.add-legacy-quest').click(app._onAddLegacyQuest.bind(app));
    }
  }
}

