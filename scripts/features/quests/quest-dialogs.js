import { hasPermission } from '../../core/permissions.js';
import { createDialog, getFormData, createRichTextEditorHtml, initRichTextEditor, syncRichEditors } from '../../core/dialog.js';
import { getPlayerActors, getSystemCurrencies, getDifficultyOptions, getQuestGiverOptions } from './quest-helpers.js';

export const questDialogs = {
  async _onAddQuest(event) {
    event.preventDefault();
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can create quests.");
      return;
    }

    const settings = game.settings.get('intoterica', 'data');
    const playerActors = getPlayerActors();
    const factions = settings.factions || [];
    const systemCurrencies = getSystemCurrencies();

    const currencyInputsHtml = Object.entries(systemCurrencies).map(([key, label]) => `
      <div class="quest-currency-card" title="${Handlebars.escapeExpression(label)}">
        <div class="currency-card-header">
          <i class="fas fa-coins" style="color: #d4af37; font-size: 10px;"></i>
          <span class="currency-tag">${Handlebars.escapeExpression((label || key).toUpperCase())}</span>
        </div>
        <input type="number" class="currency-val-input" data-denom="${Handlebars.escapeExpression(key)}" placeholder="0" min="0" />
      </div>
    `).join('');

    const descEditorHtml = createRichTextEditorHtml('description', '', 'Provide quest narrative, background lore, clues, and objectives...');
    
    createDialog({
      title: "Create Quest",
      content: `
        <form class="intoterica-form" style="max-height: 640px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="details">
              <i class="fas fa-scroll"></i> Quest Details
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="rewards">
              <i class="fas fa-trophy"></i> Rewards
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="gm">
              <i class="fas fa-user-shield"></i> GM Secret Notes & Pin
            </button>
          </div>

          <!-- TAB 1: Quest Details -->
          <div class="dialog-tab-content active" data-tab="details" style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Top Integrated Header: Art Banner + Title & Metadata -->
            <div style="display: flex; gap: 14px; align-items: stretch; background: var(--dialog-card-bg, rgba(255, 255, 255, 0.5)); border: 1px solid var(--dialog-section-border, rgba(120, 46, 34, 0.25)); border-radius: 6px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
              
              <!-- Left: Clickable Portrait Banner -->
              <div class="quest-art-banner" title="Click to choose splash image">
                <img class="quest-preview-img" src="icons/svg/item-bag.svg" style="opacity: 0.35;" />
                <div class="quest-art-overlay"><i class="fas fa-camera"></i> Change Art</div>
                <input type="hidden" name="image" value="" class="quest-img-input" />
              </div>

              <!-- Right: Title + Metadata Strip -->
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; gap: 6px;">
                <div>
                  <input type="text" name="title" placeholder="Quest Title (e.g. Investigate the Sunken Crypt)..." class="quest-title-large" autofocus required />
                </div>
                
                <div class="quest-meta-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-signal"></i> Difficulty</label>
                    <select name="difficulty" class="quest-dialog-select">
                      ${getDifficultyOptions("Medium")}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-hourglass-half"></i> Status</label>
                    <select name="status" class="quest-dialog-select">
                      <option value="Active" selected>Active</option>
                      <option value="Available">Available</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                      <option value="Hidden">Hidden</option>
                    </select>
                  </div>
                </div>

                <!-- Commissioned By & Giver Section -->
                <div class="quest-commission-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-shield-alt"></i> Commissioned by (Faction)</label>
                    <select name="commissionedFaction" class="quest-dialog-select">
                      <option value="">— Independent / None —</option>
                      ${factions.map(f => `<option value="${f.name}">${f.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-user-circle"></i> Quest Giver / Issuer</label>
                    <select class="quest-giver-select quest-dialog-select" title="Choose from World Folders, NPCs, Factions...">
                      ${getQuestGiverOptions("")}
                    </select>
                    <input type="text" name="giver" class="quest-giver-custom-input" style="display: none; margin-top: 4px;" placeholder="Type custom giver name..." />
                  </div>
                </div>

              </div>

            </div>

            <!-- Player Assignment Section -->
            <div class="quest-assignment-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--dialog-section-title, #782e22); display: flex; align-items: center; gap: 5px;">
                  <i class="fas fa-users"></i> Assigned Players / Characters
                </div>
                <label class="assign-all-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #ff6400); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin: 0; user-select: none;">
                  <input type="checkbox" name="assignAll" class="assign-all-checkbox" checked style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                  <span>Assign to All Players (Whole Party)</span>
                </label>
              </div>
              ${playerActors.length ? `
                <div class="quest-player-assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px;">
                  ${playerActors.map(p => {
                    const avatar = p.img || p.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
                    return `
                      <label class="player-assign-card assigned" data-actor-id="${p.id}">
                        <input type="checkbox" name="assign_${p.id}" class="player-assign-cb" value="${p.id}" checked style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                        <img src="${avatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;" />
                        <span style="font-size: 11px; font-weight: 600; color: var(--dialog-input-text, #191813); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${p.name}">${p.name}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `<p style="font-size: 11px; font-style: italic; color: var(--theme-dim); margin: 0;">No player characters detected on the app.</p>`}
            </div>

            <!-- Bottom 2-Column Ledger: Description (Left) + Objectives & Tasks (Right) -->
            <div class="quest-editor-body" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 12px; align-items: stretch;">
              
              <!-- Left Column: Quest Description with Journal-Style Rich Text Editor -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title">
                  <span><i class="fas fa-feather-alt"></i> Quest Description</span>
                </div>
                ${descEditorHtml}
              </div>

              <!-- Right Column: Objectives & Tasks Builder -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title"><i class="fas fa-tasks"></i> Objectives & Tasks</div>
                <div class="quest-tasks-builder" style="flex: 1; max-height: 280px; overflow-y: auto; padding-right: 2px;">
                  <div class="quest-task-entry" draggable="true">
                    <input type="hidden" class="task-input-id" value="${foundry.utils.randomID()}" />
                    <div class="quest-task-main-row">
                      <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                      <input type="checkbox" class="task-input-completed" title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer;" />
                      <i class="fas fa-folder task-substory-static-icon" style="color: #1971c2; font-size: 14px; flex-shrink: 0; display: none;" title="Substory Header"></i>
                      <input type="text" class="task-input-text" placeholder="Objective description..." style="flex: 1; min-width: 0;" />
                      <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                    <div class="quest-task-badges-row">
                      <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="display: none;">
                        <i class="fas fa-plus"></i> Objective
                      </button>
                      <div class="quest-task-substory-badge" title="Toggle Substory (Header / Folder)">
                        <input type="checkbox" class="task-input-substory" style="display: none;" />
                        <i class="fas fa-folder"></i> Substory
                      </div>
                      <div class="quest-task-hide-badge" title="Toggle Hidden from Players">
                        <input type="checkbox" class="task-input-hidden" style="display: none;" />
                        <i class="fas fa-eye-slash"></i> Hidden
                      </div>
                      <div class="quest-task-opt-badge" title="Toggle Optional">
                        <input type="checkbox" class="task-input-optional" style="display: none;" />
                        <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                      </div>
                      <div class="quest-task-fail-badge" title="Toggle Failed State">
                        <input type="checkbox" class="task-input-failed" style="display: none;" />
                        <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                      </div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                  <button type="button" class="add-task-row" style="flex: 1;"><i class="fas fa-plus"></i> Add Objective</button>
                  <button type="button" class="add-substory-row" style="flex: 1; background: rgba(25, 113, 194, 0.15); border: 1px solid rgba(25, 113, 194, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px; font-weight: 600;"><i class="fas fa-folder-plus"></i> Add Substory</button>
                </div>
              </div>

            </div>

          </div>

          <!-- TAB 2: Automated Rewards -->
          <div class="dialog-tab-content" data-tab="rewards" style="display: none; flex-direction: column; gap: 12px;">
            <div class="quest-panel" style="padding: 12px;">
              <div class="quest-panel-title" style="margin-bottom: 12px; font-size: 13px;">
                <i class="fas fa-trophy" style="color: #f59f00;"></i> Automated Quest Rewards
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">

                <!-- 1. Multi-Faction XP -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-star" style="color: #f59f00;"></i> Faction XP</span>
                    <button type="button" class="add-faction-xp-row" style="font-size: 11px; padding: 3px 8px; background: rgba(245, 159, 0, 0.15); border: 1px solid rgba(245, 159, 0, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer;"><i class="fas fa-plus"></i> Add Faction XP</button>
                  </div>
                  <div class="faction-xp-container" style="display: flex; flex-direction: column; gap: 6px;">
                    <!-- Faction XP rows injected here -->
                  </div>
                </div>

                <!-- 2. Multi-Faction Reputation -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="affect-rep-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #782e22); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0; user-select: none;">
                      <input type="checkbox" name="affectRep" class="affect-rep-checkbox" style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                      <span><i class="fas fa-shield-alt"></i> Affect Reputation?</span>
                    </label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="rep-target-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.08); color: var(--theme-dim);">Whole Party</span>
                      <button type="button" class="add-rep-row" style="display: none; font-size: 11px; padding: 3px 8px; background: rgba(43, 138, 62, 0.15); border: 1px solid rgba(43, 138, 62, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; align-items: center; gap: 4px;">
                        <i class="fas fa-plus"></i> Add Faction
                      </button>
                    </div>
                  </div>
                  <div class="rep-container" style="display: none; flex-direction: column; gap: 6px; margin-top: 6px;">
                    <!-- Reputation rows injected here -->
                  </div>
                </div>

                <!-- 3. System Currencies -->
                <div class="reward-section-box">
                  <div class="reward-section-subtitle" style="margin-bottom: 6px;"><i class="fas fa-coins" style="color: #d4af37;"></i> Currency</div>
                  <div class="quest-currency-grid">
                    ${currencyInputsHtml}
                  </div>
                </div>

                <!-- 4. Compendium / Directory Item Drag & Drop -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-box-open" style="color: #4facfe;"></i> Items & Equipment</span>
                    <span style="font-size: 10px; color: var(--theme-dim); font-style: italic;">Drop items from Directory/Compendiums</span>
                  </div>
                  <div class="quest-item-dropzone" style="min-height: 56px; border: 1px dashed var(--dialog-section-border, rgba(120, 46, 34, 0.4)); border-radius: 4px; background: rgba(0,0,0,0.03); padding: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-start;">
                    <div class="dropzone-placeholder" style="width: 100%; text-align: center; font-size: 11px; color: var(--theme-dim); padding: 10px 0;">
                      <i class="fas fa-hand-holding"></i> Drag & Drop Items Here
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- TAB 3: GM Controls -->
          <div class="dialog-tab-content" data-tab="gm" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-user-shield"></i> GM Secret Notes</div>
              <div class="form-group">
                <label>GM Notes (Hidden from Players)</label>
                <textarea name="gmNotes" placeholder="Secret clues, encounter triggers, NPC motivations, hidden DCs..." rows="5"></textarea>
              </div>

              <div class="form-toggle-card" style="margin-top: 8px; border-color: rgba(245, 159, 0, 0.4); background: rgba(245, 159, 0, 0.08);">
                <input type="checkbox" name="isPrimary" id="q-is-primary" />
                <label for="q-is-primary" style="font-weight: 700; color: #f59f00;"><i class="fas fa-star"></i> Set as Primary Objective (Pinned at Top of Tracker)</label>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create Quest",
          callback: async (html) => {
            const { form, data: formData } = getFormData(html);
            syncRichEditors(html);

            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";

            const taskRows = html.find('.quest-task-entry');
            const tasks = [];
            taskRows.each((i, row) => {
              const $row = $(row);
              const text = $row.find('.task-input-text').val().trim();
              const isSubstory = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
              const optional = $row.find('.task-input-optional').is(':checked');
              const failed = $row.find('.task-input-failed').is(':checked');
              const hidden = $row.find('.task-input-hidden').is(':checked');
              if (text) {
                tasks.push({
                  id: foundry.utils.randomID(),
                  text,
                  completed: false,
                  failed,
                  optional,
                  hidden,
                  isSubstory,
                  isSubquest: isSubstory
                });
              }
            });

            const assignAll = html.find('.assign-all-checkbox').is(':checked');
            const assignedTo = assignAll ? [] : html.find('.player-assign-cb:checked').map((i, el) => el.value).get();

            let giverValue = "";
            const giverSelectVal = html.find('.quest-giver-select').val();
            if (giverSelectVal && giverSelectVal !== '__custom__') {
              giverValue = giverSelectVal;
            } else if (html.find('.quest-giver-custom-input').val()) {
              giverValue = html.find('.quest-giver-custom-input').val().trim();
            }

            const factionXp = [];
            let totalFactionXp = 0;
            html.find('.faction-xp-row').each((i, el) => {
              const $r = $(el);
              const fId = $r.find('.faction-xp-select').val();
              const amount = parseInt($r.find('.faction-xp-amount').val()) || 0;
              const fObj = factions.find(f => f.id === fId);
              if (fId && amount > 0) {
                factionXp.push({ factionId: fId, factionName: fObj?.name || "", amount });
                totalFactionXp += amount;
              }
            });

            const affectRep = html.find('.affect-rep-checkbox').is(':checked');
            const reputations = [];
            if (affectRep) {
              html.find('.rep-row').each((i, el) => {
                const $r = $(el);
                const repFacId = $r.find('.rep-faction-select').val();
                const repDelta = parseInt($r.find('.rep-delta-input').val()) || 0;
                const fObj = factions.find(f => f.id === repFacId);
                if (repFacId && repDelta !== 0) {
                  reputations.push({
                    factionId: repFacId,
                    factionName: fObj?.name || "",
                    amount: repDelta
                  });
                }
              });
            }

            const currencies = {};
            const currencyParts = [];
            html.find('.currency-val-input').each((i, el) => {
              const denom = $(el).data('denom');
              const val = parseInt($(el).val()) || 0;
              if (denom && val > 0) {
                currencies[denom] = val;
                currencyParts.push(`${val} ${denom.toUpperCase()}`);
              }
            });

            const items = [];
            html.find('.reward-item-chip').each((i, el) => {
              const $c = $(el);
              items.push({
                id: $c.data('itemId') || foundry.utils.randomID(),
                uuid: $c.data('uuid') || "",
                name: $c.data('name') || "Item",
                img: $c.data('img') || "icons/svg/item-bag.svg",
                type: $c.data('type') || "loot",
                quantity: parseInt($c.find('.reward-item-qty').val()) || 1,
                itemData: $c.data('itemData') || null
              });
            });

            const titleFromDom = html.find('input[name="title"]').val() ?? form?.querySelector('input[name="title"]')?.value ?? formData.title;
            const cleanTitle = (typeof titleFromDom === 'string' && titleFromDom.trim().length > 0) ? titleFromDom.trim() : "Untitled Quest";

            const questData = {
              title: cleanTitle,
              name: cleanTitle,
              difficulty: formData.difficulty || "Medium",
              status: formData.status || "Active",
              giver: giverValue,
              commissionedFaction: formData.commissionedFaction || "",
              image: formData.image || "",
              description: descriptionHtml,
              tasks,
              rewards: {
                xp: totalFactionXp,
                factionXp,
                reputations,
                reputation: reputations[0] || null,
                currencies,
                currency: currencyParts.join(', '),
                items,
                text: ""
              },
              assignedAll: assignAll,
              assignedTo: assignedTo,
              gmNotes: formData.gmNotes || "",
              isPrimary: formData.isPrimary === true
            };

            await this._createQuest(questData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        initRichTextEditor(html);

        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        html.find('.quest-art-banner').click(function(ev) {
          ev.preventDefault();
          const $banner = $(this);
          const currentImg = $banner.find('.quest-img-input').val();
          new FilePicker({
            type: "image",
            current: currentImg || undefined,
            callback: (path) => {
              $banner.find('.quest-img-input').val(path);
              $banner.find('.quest-preview-img').attr('src', path).css('opacity', '1');
            }
          }).render(true);
        });

        const $assignAll = html.find('.assign-all-checkbox');
        const $playerCbs = html.find('.player-assign-cb');
        const $repTargetBadge = html.find('.rep-target-badge');

        $assignAll.change(function() {
          const isChecked = $(this).is(':checked');
          $playerCbs.prop('checked', isChecked);
          $playerCbs.each(function() {
            const $card = $(this).closest('.player-assign-card');
            $card.toggleClass('assigned', isChecked);
          });
          $repTargetBadge.text(isChecked ? 'Whole Party' : 'Assigned Characters');
        });

        $playerCbs.change(function() {
          const $card = $(this).closest('.player-assign-card');
          const isChecked = $(this).is(':checked');
          $card.toggleClass('assigned', isChecked);

          const total = $playerCbs.length;
          const checkedCount = $playerCbs.filter(':checked').length;
          const allChecked = total > 0 && checkedCount === total;
          $assignAll.prop('checked', allChecked);
          $repTargetBadge.text(allChecked ? 'Whole Party' : 'Assigned Characters');
        });

        const $giverSelect = html.find('.quest-giver-select');
        const $giverInput = html.find('.quest-giver-custom-input');

        $giverSelect.change(function() {
          const val = $(this).val();
          if (val === '__custom__') {
            $giverInput.show().val('').focus();
          } else {
            $giverInput.val(val).hide();
          }
        });

        const renderTaskRowHtml = ({ id = foundry.utils.randomID(), text = '', completed = false, failed = false, optional = false, hidden = false, isSubstory = false } = {}) => {
          return `
            <div class="quest-task-entry ${isSubstory ? 'is-substory-header' : ''}" draggable="true">
              <input type="hidden" class="task-input-id" value="${id}" />
              <div class="quest-task-main-row">
                <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                <input type="checkbox" class="task-input-completed" ${completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSubstory ? 'display: none;' : ''}" />
                <i class="fas fa-folder task-substory-static-icon" style="${isSubstory ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
                <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(text)}" placeholder="${isSubstory ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
                <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              <div class="quest-task-badges-row">
                <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSubstory ? '' : 'display: none;'}">
                  <i class="fas fa-plus"></i> Objective
                </button>
                <div class="quest-task-substory-badge ${isSubstory ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
                  <input type="checkbox" class="task-input-substory" ${isSubstory ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-folder"></i> Substory
                </div>
                <div class="quest-task-hide-badge ${hidden ? 'active' : ''}" title="Toggle Hidden from Players">
                  <input type="checkbox" class="task-input-hidden" ${hidden ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-eye-slash"></i> Hidden
                </div>
                <div class="quest-task-opt-badge ${optional ? 'active' : ''}" title="Toggle Optional" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-optional" ${optional ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                </div>
                <div class="quest-task-fail-badge ${failed ? 'active' : ''}" title="Toggle Failed State" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-failed" ${failed ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                </div>
              </div>
            </div>
          `;
        };

        const updateTaskHierarchy = () => {
          let inSubstory = false;
          html.find('.quest-task-entry').each(function() {
            const $row = $(this);
            const isSub = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
            if (isSub) {
              inSubstory = true;
              $row.addClass('is-substory-header').removeClass('is-substory-child');
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').hide();
              $row.find('.task-substory-static-icon, .add-child-task-btn').show();
              $row.find('.task-input-text').attr('placeholder', 'Substory title / folder...');
            } else {
              $row.removeClass('is-substory-header');
              if (inSubstory) {
                $row.addClass('is-substory-child');
              } else {
                $row.removeClass('is-substory-child');
              }
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').show();
              $row.find('.task-substory-static-icon, .add-child-task-btn').hide();
              $row.find('.task-input-text').attr('placeholder', 'Objective description...');
            }
          });
        };

        updateTaskHierarchy();

        html.on('click', '.quest-task-substory-badge, .quest-task-subquest-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-substory, .task-input-subquest');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          updateTaskHierarchy();
        });

        html.on('click', '.quest-task-hide-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-hidden');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        html.on('click', '.quest-task-opt-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-optional');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        html.on('click', '.quest-task-fail-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-failed');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        html.find('.add-task-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.find('.add-substory-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: true }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.on('click', '.add-child-task-btn', function(ev) {
          ev.preventDefault();
          const $header = $(this).closest('.quest-task-entry');
          let $insertTarget = $header;
          let $next = $header.next('.quest-task-entry');
          while ($next.length && !$next.find('.task-input-substory').is(':checked') && !$next.find('.task-input-subquest').is(':checked')) {
            $insertTarget = $next;
            $next = $next.next('.quest-task-entry');
          }
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          $insertTarget.after(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.on('click', '.delete-task-row', function(ev) {
          ev.preventDefault();
          $(this).closest('.quest-task-entry').remove();
          updateTaskHierarchy();
        });

        let draggedTaskEl = null;
        html.find('.quest-tasks-builder').on('dragstart', '.quest-task-entry', function(ev) {
          if ($(ev.target).is('input, button, select, textarea')) {
            ev.preventDefault();
            return;
          }
          draggedTaskEl = this;
          ev.originalEvent.dataTransfer.effectAllowed = 'move';
          ev.originalEvent.dataTransfer.setData('text/plain', 'reorder-task');
          $(this).addClass('dragging');
        });

        html.find('.quest-tasks-builder').on('dragend', '.quest-task-entry', function() {
          draggedTaskEl = null;
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('dragover', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          html.find('.quest-tasks-builder .quest-task-entry').not(this).removeClass('drag-over-top drag-over-bottom');
          if (ev.clientY < midY) {
            $(this).addClass('drag-over-top').removeClass('drag-over-bottom');
          } else {
            $(this).addClass('drag-over-bottom').removeClass('drag-over-top');
          }
        });

        html.find('.quest-tasks-builder').on('dragleave', '.quest-task-entry', function() {
          $(this).removeClass('drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('drop', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (ev.clientY < midY) {
            $(this).before(draggedTaskEl);
          } else {
            $(this).after(draggedTaskEl);
          }
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
          draggedTaskEl = null;
          updateTaskHierarchy();
        });

        const $factionXpContainer = html.find('.faction-xp-container');
        const addFactionXpRow = (facId = "", amount = 100) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="faction-xp-row">
              <i class="fas fa-star" style="color: #f59f00; font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="faction-xp-select quest-dialog-select">
                ${factions.map(f => {
                  const hasRanks = Array.isArray(f.ranks) && f.ranks.length > 0;
                  const rankNote = hasRanks ? `(${f.ranks.length} Ranks)` : `(No Ranks - XP Optional)`;
                  return `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)} ${rankNote}</option>`;
                }).join('')}
              </select>
              <div class="faction-xp-amount-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">XP:</span>
                <input type="number" class="faction-xp-amount" value="${amount}" min="0" placeholder="XP" />
              </div>
              <button type="button" class="remove-faction-xp-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $factionXpContainer.append(row);
          row.find('.remove-faction-xp-row').click(() => row.remove());
        };

        html.find('.add-faction-xp-row').click(ev => {
          ev.preventDefault();
          addFactionXpRow("", 100);
        });

        const $repContainer = html.find('.rep-container');
        const addRepRow = (facId = "", amount = 10) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="rep-row">
              <i class="fas fa-shield-alt" style="color: var(--theme-accent, #782e22); font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="rep-faction-select quest-dialog-select">
                ${factions.map(f => `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`).join('')}
              </select>
              <div class="rep-standing-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">Standing:</span>
                <input type="number" class="rep-delta-input" value="${amount}" placeholder="+/-" step="1" />
              </div>
              <button type="button" class="remove-rep-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $repContainer.append(row);
          row.find('.remove-rep-row').click(() => row.remove());
        };

        html.find('.add-rep-row').click(ev => {
          ev.preventDefault();
          addRepRow("", 10);
        });

        html.find('.affect-rep-checkbox').change(function() {
          const isChecked = $(this).is(':checked');
          $repContainer.css('display', isChecked ? 'flex' : 'none');
          html.find('.add-rep-row').css('display', isChecked ? 'inline-flex' : 'none');
          if (isChecked && $repContainer.find('.rep-row').length === 0) {
            addRepRow("", 10);
          }
        });

        const $dropzone = html.find('.quest-item-dropzone');
        const addItemChip = (itemObj) => {
          $dropzone.find('.dropzone-placeholder').hide();
          const chip = $(`
            <div class="reward-item-chip" data-item-id="${itemObj.id}" data-uuid="${itemObj.uuid}" data-name="${Handlebars.escapeExpression(itemObj.name)}" data-img="${itemObj.img}" data-type="${itemObj.type}">
              <img src="${itemObj.img}" class="reward-item-thumb" />
              <span class="reward-item-name" title="${Handlebars.escapeExpression(itemObj.name)}">${Handlebars.escapeExpression(itemObj.name)}</span>
              <input type="number" class="reward-item-qty" value="${itemObj.quantity || 1}" min="1" title="Quantity" />
              <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
            </div>
          `);
          chip.data('itemData', itemObj.itemData);
          $dropzone.append(chip);
          chip.find('.remove-reward-item').click(function() {
            chip.remove();
            if ($dropzone.find('.reward-item-chip').length === 0) {
              $dropzone.find('.dropzone-placeholder').show();
            }
          });
        };

        $dropzone.on('dragover', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', 'var(--theme-accent, #ff6400)');
        });
        $dropzone.on('dragleave', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
        });
        $dropzone.on('drop', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
          
          let data = null;
          try {
            data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
          } catch (e) {
            if (typeof TextEditor.getDragEventData === 'function') {
              data = TextEditor.getDragEventData(ev.originalEvent || ev);
            }
          }
          if (!data || data.type !== 'Item') return;

          let item = null;
          if (data.uuid) {
            try { item = await fromUuid(data.uuid); } catch (e) {}
          }
          if (!item && data.id) {
            item = game.items.get(data.id);
          }
          if (!item && data.data) {
            item = data.data;
          }
          if (!item) return;

          const itemObj = {
            id: item.id || foundry.utils.randomID(),
            uuid: data.uuid || item.uuid || "",
            name: item.name || "Item",
            img: item.img || "icons/svg/item-bag.svg",
            type: item.type || "loot",
            quantity: 1,
            itemData: typeof item.toObject === 'function' ? item.toObject() : null
          };

          addItemChip(itemObj);
        });
      },
      default: "create"
    }, { width: 800 }).render(true);
  },

  async _createQuest(data) {
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can create quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    if (!settings.quests) settings.quests = [];

    const questTitle = data.title || data.name || "Untitled Quest";
    const assignAll = data.assignedAll !== false && (!data.assignedTo || data.assignedTo.length === 0);

    const newQuest = {
      id: foundry.utils.randomID(),
      title: questTitle,
      name: questTitle,
      description: data.description || "",
      difficulty: data.difficulty || "Medium",
      status: data.status || "Active",
      giver: data.giver || "",
      commissionedFaction: data.commissionedFaction || "",
      image: data.image || "",
      tasks: data.tasks || [],
      rewards: data.rewards || { xp: 0, factionXp: [], reputation: null, currencies: {}, currency: "", items: [], text: "" },
      assignedAll: assignAll,
      assignedTo: assignAll ? [] : (Array.isArray(data.assignedTo) ? data.assignedTo : []),
      gmNotes: data.gmNotes || "",
      isPrimary: data.isPrimary === true,
      date: this._getGameDate()
    };
    
    // Auto-assign NPC quest giver as Known NPC
    if (data.giver && typeof data.giver === 'string' && data.giver.trim()) {
      const giverClean = data.giver.trim().toLowerCase();
      const giverActor = game.actors?.find(a => a.id === data.giver || a.name?.trim().toLowerCase() === giverClean);
      if (giverActor && !giverActor.hasPlayerOwner) {
        if (!settings.knownNPCs) settings.knownNPCs = [];
        if (!settings.knownNPCs.includes(giverActor.id)) {
          settings.knownNPCs.push(giverActor.id);
        }
      }
    }

    settings.quests.push(newQuest);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    this._sendQuestChatNotification(newQuest, 'new');
    ui.notifications.info(`Quest "${questTitle}" created`);
  },

  async _onEditQuest(event) {
    event.preventDefault();
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can edit quests.");
      return;
    }

    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) return;

    const questTitle = quest.title || quest.name || "";
    const playerActors = getPlayerActors();
    const tasks = Array.isArray(quest.tasks) ? quest.tasks : [];
    const rewards = quest.rewards || {};
    const factions = settings.factions || [];
    const systemCurrencies = getSystemCurrencies();
    
    const isAssignAll = quest.assignedAll !== false && (!quest.assignedTo || quest.assignedTo.length === 0);
    const assignedTo = Array.isArray(quest.assignedTo) ? quest.assignedTo : [];

    const tasksHtml = tasks.map((t) => {
      const isSub = Boolean(t.isSubstory || t.isSubquest);
      return `
        <div class="quest-task-entry ${isSub ? 'is-substory-header' : ''}" draggable="true">
          <input type="hidden" class="task-input-id" value="${t.id || foundry.utils.randomID()}" />
          <div class="quest-task-main-row">
            <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
            <input type="checkbox" class="task-input-completed" ${t.completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSub ? 'display: none;' : ''}" />
            <i class="fas fa-folder task-substory-static-icon" style="${isSub ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
            <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(t.text || '')}" placeholder="${isSub ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
            <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
          <div class="quest-task-badges-row">
            <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSub ? '' : 'display: none;'}">
              <i class="fas fa-plus"></i> Objective
            </button>
            <div class="quest-task-substory-badge ${isSub ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
              <input type="checkbox" class="task-input-substory" ${isSub ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-folder"></i> Substory
            </div>
            <div class="quest-task-hide-badge ${t.hidden ? 'active' : ''}" title="Toggle Hidden from Players">
              <input type="checkbox" class="task-input-hidden" ${t.hidden ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-eye-slash"></i> Hidden
            </div>
            <div class="quest-task-opt-badge ${t.optional ? 'active' : ''}" title="Toggle Optional" style="${isSub ? 'display: none;' : ''}">
              <input type="checkbox" class="task-input-optional" ${t.optional ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
            </div>
            <div class="quest-task-fail-badge ${t.failed ? 'active' : ''}" title="Toggle Failed State" style="${isSub ? 'display: none;' : ''}">
              <input type="checkbox" class="task-input-failed" ${t.failed ? 'checked' : ''} style="display: none;" />
              <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
            </div>
          </div>
        </div>
      `;
    }).join('');

    const savedCurrencies = rewards.currencies || {};
    const currencyInputsHtml = Object.entries(systemCurrencies).map(([key, label]) => {
      const currentVal = savedCurrencies[key] || '';
      return `
        <div class="quest-currency-card" title="${Handlebars.escapeExpression(label)}">
          <div class="currency-card-header">
            <i class="fas fa-coins" style="color: #d4af37; font-size: 10px;"></i>
            <span class="currency-tag">${Handlebars.escapeExpression((label || key).toUpperCase())}</span>
          </div>
          <input type="number" class="currency-val-input" data-denom="${Handlebars.escapeExpression(key)}" value="${currentVal}" placeholder="0" min="0" />
        </div>
      `;
    }).join('');

    const existingReps = Array.isArray(rewards.reputations) && rewards.reputations.length > 0
      ? rewards.reputations
      : (rewards.reputation && Number(rewards.reputation.amount || rewards.reputation.delta) !== 0 ? [rewards.reputation] : []);
    const hasRep = existingReps.length > 0;

    const items = Array.isArray(rewards.items) ? rewards.items : [];
    const itemsHtml = items.map(it => `
      <div class="reward-item-chip" data-item-id="${it.id || foundry.utils.randomID()}" data-uuid="${it.uuid || ''}" data-name="${Handlebars.escapeExpression(it.name)}" data-img="${it.img || 'icons/svg/item-bag.svg'}" data-type="${it.type || 'loot'}">
        <img src="${it.img || 'icons/svg/item-bag.svg'}" class="reward-item-thumb" />
        <span class="reward-item-name" title="${Handlebars.escapeExpression(it.name)}">${Handlebars.escapeExpression(it.name)}</span>
        <input type="number" class="reward-item-qty" value="${it.quantity || 1}" min="1" title="Quantity" />
        <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
      </div>
    `).join('');

    const descEditorHtml = createRichTextEditorHtml('description', quest.description || '', 'Provide quest narrative, background lore, clues, and objectives...');

    createDialog({
      title: `Edit Quest: ${questTitle || 'Untitled Quest'}`,
      content: `
        <form class="intoterica-form" style="max-height: 640px; overflow-y: auto; padding-right: 2px;">
          <!-- Tab Navigation -->
          <div class="dialog-tabs">
            <button type="button" class="dialog-tab-btn active" data-tab="details">
              <i class="fas fa-scroll"></i> Quest Details
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="rewards">
              <i class="fas fa-trophy"></i> Rewards
            </button>
            <button type="button" class="dialog-tab-btn" data-tab="gm">
              <i class="fas fa-user-shield"></i> GM Secret Notes & Pin
            </button>
          </div>

          <!-- TAB 1: Quest Details -->
          <div class="dialog-tab-content active" data-tab="details" style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Top Integrated Header: Art Banner + Title & Metadata -->
            <div style="display: flex; gap: 14px; align-items: stretch; background: var(--dialog-card-bg, rgba(255, 255, 255, 0.5)); border: 1px solid var(--dialog-section-border, rgba(120, 46, 34, 0.25)); border-radius: 6px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
              
              <!-- Left: Clickable Portrait Banner -->
              <div class="quest-art-banner" title="Click to choose splash image">
                <img class="quest-preview-img" src="${quest.image || 'icons/svg/item-bag.svg'}" style="${quest.image ? '' : 'opacity: 0.35;'}" />
                <div class="quest-art-overlay"><i class="fas fa-camera"></i> Change Art</div>
                <input type="hidden" name="image" value="${quest.image || ''}" class="quest-img-input" />
              </div>

              <!-- Right: Title + Metadata Strip -->
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; gap: 6px;">
                <div>
                  <input type="text" name="title" value="${Handlebars.escapeExpression(questTitle)}" placeholder="Quest Title (e.g. The Sunken Crypt)..." class="quest-title-large" autofocus required />
                </div>
                
                <div class="quest-meta-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-signal"></i> Difficulty</label>
                    <select name="difficulty" class="quest-dialog-select">
                      ${getDifficultyOptions(quest.difficulty)}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-hourglass-half"></i> Status</label>
                    <select name="status" class="quest-dialog-select">
                      <option value="Active" ${quest.status === 'Active' ? 'selected' : ''}>Active</option>
                      <option value="Available" ${quest.status === 'Available' ? 'selected' : ''}>Available</option>
                      <option value="Completed" ${quest.status === 'Completed' ? 'selected' : ''}>Completed</option>
                      <option value="Failed" ${quest.status === 'Failed' ? 'selected' : ''}>Failed</option>
                      <option value="Hidden" ${quest.status === 'Hidden' ? 'selected' : ''}>Hidden</option>
                    </select>
                  </div>
                </div>

                <!-- Commissioned By & Giver Section -->
                <div class="quest-commission-strip">
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-shield-alt"></i> Commissioned by (Faction)</label>
                    <select name="commissionedFaction" class="quest-dialog-select">
                      <option value="">— Independent / None —</option>
                      ${factions.map(f => `<option value="${f.name}" ${quest.commissionedFaction === f.name ? 'selected' : ''}>${f.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="quest-meta-pill">
                    <label><i class="fas fa-user-circle"></i> Quest Giver / Issuer</label>
                    <select class="quest-giver-select quest-dialog-select" title="Choose from World Folders, NPCs, Factions...">
                      ${getQuestGiverOptions(quest.giver)}
                    </select>
                    <input type="text" name="giver" value="${quest.giver || ''}" class="quest-giver-custom-input" style="display: none; margin-top: 4px;" placeholder="Type custom giver name..." />
                  </div>
                </div>

              </div>

            </div>

            <!-- Player Assignment Section -->
            <div class="quest-assignment-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--dialog-section-title, #782e22); display: flex; align-items: center; gap: 5px;">
                  <i class="fas fa-users"></i> Assigned Players / Characters
                </div>
                <label class="assign-all-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #ff6400); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin: 0; user-select: none;">
                  <input type="checkbox" name="assignAll" class="assign-all-checkbox" ${isAssignAll ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                  <span>Assign to All Players (Whole Party)</span>
                </label>
              </div>
              ${playerActors.length ? `
                <div class="quest-player-assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px;">
                  ${playerActors.map(p => {
                    const isAssigned = isAssignAll || assignedTo.includes(p.id);
                    const avatar = p.img || p.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
                    return `
                      <label class="player-assign-card ${isAssigned ? 'assigned' : ''}" data-actor-id="${p.id}">
                        <input type="checkbox" name="assign_${p.id}" class="player-assign-cb" value="${p.id}" ${isAssigned ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                        <img src="${avatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;" />
                        <span style="font-size: 11px; font-weight: 600; color: var(--dialog-input-text, #191813); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${p.name}">${p.name}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `<p style="font-size: 11px; font-style: italic; color: var(--theme-dim); margin: 0;">No player characters detected on the app.</p>`}
            </div>

            <!-- Bottom 2-Column Ledger: Description (Left) + Objectives & Tasks (Right) -->
            <div class="quest-editor-body" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 12px; align-items: stretch;">
              
              <!-- Left Column: Quest Description with Journal-Style Rich Text Editor -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title">
                  <span><i class="fas fa-feather-alt"></i> Quest Description</span>
                </div>
                ${descEditorHtml}
              </div>

              <!-- Right Column: Objectives & Tasks Builder -->
              <div class="quest-panel" style="display: flex; flex-direction: column; min-width: 0;">
                <div class="quest-panel-title"><i class="fas fa-tasks"></i> Objectives & Tasks</div>
                <div class="quest-tasks-builder" style="flex: 1; max-height: 280px; overflow-y: auto; padding-right: 2px;">
                  ${tasksHtml}
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                  <button type="button" class="add-task-row" style="flex: 1;"><i class="fas fa-plus"></i> Add Objective</button>
                  <button type="button" class="add-substory-row" style="flex: 1; background: rgba(25, 113, 194, 0.15); border: 1px solid rgba(25, 113, 194, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px; font-weight: 600;"><i class="fas fa-folder-plus"></i> Add Substory</button>
                </div>
              </div>

            </div>

          </div>

          <!-- TAB 2: Automated Rewards -->
          <div class="dialog-tab-content" data-tab="rewards" style="display: none; flex-direction: column; gap: 12px;">
            <div class="quest-panel" style="padding: 12px;">
              <div class="quest-panel-title" style="margin-bottom: 12px; font-size: 13px;">
                <i class="fas fa-trophy" style="color: #f59f00;"></i> Automated Quest Rewards
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">

                <!-- 1. Multi-Faction XP -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-star" style="color: #f59f00;"></i> Faction XP</span>
                    <button type="button" class="add-faction-xp-row" style="font-size: 11px; padding: 3px 8px; background: rgba(245, 159, 0, 0.15); border: 1px solid rgba(245, 159, 0, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer;"><i class="fas fa-plus"></i> Add Faction XP</button>
                  </div>
                  <div class="faction-xp-container" style="display: flex; flex-direction: column; gap: 6px;">
                    <!-- Faction XP rows injected here -->
                  </div>
                </div>

                <!-- 2. Multi-Faction Reputation -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="affect-rep-label" style="font-size: 11px; font-weight: 700; color: var(--theme-accent, #782e22); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0; user-select: none;">
                      <input type="checkbox" name="affectRep" class="affect-rep-checkbox" ${hasRep ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;" />
                      <span><i class="fas fa-shield-alt"></i> Affect Reputation?</span>
                    </label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="rep-target-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.08); color: var(--theme-dim);">
                        ${isAssignAll ? 'Whole Party' : 'Assigned Characters'}
                      </span>
                      <button type="button" class="add-rep-row" style="${hasRep ? 'display: inline-flex;' : 'display: none;'} font-size: 11px; padding: 3px 8px; background: rgba(43, 138, 62, 0.15); border: 1px solid rgba(43, 138, 62, 0.4); color: var(--dialog-input-text, #333); border-radius: 4px; cursor: pointer; align-items: center; gap: 4px;">
                        <i class="fas fa-plus"></i> Add Faction
                      </button>
                    </div>
                  </div>
                  <div class="rep-container" style="${hasRep ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 6px; margin-top: 6px;">
                    <!-- Reputation rows injected here -->
                  </div>
                </div>

                <!-- 3. System Currencies -->
                <div class="reward-section-box">
                  <div class="reward-section-subtitle" style="margin-bottom: 6px;"><i class="fas fa-coins" style="color: #d4af37;"></i> Currency</div>
                  <div class="quest-currency-grid">
                    ${currencyInputsHtml}
                  </div>
                </div>

                <!-- 4. Compendium / Directory Item Drag & Drop -->
                <div class="reward-section-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="reward-section-subtitle"><i class="fas fa-box-open" style="color: #4facfe;"></i> Items & Equipment</span>
                    <span style="font-size: 10px; color: var(--theme-dim); font-style: italic;">Drop items from Directory/Compendiums</span>
                  </div>
                  <div class="quest-item-dropzone" style="min-height: 56px; border: 1px dashed var(--dialog-section-border, rgba(120, 46, 34, 0.4)); border-radius: 4px; background: rgba(0,0,0,0.03); padding: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-start;">
                    <div class="dropzone-placeholder" style="${items.length ? 'display: none;' : ''} width: 100%; text-align: center; font-size: 11px; color: var(--theme-dim); padding: 10px 0;">
                      <i class="fas fa-hand-holding"></i> Drag & Drop Items Here
                    </div>
                    ${itemsHtml}
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- TAB 3: GM Controls -->
          <div class="dialog-tab-content" data-tab="gm" style="display: none; flex-direction: column; gap: 12px;">
            <div class="form-section">
              <div class="form-section-title"><i class="fas fa-user-shield"></i> GM Secret Notes</div>
              <div class="form-group">
                <label>GM Notes (Hidden from Players)</label>
                <textarea name="gmNotes" placeholder="Secret clues, encounter triggers, NPC motivations, hidden DCs..." rows="5">${quest.gmNotes || ''}</textarea>
              </div>

              <div class="form-toggle-card" style="margin-top: 8px; border-color: rgba(245, 159, 0, 0.4); background: rgba(245, 159, 0, 0.08);">
                <input type="checkbox" name="isPrimary" id="q-is-primary-edit" ${quest.isPrimary ? 'checked' : ''} />
                <label for="q-is-primary-edit" style="font-weight: 700; color: #f59f00;"><i class="fas fa-star"></i> Set as Primary Objective (Pinned at Top of Tracker)</label>
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Changes",
          callback: async (html) => {
            const { form, data: formData } = getFormData(html);
            syncRichEditors(html);

            const descriptionHtml = html.find('.rich-editor-source[name="description"]').val() || html.find('textarea[name="description"]').val() || formData.description || "";

            const taskRows = html.find('.quest-task-entry');
            const updatedTasks = [];
            taskRows.each((i, row) => {
              const $row = $(row);
              const text = $row.find('.task-input-text').val().trim();
              const completed = $row.find('.task-input-completed').is(':checked');
              const failed = $row.find('.task-input-failed').is(':checked');
              const optional = $row.find('.task-input-optional').is(':checked');
              const isSubstory = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
              const hidden = $row.find('.task-input-hidden').is(':checked');
              const id = $row.find('.task-input-id').val() || foundry.utils.randomID();
              if (text) {
                updatedTasks.push({
                  id,
                  text,
                  completed: failed ? false : completed,
                  failed,
                  optional,
                  hidden,
                  isSubstory,
                  isSubquest: isSubstory
                });
              }
            });

            const assignAll = html.find('.assign-all-checkbox').is(':checked');
            const updatedAssignedTo = assignAll ? [] : html.find('.player-assign-cb:checked').map((i, el) => el.value).get();

            let giverValue = "";
            const giverSelectVal = html.find('.quest-giver-select').val();
            if (giverSelectVal && giverSelectVal !== '__custom__') {
              giverValue = giverSelectVal;
            } else if (html.find('.quest-giver-custom-input').val()) {
              giverValue = html.find('.quest-giver-custom-input').val().trim();
            }

            const factionXp = [];
            let totalFactionXp = 0;
            html.find('.faction-xp-row').each((i, el) => {
              const $r = $(el);
              const fId = $r.find('.faction-xp-select').val();
              const amount = parseInt($r.find('.faction-xp-amount').val()) || 0;
              const fObj = factions.find(f => f.id === fId);
              if (fId && amount > 0) {
                factionXp.push({ factionId: fId, factionName: fObj?.name || "", amount });
                totalFactionXp += amount;
              }
            });

            const affectRep = html.find('.affect-rep-checkbox').is(':checked');
            const reputations = [];
            if (affectRep) {
              html.find('.rep-row').each((i, el) => {
                const $r = $(el);
                const repFacId = $r.find('.rep-faction-select').val();
                const repDelta = parseInt($r.find('.rep-delta-input').val()) || 0;
                const fObj = factions.find(f => f.id === repFacId);
                if (repFacId && repDelta !== 0) {
                  reputations.push({
                    factionId: repFacId,
                    factionName: fObj?.name || "",
                    amount: repDelta
                  });
                }
              });
            }

            const currencies = {};
            const currencyParts = [];
            html.find('.currency-val-input').each((i, el) => {
              const denom = $(el).data('denom');
              const val = parseInt($(el).val()) || 0;
              if (denom && val > 0) {
                currencies[denom] = val;
                currencyParts.push(`${val} ${denom.toUpperCase()}`);
              }
            });

            const updatedItems = [];
            html.find('.reward-item-chip').each((i, el) => {
              const $c = $(el);
              updatedItems.push({
                id: $c.data('itemId') || foundry.utils.randomID(),
                uuid: $c.data('uuid') || "",
                name: $c.data('name') || "Item",
                img: $c.data('img') || "icons/svg/item-bag.svg",
                type: $c.data('type') || "loot",
                quantity: parseInt($c.find('.reward-item-qty').val()) || 1,
                itemData: $c.data('itemData') || null
              });
            });

            const titleFromDom = html.find('input[name="title"]').val() ?? form?.querySelector('input[name="title"]')?.value ?? formData.title;
            const cleanTitle = (typeof titleFromDom === 'string' && titleFromDom.trim().length > 0) ? titleFromDom.trim() : (quest.title || quest.name || "Untitled Quest");
            const updatedData = {
              title: cleanTitle,
              name: cleanTitle,
              difficulty: formData.difficulty || "Medium",
              status: formData.status || "Active",
              giver: giverValue,
              commissionedFaction: formData.commissionedFaction || "",
              image: formData.image || "",
              description: descriptionHtml,
              tasks: updatedTasks,
              rewards: {
                xp: totalFactionXp,
                factionXp,
                reputations,
                reputation: reputations[0] || null,
                currencies,
                currency: currencyParts.join(', '),
                items: updatedItems,
                text: ""
              },
              assignedAll: assignAll,
              assignedTo: updatedAssignedTo,
              gmNotes: formData.gmNotes || "",
              isPrimary: formData.isPrimary === true
            };

            await this._updateQuest(questId, updatedData);
          }
        },
        delete: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Delete",
          callback: async () => {
            await this._deleteQuest(questId);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        initRichTextEditor(html);

        html.find('.dialog-tab-btn').click(function(ev) {
          ev.preventDefault();
          const tabName = $(this).data('tab');
          html.find('.dialog-tab-btn').removeClass('active');
          $(this).addClass('active');
          html.find('.dialog-tab-content').removeClass('active').hide();
          html.find(`.dialog-tab-content[data-tab="${tabName}"]`).addClass('active').css('display', 'flex').show();
        });

        html.find('.quest-art-banner').click(function(ev) {
          ev.preventDefault();
          const $banner = $(this);
          const currentImg = $banner.find('.quest-img-input').val();
          new FilePicker({
            type: "image",
            current: currentImg || undefined,
            callback: (path) => {
              $banner.find('.quest-img-input').val(path);
              $banner.find('.quest-preview-img').attr('src', path).css('opacity', '1');
            }
          }).render(true);
        });

        const $assignAll = html.find('.assign-all-checkbox');
        const $playerCbs = html.find('.player-assign-cb');
        const $repTargetBadge = html.find('.rep-target-badge');

        $assignAll.change(function() {
          const isChecked = $(this).is(':checked');
          $playerCbs.prop('checked', isChecked);
          $playerCbs.each(function() {
            const $card = $(this).closest('.player-assign-card');
            $card.toggleClass('assigned', isChecked);
          });
          $repTargetBadge.text(isChecked ? 'Whole Party' : 'Assigned Characters');
        });

        $playerCbs.change(function() {
          const $card = $(this).closest('.player-assign-card');
          const isChecked = $(this).is(':checked');
          $card.toggleClass('assigned', isChecked);

          const total = $playerCbs.length;
          const checkedCount = $playerCbs.filter(':checked').length;
          const allChecked = total > 0 && checkedCount === total;
          $assignAll.prop('checked', allChecked);
          $repTargetBadge.text(allChecked ? 'Whole Party' : 'Assigned Characters');
        });

        const $giverSelect = html.find('.quest-giver-select');
        const $giverInput = html.find('.quest-giver-custom-input');

        $giverSelect.change(function() {
          const val = $(this).val();
          if (val === '__custom__') {
            $giverInput.show().val('').focus();
          } else {
            $giverInput.val(val).hide();
          }
        });

        const renderTaskRowHtml = ({ id = foundry.utils.randomID(), text = '', completed = false, failed = false, optional = false, hidden = false, isSubstory = false } = {}) => {
          return `
            <div class="quest-task-entry ${isSubstory ? 'is-substory-header' : ''}" draggable="true">
              <input type="hidden" class="task-input-id" value="${id}" />
              <div class="quest-task-main-row">
                <i class="fas fa-grip-vertical task-drag-handle" title="Drag to reorder"></i>
                <input type="checkbox" class="task-input-completed" ${completed ? 'checked' : ''} title="Mark Completed" style="margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; ${isSubstory ? 'display: none;' : ''}" />
                <i class="fas fa-folder task-substory-static-icon" style="${isSubstory ? 'color: #1971c2; font-size: 14px; flex-shrink: 0;' : 'display: none;'}" title="Substory Header"></i>
                <input type="text" class="task-input-text" value="${Handlebars.escapeExpression(text)}" placeholder="${isSubstory ? 'Substory title / folder...' : 'Objective description...'}" style="flex: 1; min-width: 0;" />
                <button type="button" class="delete-task-row" title="Delete objective" style="background: transparent; border: none; color: #e03131; cursor: pointer; padding: 2px 6px; font-size: 13px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px;">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              <div class="quest-task-badges-row">
                <button type="button" class="add-child-task-btn" title="Add objective under this Substory" style="${isSubstory ? '' : 'display: none;'}">
                  <i class="fas fa-plus"></i> Objective
                </button>
                <div class="quest-task-substory-badge ${isSubstory ? 'active' : ''}" title="Toggle Substory (Header / Folder)">
                  <input type="checkbox" class="task-input-substory" ${isSubstory ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-folder"></i> Substory
                </div>
                <div class="quest-task-hide-badge ${hidden ? 'active' : ''}" title="Toggle Hidden from Players">
                  <input type="checkbox" class="task-input-hidden" ${hidden ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-eye-slash"></i> Hidden
                </div>
                <div class="quest-task-opt-badge ${optional ? 'active' : ''}" title="Toggle Optional" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-optional" ${optional ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-flag" style="font-size: 9px;"></i> Optional
                </div>
                <div class="quest-task-fail-badge ${failed ? 'active' : ''}" title="Toggle Failed State" style="${isSubstory ? 'display: none;' : ''}">
                  <input type="checkbox" class="task-input-failed" ${failed ? 'checked' : ''} style="display: none;" />
                  <i class="fas fa-times-circle" style="font-size: 9px;"></i> Failed
                </div>
              </div>
            </div>
          `;
        };

        const updateTaskHierarchy = () => {
          let inSubstory = false;
          html.find('.quest-task-entry').each(function() {
            const $row = $(this);
            const isSub = $row.find('.task-input-substory').is(':checked') || $row.find('.task-input-subquest').is(':checked');
            if (isSub) {
              inSubstory = true;
              $row.addClass('is-substory-header').removeClass('is-substory-child');
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').hide();
              $row.find('.task-substory-static-icon, .add-child-task-btn').show();
              $row.find('.task-input-text').attr('placeholder', 'Substory title / folder...');
            } else {
              $row.removeClass('is-substory-header');
              if (inSubstory) {
                $row.addClass('is-substory-child');
              } else {
                $row.removeClass('is-substory-child');
              }
              $row.find('.task-input-completed, .quest-task-opt-badge, .quest-task-fail-badge').show();
              $row.find('.task-substory-static-icon, .add-child-task-btn').hide();
              $row.find('.task-input-text').attr('placeholder', 'Objective description...');
            }
          });
        };

        updateTaskHierarchy();

        html.on('click', '.quest-task-substory-badge, .quest-task-subquest-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-substory, .task-input-subquest');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          updateTaskHierarchy();
        });

        html.on('click', '.quest-task-hide-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-hidden');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        html.on('click', '.quest-task-opt-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-optional');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
        });

        html.on('click', '.quest-task-fail-badge', function(ev) {
          ev.preventDefault();
          const $badge = $(this);
          const $cb = $badge.find('.task-input-failed');
          const checked = !$cb.is(':checked');
          $cb.prop('checked', checked);
          $badge.toggleClass('active', checked);
          if (checked) {
            $badge.closest('.quest-task-entry').find('.task-input-completed').prop('checked', false);
          }
        });

        html.find('.add-task-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.find('.add-substory-row').click(ev => {
          ev.preventDefault();
          const row = $(renderTaskRowHtml({ isSubstory: true }));
          html.find('.quest-tasks-builder').append(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.on('click', '.add-child-task-btn', function(ev) {
          ev.preventDefault();
          const $header = $(this).closest('.quest-task-entry');
          let $insertTarget = $header;
          let $next = $header.next('.quest-task-entry');
          while ($next.length && !$next.find('.task-input-substory').is(':checked') && !$next.find('.task-input-subquest').is(':checked')) {
            $insertTarget = $next;
            $next = $next.next('.quest-task-entry');
          }
          const row = $(renderTaskRowHtml({ isSubstory: false }));
          $insertTarget.after(row);
          updateTaskHierarchy();
          row.find('.task-input-text').focus();
        });

        html.on('click', '.delete-task-row', function(ev) {
          ev.preventDefault();
          $(this).closest('.quest-task-entry').remove();
          updateTaskHierarchy();
        });

        let draggedTaskEl = null;
        html.find('.quest-tasks-builder').on('dragstart', '.quest-task-entry', function(ev) {
          if ($(ev.target).is('input, button, select, textarea')) {
            ev.preventDefault();
            return;
          }
          draggedTaskEl = this;
          ev.originalEvent.dataTransfer.effectAllowed = 'move';
          ev.originalEvent.dataTransfer.setData('text/plain', 'reorder-task');
          $(this).addClass('dragging');
        });

        html.find('.quest-tasks-builder').on('dragend', '.quest-task-entry', function() {
          draggedTaskEl = null;
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('dragover', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          html.find('.quest-tasks-builder .quest-task-entry').not(this).removeClass('drag-over-top drag-over-bottom');
          if (ev.clientY < midY) {
            $(this).addClass('drag-over-top').removeClass('drag-over-bottom');
          } else {
            $(this).addClass('drag-over-bottom').removeClass('drag-over-top');
          }
        });

        html.find('.quest-tasks-builder').on('dragleave', '.quest-task-entry', function() {
          $(this).removeClass('drag-over-top drag-over-bottom');
        });

        html.find('.quest-tasks-builder').on('drop', '.quest-task-entry', function(ev) {
          ev.preventDefault();
          if (!draggedTaskEl || draggedTaskEl === this) return;
          const rect = this.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (ev.clientY < midY) {
            $(this).before(draggedTaskEl);
          } else {
            $(this).after(draggedTaskEl);
          }
          html.find('.quest-tasks-builder .quest-task-entry').removeClass('dragging drag-over-top drag-over-bottom');
          draggedTaskEl = null;
          updateTaskHierarchy();
        });

        const $factionXpContainer = html.find('.faction-xp-container');
        const addFactionXpRow = (facId = "", amount = 100) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="faction-xp-row">
              <i class="fas fa-star" style="color: #f59f00; font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="faction-xp-select quest-dialog-select">
                ${factions.map(f => {
                  const hasRanks = Array.isArray(f.ranks) && f.ranks.length > 0;
                  const rankNote = hasRanks ? `(${f.ranks.length} Ranks)` : `(No Ranks - XP Optional)`;
                  return `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)} ${rankNote}</option>`;
                }).join('')}
              </select>
              <div class="faction-xp-amount-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">XP:</span>
                <input type="number" class="faction-xp-amount" value="${amount}" min="0" placeholder="XP" />
              </div>
              <button type="button" class="remove-faction-xp-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $factionXpContainer.append(row);
          row.find('.remove-faction-xp-row').click(() => row.remove());
        };

        const existingFactionXp = Array.isArray(rewards.factionXp) ? rewards.factionXp : [];
        if (existingFactionXp.length > 0) {
          existingFactionXp.forEach(fx => addFactionXpRow(fx.factionId, fx.amount));
        } else if (Number(rewards.xp) > 0 && factions.length > 0) {
          addFactionXpRow(factions[0].id, Number(rewards.xp));
        }

        html.find('.add-faction-xp-row').click(ev => {
          ev.preventDefault();
          addFactionXpRow("", 100);
        });

        const $repContainer = html.find('.rep-container');
        const addRepRow = (facId = "", amount = 10) => {
          if (!factions.length) {
            ui.notifications.warn("No factions created yet in the module.");
            return;
          }
          const defaultFac = facId || factions[0]?.id;
          const row = $(`
            <div class="rep-row">
              <i class="fas fa-shield-alt" style="color: var(--theme-accent, #782e22); font-size: 11px; margin-left: 2px; flex-shrink: 0;"></i>
              <select class="rep-faction-select quest-dialog-select">
                ${factions.map(f => `<option value="${f.id}" ${f.id === defaultFac ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`).join('')}
              </select>
              <div class="rep-standing-group">
                <span style="font-size: 10px; font-weight: 700; color: var(--dialog-input-text, #191813);">Standing:</span>
                <input type="number" class="rep-delta-input" value="${amount}" placeholder="+/-" step="1" />
              </div>
              <button type="button" class="remove-rep-row" title="Remove" style="background: transparent; border: none; color: #c92a2a; cursor: pointer; padding: 2px 4px; font-size: 12px;"><i class="fas fa-times"></i></button>
            </div>
          `);
          $repContainer.append(row);
          row.find('.remove-rep-row').click(() => row.remove());
        };

        if (existingReps.length > 0) {
          existingReps.forEach(r => addRepRow(r.factionId, r.amount !== undefined ? r.amount : r.delta));
        }

        html.find('.add-rep-row').click(ev => {
          ev.preventDefault();
          addRepRow("", 10);
        });

        html.find('.affect-rep-checkbox').change(function() {
          const isChecked = $(this).is(':checked');
          $repContainer.css('display', isChecked ? 'flex' : 'none');
          html.find('.add-rep-row').css('display', isChecked ? 'inline-flex' : 'none');
          if (isChecked && $repContainer.find('.rep-row').length === 0) {
            addRepRow("", 10);
          }
        });

        const $dropzone = html.find('.quest-item-dropzone');
        $dropzone.find('.remove-reward-item').click(function() {
          $(this).closest('.reward-item-chip').remove();
          if ($dropzone.find('.reward-item-chip').length === 0) {
            $dropzone.find('.dropzone-placeholder').show();
          }
        });

        const addItemChip = (itemObj) => {
          $dropzone.find('.dropzone-placeholder').hide();
          const chip = $(`
            <div class="reward-item-chip" data-item-id="${itemObj.id}" data-uuid="${itemObj.uuid}" data-name="${Handlebars.escapeExpression(itemObj.name)}" data-img="${itemObj.img}" data-type="${itemObj.type}">
              <img src="${itemObj.img}" class="reward-item-thumb" />
              <span class="reward-item-name" title="${Handlebars.escapeExpression(itemObj.name)}">${Handlebars.escapeExpression(itemObj.name)}</span>
              <input type="number" class="reward-item-qty" value="${itemObj.quantity || 1}" min="1" title="Quantity" />
              <button type="button" class="remove-reward-item" title="Remove"><i class="fas fa-times"></i></button>
            </div>
          `);
          chip.data('itemData', itemObj.itemData);
          $dropzone.append(chip);
          chip.find('.remove-reward-item').click(function() {
            chip.remove();
            if ($dropzone.find('.reward-item-chip').length === 0) {
              $dropzone.find('.dropzone-placeholder').show();
            }
          });
        };

        $dropzone.on('dragover', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', 'var(--theme-accent, #ff6400)');
        });
        $dropzone.on('dragleave', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
        });
        $dropzone.on('drop', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $dropzone.css('border-color', '');
          
          let data = null;
          try {
            data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
          } catch (e) {
            if (typeof TextEditor.getDragEventData === 'function') {
              data = TextEditor.getDragEventData(ev.originalEvent || ev);
            }
          }
          if (!data || data.type !== 'Item') return;

          let item = null;
          if (data.uuid) {
            try { item = await fromUuid(data.uuid); } catch (e) {}
          }
          if (!item && data.id) {
            item = game.items.get(data.id);
          }
          if (!item && data.data) {
            item = data.data;
          }
          if (!item) return;

          const itemObj = {
            id: item.id || foundry.utils.randomID(),
            uuid: data.uuid || item.uuid || "",
            name: item.name || "Item",
            img: item.img || "icons/svg/item-bag.svg",
            type: item.type || "loot",
            quantity: 1,
            itemData: typeof item.toObject === 'function' ? item.toObject() : null
          };

          addItemChip(itemObj);
        });
      },
      default: "save"
    }, { width: 800 }).render(true);
  },

  async _updateQuest(questId, data) {
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can edit quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    const quest = (settings.quests || []).find(q => q.id === questId);
    if (!quest) {
      console.warn(`Intoterica | Could not find quest to update with id: ${questId}`);
      return;
    }

    if (!quest.id) quest.id = questId;

    Object.assign(quest, data);

    if (quest.status === 'Completed') {
      if (!quest.completedBy || quest.completedBy.length === 0) {
        const compIds = (quest.assignedTo && quest.assignedTo.length > 0) ? quest.assignedTo : (quest.assignedAll !== false ? getPlayerActors().map(a => a.id) : []);
        quest.completedBy = compIds;
        quest.assignedTo = compIds;
        quest.assignedAll = false;
      }
    } else if (quest.status === 'Failed') {
      if (!quest.failedBy || quest.failedBy.length === 0) {
        const failIds = (quest.assignedTo && quest.assignedTo.length > 0) ? quest.assignedTo : (quest.assignedAll !== false ? getPlayerActors().map(a => a.id) : []);
        quest.failedBy = failIds;
        quest.assignedTo = failIds;
        quest.assignedAll = false;
      }
    }

    // Auto-assign NPC quest giver as Known NPC
    if (data.giver && typeof data.giver === 'string' && data.giver.trim()) {
      const giverClean = data.giver.trim().toLowerCase();
      const giverActor = game.actors?.find(a => a.id === data.giver || a.name?.trim().toLowerCase() === giverClean);
      if (giverActor && !giverActor.hasPlayerOwner) {
        if (!settings.knownNPCs) settings.knownNPCs = [];
        if (!settings.knownNPCs.includes(giverActor.id)) {
          settings.knownNPCs.push(giverActor.id);
        }
      }
    }

    quest.lastModified = Date.now();
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${data.title}" updated.`);
  },

  async _deleteQuest(questId) {
    if (!game.user.isGM && !hasPermission('permQuests')) {
      ui.notifications.warn("Only Game Masters can delete quests.");
      return;
    }

    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    settings.quests = (settings.quests || []).filter(q => q.id !== questId);
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info("Quest deleted.");
  }
};

