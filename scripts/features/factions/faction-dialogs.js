/**
 * Intoterica Faction Dialogs
 * Dialog handlers for creating, editing, and deleting factions and faction members
 */

import { hasPermission } from "../../core/permissions.js";
import { createDialog, getFormData, createRichTextEditorHtml, initRichTextEditor, syncRichEditors } from "../../core/dialog.js";

export const factionDialogs = {
  async _onAddFaction(event) {
    event.preventDefault();
    if (!game.user.isGM && !hasPermission('permFactions')) {
      ui.notifications.warn("Only Game Masters can create factions.");
      return;
    }
    
    const descEditorHtml = createRichTextEditorHtml('description', '', 'Faction history, goals, allies, and enemies...');

    createDialog({
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
            const { data: formData } = getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            syncRichEditors(html);

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
        initRichTextEditor(html);

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
  },

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
  },

  async _onEditFaction(event) {
    event.preventDefault();
    if (!game.user.isGM && !hasPermission('permFactions')) {
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

    const descEditorHtml = createRichTextEditorHtml('description', faction.description || '', 'Faction history, goals, allies, and enemies...');

    createDialog({
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
            const { data: formData } = getFormData(html);
            
            // Sync rich text editors (exits source mode, ensures textarea is current)
            syncRichEditors(html);

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
        initRichTextEditor(html);

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
  },

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
  },

  async _deleteFaction(factionId) {
      const settings = game.settings.get('intoterica', 'data');
      settings.factions = settings.factions.filter(f => f.id !== factionId);
      await this._saveData(settings);
      this.selectedFaction = null;
      this._broadcastUpdate();
      this.render();
  },

  async _onAddMember(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const actors = game.actors.map(a => ({id: a.id, name: a.name})).sort((a, b) => a.name.localeCompare(b.name));
    
    createDialog({
      title: "Add Faction Member",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-user-plus"></i> Member Details</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Select Character</label>
                <select name="actorId">
                  ${actors.map(a => `<option value="${a.id}">${Handlebars.escapeExpression(a.name)}</option>`).join('')}
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
            const { data: formData } = getFormData(html);
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
  },

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
};

