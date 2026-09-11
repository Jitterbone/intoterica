import { hasPermission } from '../../core/permissions.js';
import { createDialog, formatMarkdown } from '../../core/dialog.js';
import { getPlayerActors, getSystemCurrencies, addCurrencyToActor, grantItemsToActor } from './quest-helpers.js';

export const questActions = {
  _onFilterQuests(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questFilter = event.currentTarget.dataset.filter || 'active';
    this.render();
  },

  _onSearchQuests(event) {
    this.questSearch = event.currentTarget.value || '';
    this._preserveSearchFocus = true;
    clearTimeout(this._questSearchTimer);
    this._questSearchTimer = setTimeout(() => {
      this.render();
    }, 120);
  },

  _onClearQuestSearch(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questSearch = '';
    this._preserveSearchFocus = false;
    this.render();
  },

  _onToggleQuestFilterToolbar(event) {
    event.preventDefault();
    event.stopPropagation();
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.render();
  },

  _onChangeQuestFactionFilter(event) {
    event.preventDefault();
    this.questFactionFilter = event.currentTarget.value || '';
    this.render();
  },

  _onChangeQuestGiverFilter(event) {
    event.preventDefault();
    this.questGiverFilter = event.currentTarget.value || '';
    this.render();
  },

  _onChangeQuestDifficultyFilter(event) {
    event.preventDefault();
    this.questDifficultyFilter = event.currentTarget.value || '';
    this.render();
  },

  _onChangeQuestSort(event) {
    event.preventDefault();
    this.questSort = event.currentTarget.value || 'default';
    this.render();
  },

  _onResetQuestFilters(event) {
    event.preventDefault();
    event.stopPropagation();
    this.questFactionFilter = '';
    this.questGiverFilter = '';
    this.questDifficultyFilter = '';
    this.questSort = 'default';
    this.questSearch = '';
    this.render();
  },

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
  },

  async _onToggleQuestPin(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
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
  },

  async _onToggleQuestVisibility(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) return;
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
  },

  async _onToggleQuestTaskVisibility(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) return;
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
  },

  async _onToggleQuestTaskSubstory(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) return;
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
  },

  async _onToggleQuestTask(event) {
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
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
  },

  async _onToggleQuestTaskFail(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
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
  },

  async _onActivateQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) return;
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
  },

  async _onCompleteQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can complete quests.");
      return;
    }
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    await this._showRewardDistributionDialog(quest);
  },

  async _showRewardDistributionDialog(quest) {
    const settings = game.settings.get('intoterica', 'data');
    const rewards = quest.rewards || {};
    const playerActors = getPlayerActors();

    // Determine target recipients
    const isAssignAll = quest.assignedAll !== false && (!quest.assignedTo || quest.assignedTo.length === 0);
    const assignedIds = Array.isArray(quest.assignedTo) ? quest.assignedTo : [];
    const recipientActors = isAssignAll 
      ? playerActors 
      : playerActors.filter(a => assignedIds.includes(a.id));

    // Currencies list
    const systemCurrencies = getSystemCurrencies();
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

    createDialog({
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
                await addCurrencyToActor(actor, currencies, divisor);
              }
            }

            // 2. Grant Items (per-item recipient assignment)
            if (items.length > 0) {
              for (let idx = 0; idx < items.length; idx++) {
                const itemRecipientIds = html.find(`select[name="item_recipients_${idx}"]`).val() || [];
                const itemActors = playerActors.filter(a => itemRecipientIds.includes(a.id));
                if (itemActors.length > 0) {
                  for (const actor of itemActors) {
                    await grantItemsToActor(actor, [items[idx]]);
                  }
                }
              }
            }

            // 3. Apply Faction XP & Reputation
            if (doApplyFaction) {
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

            // 4. Mark Quest as Completed
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
  },

  async _onFailQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
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
    const failedIds = isAssignAll ? getPlayerActors().map(a => a.id) : (Array.isArray(quest.assignedTo) ? quest.assignedTo : []);
    quest.failedBy = failedIds;
    quest.assignedTo = failedIds;
    quest.assignedAll = false;
    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    this._sendQuestChatNotification(quest, 'failed');
    ui.notifications.warn(`Quest "${quest.title}" marked as Failed.`);
  },

  async _onReopenQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM && !hasPermission('permQuests')) {
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
  },

  async _onShareQuestChat(event) {
    event.preventDefault();
    event.stopPropagation();
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    this._sendQuestChatNotification(quest, 'share');
  },

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

    const descHtml = formatMarkdown(quest.description || "");

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
};

export function bindQuestEvents(html, app, _context) {
  // Support both (html, app, _context) and (app, html, _context)
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (app.currentView !== 'quests') return;
  const canEditQuests = game.user.isGM || hasPermission('permQuests');
  
  html.find('.quest-filter-btn').click(app._onFilterQuests.bind(app));
  html.find('.quest-header-clickable').click(app._onToggleExpandQuest.bind(app));
  html.find('.quest-pin-btn').click(app._onToggleQuestPin.bind(app));
  html.find('.quest-visibility-btn').click(app._onToggleQuestVisibility.bind(app));
  html.find('.quest-task-checkbox').change(app._onToggleQuestTask.bind(app));
  html.find('.quest-task-fail-toggle').click(app._onToggleQuestTaskFail.bind(app));
  html.find('.quest-task-visibility-toggle').click(app._onToggleQuestTaskVisibility.bind(app));
  html.find('.quest-task-substory-toggle').click(app._onToggleQuestTaskSubstory.bind(app));

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

      await app._saveData(settings);
      app._broadcastUpdate();
      app.render();
    });
  }

  html.find('.share-quest-chat').click(app._onShareQuestChat.bind(app));
  html.find('.quest-search-input').on('input', app._onSearchQuests.bind(app));
  html.find('.clear-quest-search').click(app._onClearQuestSearch.bind(app));
  html.find('.quest-filter-toggle-btn').click(app._onToggleQuestFilterToolbar.bind(app));
  html.find('.quest-filter-faction').change(app._onChangeQuestFactionFilter.bind(app));
  html.find('.quest-filter-giver').change(app._onChangeQuestGiverFilter.bind(app));
  html.find('.quest-filter-difficulty').change(app._onChangeQuestDifficultyFilter.bind(app));
  html.find('.quest-filter-sort').change(app._onChangeQuestSort.bind(app));
  html.find('.reset-quest-filters').click(app._onResetQuestFilters.bind(app));

  if (app._preserveSearchFocus) {
    const searchInput = html.find('.quest-search-input');
    if (searchInput.length) {
      searchInput.focus();
      const val = searchInput.val() || '';
      if (searchInput[0]?.setSelectionRange) {
        searchInput[0].setSelectionRange(val.length, val.length);
      }
    }
    app._preserveSearchFocus = false;
  }

  if (canEditQuests) {
    html.find('.add-quest').click(app._onAddQuest.bind(app));
    html.find('.activate-quest-btn').click(app._onActivateQuest.bind(app));
    html.find('.complete-quest').click(app._onCompleteQuest.bind(app));
    html.find('.fail-quest').click(app._onFailQuest.bind(app));
    html.find('.reopen-quest').click(app._onReopenQuest.bind(app));
    html.find('.edit-quest').click(app._onEditQuest.bind(app));
  }
}

