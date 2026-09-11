/**
 * Intoterica Badge Actions
 * Data preparation and management for Merit Badges
 */

import { hasPermission } from "../../core/permissions.js";
import { createDialog, getFormData } from "../../core/dialog.js";

/**
 * Prepares merit badges list for template context.
 * @param {Object} settings 
 * @returns {Array<Object>}
 */
export function prepareBadgesContext(settings) {
  return (settings.meritBadges || []).map(b => ({
    ...b,
    isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
  }));
}

export const badgeActions = {
  async _onAddBadge(event) {
    event.preventDefault();
    
    createDialog({
      title: "Create Merit Badge",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Badge Details</div>
            <div class="form-grid-name-icon">
              <div class="form-group">
                <label>Badge Name</label>
                <input type="text" name="name" placeholder="Enter badge name" autofocus required />
              </div>
              <div class="form-group">
                <label>Icon / Emoji</label>
                <div class="file-picker-group">
                  <input type="text" name="icon" value="⭐" />
                  <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Description & Criteria</label>
              <textarea name="description" placeholder="Describe the achievement or criteria required to earn this badge..." rows="3"></textarea>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: async (html) => {
            const { data: formData } = getFormData(html);
            await this._createBadge(formData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                callback: (path) => input.val(path)
            }).render(true);
        });
      },
      default: "create"
    }, { width: 480 }).render(true);
  },

  async _createBadge(data) {
    const settings = game.settings.get('intoterica', 'data');
    const newBadge = {
      id: foundry.utils.randomID(),
      name: data.name,
      description: data.description,
      icon: data.icon || "⭐",
      earnedBy: []
    };
    
    settings.meritBadges.push(newBadge);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Badge "${data.name}" created`);
  },

  async _onManageBadge(event) {
    event.preventDefault();
    const badgeId = event.currentTarget.dataset.badgeId;
    const settings = game.settings.get('intoterica', 'data');
    const badge = settings.meritBadges.find(b => b.id === badgeId);
    if (!badge) return;

    if (!badge.earnedBy) badge.earnedBy = [];
    const previousEarned = [...badge.earnedBy];

    const players = game.users.filter(u => !u.isGM && u.character).map(u => {
      return { id: u.character.id, name: u.character.name, hasBadge: badge.earnedBy.includes(u.character.id) };
    });

    const playerCheckboxes = players.length > 0 ? players.map(p => `
      <div class="form-toggle-card">
        <input type="checkbox" name="${p.id}" id="badge-p-${p.id}" ${p.hasBadge ? 'checked' : ''} />
        <label for="badge-p-${p.id}">${Handlebars.escapeExpression(p.name)}</label>
      </div>
    `).join('') : '<div style="color: var(--theme-dim); font-style: italic; font-size: 12px; padding: 6px;">No player characters found.</div>';

    createDialog({
      title: `Award Badge: ${badge.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-award"></i> Select Recipients</div>
            <p style="font-size: 12px; color: var(--theme-dim); margin: 0 0 8px 0;">Select characters to award <strong>${Handlebars.escapeExpression(badge.name)}</strong>:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 250px; overflow-y: auto;">
              ${playerCheckboxes}
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const { data: formData } = getFormData(html);
            const newEarnedBy = Object.keys(formData).filter(k => formData[k]);
            const newlyAwarded = newEarnedBy.filter(id => !previousEarned.includes(id));
            
            badge.earnedBy = newEarnedBy;
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
            
            if (newlyAwarded.length > 0) {
                this._sendBadgeNotifications(badge, newlyAwarded);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { width: 480 }).render(true);
  },

  _sendBadgeNotifications(badge, actorIds) {
      if (!game.settings.get('intoterica', 'notifyBadges')) return;

      const isImage = badge.icon && (badge.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(badge.icon));
      
      actorIds.forEach(actorId => {
          const actor = game.actors.get(actorId);
          if (actor) {
              ChatMessage.create({
                  content: `
                    <div class="intoterica-chat-card">
                      <h3>Merit Badge Awarded!</h3>
                      <div class="card-content">
                        <div style="font-size: 14px; margin-bottom: 5px;">Awarded to <strong>${actor.name}</strong></div>
                        ${isImage ? `<img src="${badge.icon}" style="display: block; margin: 10px auto; width: 64px; height: 64px; border: none; object-fit: contain;">` : `<div style="font-size: 48px; margin: 10px 0;">${badge.icon}</div>`}
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${badge.name}</div>
                        <div style="font-style: italic; opacity: 0.8; font-size: 12px;">${badge.description}</div>
                      </div>
                    </div>
                  `
              });
          }
      });
  },

  async _onEditBadge(event) {
    event.preventDefault();
    const badgeId = event.currentTarget.dataset.badgeId;
    const settings = game.settings.get('intoterica', 'data');
    const badge = settings.meritBadges.find(b => b.id === badgeId);
    if (!badge) return;

    createDialog({
      title: `Edit Badge: ${badge.name}`,
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-medal"></i> Badge Details</div>
            <div class="form-grid-name-icon">
              <div class="form-group">
                <label>Badge Name</label>
                <input type="text" name="name" value="${Handlebars.escapeExpression(badge.name || '')}" placeholder="Badge name" autofocus required />
              </div>
              <div class="form-group">
                <label>Icon / Emoji</label>
                <div class="file-picker-group">
                  <input type="text" name="icon" value="${badge.icon || '⭐'}" />
                  <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Description & Criteria</label>
              <textarea name="description" placeholder="Achievement description..." rows="3">${Handlebars.escapeExpression(badge.description || '')}</textarea>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const { data: formData } = getFormData(html);
            
            badge.name = formData.name;
            badge.description = formData.description;
            badge.icon = formData.icon;

            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        delete: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Delete",
            callback: async () => {
                settings.meritBadges = settings.meritBadges.filter(b => b.id !== badgeId);
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
      render: (html) => {
        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                callback: (path) => input.val(path)
            }).render(true);
        });
      },
      default: "save"
    }, { width: 480 }).render(true);
  }
};

/**
 * Binds badge-related DOM events.
 * @param {JQuery} html 
 * @param {Object} app 
 */
export function bindBadgeEvents(html, app) {
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (hasPermission('permBadges')) {
    html.find('.add-badge').click(app._onAddBadge.bind(app));
    html.find('.manage-badge').click(app._onManageBadge.bind(app));
    html.find('.edit-badge').click(app._onEditBadge.bind(app));
  }
}

