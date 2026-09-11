/**
 * Intoterica Faction Actions
 * Event handlers and detail rendering for factions
 */

import { hasPermission } from "../../core/permissions.js";
import { createDialog, getFormData } from "../../core/dialog.js";
import { getRepStatus, calculateFactionRep } from "./faction-helpers.js";

export const factionActions = {
  _getRepStatus(rep) {
    return getRepStatus(rep);
  },

  _calculateFactionRep(faction) {
    return calculateFactionRep(faction);
  },

  _renderFactionDetail(html, faction) {
      const container = html.find('.faction-detail');
      if (!container.length) return;
      
      // Clear existing content (from HBS) to replace with new UX
      container.empty();

      const isGM = hasPermission('permFactions');
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
          const partyWeight = Math.max(0, totalPCs - (faction.playerMembers || []).length);
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
                ${(faction.playerMembers || []).length ? (faction.playerMembers || []).map(m => {
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
                                <td><input type="text" class="rank-input" data-idx="${i}" data-field="name" value="${Handlebars.escapeExpression(r.name || '')}"></td>
                                <td><input type="number" class="rank-input" data-idx="${i}" data-field="xp" value="${r.xp}"></td>
                                <td><input type="number" class="rank-input" data-idx="${i}" data-field="modifier" value="${r.modifier}" step="0.1"></td>
                                <td><input type="text" class="rank-input" data-idx="${i}" data-field="description" value="${Handlebars.escapeExpression(r.description || '')}" placeholder="Description..."></td>
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
                                <span class="rank-display-name">${Handlebars.escapeExpression(r.name || '')}</span>
                                <span class="rank-display-stats">XP: ${r.xp} | Mod: x${r.modifier}</span>
                            </div>
                            <div class="rank-display-desc">${Handlebars.escapeExpression(r.description || "No description provided.")}</div>
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
  },

  _onSelectFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    this.selectedFaction = (settings.factions || []).find(f => f.id === factionId);
    this.activeFactionTab = 'overview'; // Reset tab on selection
    this.isEditingRanks = false;
    this.render();
  },

  _onCloseFactionDetail(event) {
    event.preventDefault();
    this.selectedFaction = null;
    this.isEditingRanks = false;
    this.render();
  },

  _onToggleRankEdit(event) {
    event.preventDefault();
    this.isEditingRanks = !this.isEditingRanks;
    this.render();
  },

  _onToggleMemberEdit(event) {
    event.preventDefault();
    this.isEditingMembers = !this.isEditingMembers;
    this.render();
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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

    const d = createDialog({
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
            const { data: formData } = getFormData(html);
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
  },

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
  },

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

    createDialog({
      title: `Adjust Rank: ${faction.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Member Rank</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Select Player</label>
                <select name="memberId">
                  ${playerMembers.map(m => `<option value="${m.id}">${Handlebars.escapeExpression(m.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>New Rank</label>
                <select name="rankIdx">
                  ${(faction.ranks || []).map((r, i) => `<option value="${i}">${Handlebars.escapeExpression(r.name)}</option>`).join('')}
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
            const { data: formData } = getFormData(html);
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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  async _onEnlistFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const actor = game.user.character;
    
    if (!hasPermission('permFactions')) {
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
  },

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
  },

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
};

/**
 * Binds faction-related DOM events.
 * @param {JQuery} html - jQuery DOM root
 * @param {Object} app - IntotericaApp instance
 * @param {Object} context - Render context
 */
export function bindFactionEvents(html, app, context) {
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (app._onSelectFaction) {
    html.find('.faction-card').click(app._onSelectFaction.bind(app));
  }

  // Inject Custom Faction Detail View
  const factionLayout = html.find('.faction-layout');
  if (app.selectedFaction) {
      factionLayout.addClass('details-open');
      app._renderFactionDetail(html, app.selectedFaction);
  } else {
      factionLayout.removeClass('details-open');
  }

  // Inject Descriptions for Faction Cards (List View)
  if (app.currentView === 'factions') {
      const factionCards = html.find('.faction-card');
      factionCards.each((i, el) => {
          const card = $(el);
          const factionId = card.data('factionId');
          const faction = (context.factions || []).find(f => f.id === factionId);
          if (faction && faction.description && !card.find('.faction-card-description').length) {
               const descText = faction.description.length > 500 ? faction.description.substring(0, 500) + '...' : faction.description;
               card.append(`<div class="faction-card-description">${descText}</div>`);
          }
      });
  }

  if (hasPermission('permFactions')) {
    html.find('.adjust-reputation').click(app._onAdjustReputation.bind(app));
    html.find('.add-faction').click(app._onAddFaction.bind(app));
    html.find('.add-member').click(app._onAddMember.bind(app));
    html.find('.award-xp').click(app._onAwardXP.bind(app));
    html.find('.toggle-auto-rep').change(app._onToggleAutoRep.bind(app));
    html.find('.member-rep-slider').change(app._onMemberRepChange.bind(app));
    html.find('.faction-rep-slider').change(app._onFactionRepSliderChange.bind(app));
    html.find('.edit-faction').click(app._onEditFaction.bind(app));
    html.find('.enlist-faction').click(app._onEnlistFaction.bind(app));
    html.find('.remove-member').click(app._onRemoveMember.bind(app));
  }
}

