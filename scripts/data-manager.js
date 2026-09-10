export class IntotericaDataManager extends (foundry.applications?.api?.HandlebarsApplicationMixin
  ? foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)
  : Application) {

  static DEFAULT_OPTIONS = {
    id: "intoterica-data-manager",
    window: {
      title: "Intoterica Data Manager & Character Migration",
      icon: "fas fa-database",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 860,
      height: 600
    },
    classes: ["intoterica", "intoterica-data-manager-window"]
  };

  static PARTS = {
    main: {
      template: "modules/intoterica/templates/data-manager.hbs"
    }
  };

  // Legacy Application V1 shim if ever needed
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "intoterica-data-manager",
      title: "Intoterica Data Manager & Character Migration",
      template: "modules/intoterica/templates/data-manager.hbs",
      width: 860,
      height: 600,
      resizable: true,
      classes: ["intoterica", "intoterica-data-manager-window"]
    });
  }

  static getActorFolderPath(actor) {
    if (!actor.folder) return "No Folder";
    const pathParts = [];
    let current = actor.folder;
    while (current) {
      pathParts.unshift(current.name);
      current = current.folder;
    }
    return pathParts.join(" / ");
  }

  async _prepareContext(options = {}) {
    const data = game.settings.get('intoterica', 'data') || {};
    const rawJson = JSON.stringify(data, null, 2);

    const folderMap = new Map();

    const actors = game.actors.contents.map(a => {
      const folderPath = IntotericaDataManager.getActorFolderPath(a);
      const actorData = {
        id: a.id,
        name: a.name,
        type: a.type || 'character',
        folder: folderPath,
        isPC: a.hasPlayerOwner
      };

      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath).push(actorData);

      return actorData;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const actorGroups = Array.from(folderMap.entries())
      .map(([folderName, groupActors]) => ({
        folderName,
        actors: groupActors.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => {
        if (a.folderName === "No Folder") return 1;
        if (b.folderName === "No Folder") return -1;
        return a.folderName.localeCompare(b.folderName);
      });

    return {
      actors,
      actorGroups,
      rawJson,
      data
    };
  }

  // Legacy getData shim
  async getData(options = {}) {
    return this._prepareContext(options);
  }

  _onRender(context, options) {
    if (super._onRender) super._onRender(context, options);
    const html = this.element;
    this._bindEvents(html);
  }

  // Legacy activateListeners shim
  activateListeners(html) {
    super.activateListeners(html);
    const root = html instanceof HTMLElement ? html : (html[0] || html);
    this._bindEvents(root);
  }

  _bindEvents(root) {
    if (!root) return;

    // Apply theme styling class
    const themeKey = game.settings.get('intoterica', 'theme') || 'default';
    const themeConfig = window.IntotericaApp?.THEMES?.[themeKey] || window.IntotericaApp?.THEMES?.['default'];
    const themeClass = themeConfig?.class || 'theme-foundry';
    root.classList.add(themeClass);

    // Tab navigation
    const tabs = root.querySelectorAll('.data-manager-tabs .item');
    const tabContents = root.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const activeContent = root.querySelector(`.tab-content[data-tab="${targetTab}"]`);
        if (activeContent) activeContent.classList.add('active');
      });
    });

    // Source Actor Selection & Stats Preview
    const sourceSelect = root.querySelector('.source-actor-select');
    const targetSelect = root.querySelector('.target-actor-select');
    const sourceStats = {
      quests: root.querySelector('.stat-quests'),
      factions: root.querySelector('.stat-factions'),
      badges: root.querySelector('.stat-badges'),
      messages: root.querySelector('.stat-messages'),
      history: root.querySelector('.stat-history')
    };
    const targetInfo = root.querySelector('.dm-target-info');

    const updateSourceStats = () => {
      const sourceId = sourceSelect?.value;
      if (!sourceId) {
        if (sourceStats.quests) sourceStats.quests.textContent = '0';
        if (sourceStats.factions) sourceStats.factions.textContent = '0';
        if (sourceStats.badges) sourceStats.badges.textContent = '0';
        if (sourceStats.messages) sourceStats.messages.textContent = '0';
        if (sourceStats.history) sourceStats.history.textContent = '0';
        return;
      }

      const data = game.settings.get('intoterica', 'data') || {};
      
      // Quests count
      const questsCount = (data.quests || []).filter(q => {
        const assigned = Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []);
        return assigned.includes(sourceId);
      }).length;

      // Factions count
      const factionsCount = (data.factions || []).filter(f => {
        return (f.members || []).some(m => m.id === sourceId);
      }).length;

      // Badges count
      const badgesCount = (data.meritBadges || []).filter(b => {
        return (b.earnedBy || []).includes(sourceId);
      }).length;

      // Messages count
      const messagesCount = (data.inbox || []).filter(m => {
        const to = Array.isArray(m.to) ? m.to : [];
        const cc = Array.isArray(m.cc) ? m.cc : [];
        return m.fromId === sourceId || to.includes(sourceId) || cc.includes(sourceId);
      }).length;

      // Profile history count
      const historyEntry = (data.profileHistory || {})[sourceId];
      const historyCount = (historyEntry?.hidden?.length || 0) + (historyEntry?.added?.length || 0);

      if (sourceStats.quests) sourceStats.quests.textContent = questsCount;
      if (sourceStats.factions) sourceStats.factions.textContent = factionsCount;
      if (sourceStats.badges) sourceStats.badges.textContent = badgesCount;
      if (sourceStats.messages) sourceStats.messages.textContent = messagesCount;
      if (sourceStats.history) sourceStats.history.textContent = historyCount;
    };

    const updateTargetInfo = () => {
      const targetId = targetSelect?.value;
      if (!targetId) {
        if (targetInfo) targetInfo.innerHTML = 'Select a target actor to receive the transferred progress.';
        return;
      }
      const targetActor = game.actors.get(targetId);
      if (targetActor && targetInfo) {
        targetInfo.innerHTML = `<strong>${targetActor.name}</strong> (${targetActor.type || 'Character'}) ready to receive transferred progress.`;
      }
    };

    sourceSelect?.addEventListener('change', updateSourceStats);
    targetSelect?.addEventListener('change', updateTargetInfo);

    // Execute Migration Button
    const btnMigrate = root.querySelector('.btn-execute-migration');
    btnMigrate?.addEventListener('click', async () => {
      const sourceId = sourceSelect?.value;
      const targetId = targetSelect?.value;

      if (!sourceId || !targetId) {
        ui.notifications.warn("Intoterica: Please select both a Source and Target character.");
        return;
      }
      if (sourceId === targetId) {
        ui.notifications.warn("Intoterica: Source and Target character cannot be the same.");
        return;
      }

      const sourceActor = game.actors.get(sourceId);
      const targetActor = game.actors.get(targetId);
      const sourceName = sourceActor?.name || sourceId;
      const targetName = targetActor?.name || targetId;

      const options = {
        quests: root.querySelector('.opt-transfer-quests')?.checked ?? true,
        factions: root.querySelector('.opt-transfer-factions')?.checked ?? true,
        badges: root.querySelector('.opt-transfer-badges')?.checked ?? true,
        messages: root.querySelector('.opt-transfer-messages')?.checked ?? true,
        history: root.querySelector('.opt-transfer-history')?.checked ?? true,
        npcs: root.querySelector('.opt-transfer-npcs')?.checked ?? true
      };

      const confirmed = await foundry.applications.api.DialogV2?.confirm({
        window: { title: "Confirm Character Migration" },
        content: `
          <div style="padding: 8px;">
            <p>Are you sure you want to migrate character progress?</p>
            <p><strong>From:</strong> ${sourceName} (<code>${sourceId}</code>)<br/>
            <strong>To:</strong> ${targetName} (<code>${targetId}</code>)</p>
            <p style="font-size: 0.9em; color: #888;">This will reassign selected quests, faction standings, badges, and messages from ${sourceName} to ${targetName}.</p>
          </div>
        `,
        modal: true
      }) ?? (await new Promise(resolve => {
        new Dialog({
          title: "Confirm Character Migration",
          content: `<p>Migrate progress from <strong>${sourceName}</strong> to <strong>${targetName}</strong>?</p>`,
          buttons: {
            yes: { label: "Migrate", callback: () => resolve(true) },
            no: { label: "Cancel", callback: () => resolve(false) }
          },
          default: "yes"
        }).render(true);
      }));

      if (!confirmed) return;

      try {
        const result = await IntotericaDataManager.migrateCharacterData(sourceId, targetId, options);
        ui.notifications.info(`Intoterica: Successfully migrated progress from ${sourceName} to ${targetName}! (${result.summary})`);
        
        // Refresh this window
        this.render();

        // Refresh active Intoterica window if open
        if (window.IntotericaApp?._instance?.rendered) {
          window.IntotericaApp._instance.render();
        }
      } catch (err) {
        console.error("Intoterica | Migration Error:", err);
        ui.notifications.error(`Intoterica Migration Failed: ${err.message}`);
      }
    });

    // Raw JSON: Export Backup
    const btnExport = root.querySelector('.btn-export-backup');
    btnExport?.addEventListener('click', () => {
      const data = game.settings.get('intoterica', 'data') || {};
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `intoterica-backup-${dateStr}.json`;
      saveDataToFile(JSON.stringify(data, null, 2), "text/json", filename);
    });

    // Raw JSON: Import Backup
    const fileInput = root.querySelector('.input-import-file');
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error("Invalid JSON structure");
          }

          const confirmed = await foundry.applications.api.DialogV2?.confirm({
            window: { title: "Restore Intoterica Backup" },
            content: "<p>⚠️ Are you sure you want to restore this backup? Current Intoterica data will be replaced.</p>",
            modal: true
          }) ?? true;

          if (confirmed) {
            await game.settings.set('intoterica', 'data', parsed);
            ui.notifications.info("Intoterica: Backup successfully restored!");
            this.render();
            if (window.IntotericaApp?._instance?.rendered) {
              window.IntotericaApp._instance.render();
            }
          }
        } catch (err) {
          ui.notifications.error(`Failed to load backup: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Raw JSON: Copy to clipboard
    const btnCopy = root.querySelector('.btn-copy-json');
    const textarea = root.querySelector('.dm-raw-textarea');
    btnCopy?.addEventListener('click', () => {
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          ui.notifications.info("Intoterica: Raw JSON copied to clipboard!");
        });
      }
    });

    // Raw JSON: Format
    const btnFormat = root.querySelector('.btn-format-json');
    btnFormat?.addEventListener('click', () => {
      if (textarea) {
        try {
          const parsed = JSON.parse(textarea.value);
          textarea.value = JSON.stringify(parsed, null, 2);
        } catch (err) {
          ui.notifications.error(`JSON Syntax Error: ${err.message}`);
        }
      }
    });

    // Raw JSON: Save
    const btnSave = root.querySelector('.btn-save-raw-json');
    btnSave?.addEventListener('click', async () => {
      if (!textarea) return;
      try {
        const parsed = JSON.parse(textarea.value);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error("JSON root must be an object.");
        }
        await game.settings.set('intoterica', 'data', parsed);
        ui.notifications.info("Intoterica: Data saved successfully!");
        this.render();
        if (window.IntotericaApp?._instance?.rendered) {
          window.IntotericaApp._instance.render();
        }
      } catch (err) {
        ui.notifications.error(`Cannot save invalid JSON: ${err.message}`);
      }
    });
  }

  static async migrateCharacterData(sourceId, targetId, options = {}) {
    const raw = game.settings.get('intoterica', 'data') || {};
    const data = foundry.utils.deepClone(raw);

    const counts = {
      quests: 0,
      factions: 0,
      badges: 0,
      messages: 0,
      history: 0,
      npcs: 0
    };

    const targetActor = game.actors.get(targetId);
    const targetName = targetActor?.name || targetId;

    // 1. Quests
    if (options.quests && Array.isArray(data.quests)) {
      for (const q of data.quests) {
        if (Array.isArray(q.assignedTo)) {
          if (q.assignedTo.includes(sourceId)) {
            q.assignedTo = q.assignedTo.map(id => id === sourceId ? targetId : id);
            q.assignedTo = Array.from(new Set(q.assignedTo));
            counts.quests++;
          }
        } else if (q.assignedTo === sourceId) {
          q.assignedTo = targetId;
          counts.quests++;
        }
      }
    }

    // 2. Factions
    if (options.factions && Array.isArray(data.factions)) {
      for (const f of data.factions) {
        if (!Array.isArray(f.members)) continue;
        const sourceIdx = f.members.findIndex(m => m.id === sourceId);
        if (sourceIdx !== -1) {
          const sourceMember = f.members[sourceIdx];
          const targetMember = f.members.find(m => m.id === targetId);

          if (targetMember) {
            targetMember.xp = Math.max(Number(targetMember.xp || 0), Number(sourceMember.xp || 0));
            targetMember.rank = Math.max(Number(targetMember.rank || 0), Number(sourceMember.rank || 0));
            if (sourceMember.notes && !targetMember.notes) targetMember.notes = sourceMember.notes;
            f.members.splice(sourceIdx, 1);
          } else {
            sourceMember.id = targetId;
            sourceMember.name = targetName;
          }
          counts.factions++;
        }
      }
    }

    // 3. Merit Badges / Achievements
    if (options.badges && Array.isArray(data.meritBadges)) {
      for (const b of data.meritBadges) {
        if (Array.isArray(b.earnedBy) && b.earnedBy.includes(sourceId)) {
          b.earnedBy = b.earnedBy.map(id => id === sourceId ? targetId : id);
          b.earnedBy = Array.from(new Set(b.earnedBy));
          counts.badges++;
        }
      }
    }

    // 4. Inbox & Mail Messages
    if (options.messages && Array.isArray(data.inbox)) {
      for (const m of data.inbox) {
        let changed = false;
        if (m.fromId === sourceId) {
          m.fromId = targetId;
          m.fromName = targetName;
          changed = true;
        }
        if (Array.isArray(m.to) && m.to.includes(sourceId)) {
          m.to = Array.from(new Set(m.to.map(id => id === sourceId ? targetId : id)));
          changed = true;
        }
        if (Array.isArray(m.cc) && m.cc.includes(sourceId)) {
          m.cc = Array.from(new Set(m.cc.map(id => id === sourceId ? targetId : id)));
          changed = true;
        }
        if (Array.isArray(m.read) && m.read.includes(sourceId)) {
          m.read = Array.from(new Set(m.read.map(id => id === sourceId ? targetId : id)));
          changed = true;
        }
        if (Array.isArray(m.archived) && m.archived.includes(sourceId)) {
          m.archived = Array.from(new Set(m.archived.map(id => id === sourceId ? targetId : id)));
          changed = true;
        }
        if (Array.isArray(m.star) && m.star.includes(sourceId)) {
          m.star = Array.from(new Set(m.star.map(id => id === sourceId ? targetId : id)));
          changed = true;
        }
        if (changed) counts.messages++;
      }
    }

    // 5. Profile History (hidden quests & manual additions)
    if (options.history) {
      if (!data.profileHistory) data.profileHistory = {};
      if (data.profileHistory[sourceId]) {
        const srcHistory = data.profileHistory[sourceId];
        if (!data.profileHistory[targetId]) {
          data.profileHistory[targetId] = { hidden: [], added: [] };
        }
        const tgtHistory = data.profileHistory[targetId];

        tgtHistory.hidden = Array.from(new Set([
          ...(tgtHistory.hidden || []),
          ...(srcHistory.hidden || [])
        ]));

        const existingAddedIds = new Set((tgtHistory.added || []).map(q => q.id));
        for (const q of (srcHistory.added || [])) {
          if (!existingAddedIds.has(q.id)) {
            tgtHistory.added = tgtHistory.added || [];
            tgtHistory.added.push(q);
          }
        }

        delete data.profileHistory[sourceId];
        counts.history++;
      }
    }

    // 6. Known NPCs
    if (options.npcs && Array.isArray(data.knownNPCs)) {
      if (data.knownNPCs.includes(sourceId)) {
        data.knownNPCs = Array.from(new Set(data.knownNPCs.map(id => id === sourceId ? targetId : id)));
        counts.npcs++;
      }
    }

    // Save
    await game.settings.set('intoterica', 'data', data);

    const summaryParts = [];
    if (counts.quests) summaryParts.push(`${counts.quests} quests`);
    if (counts.factions) summaryParts.push(`${counts.factions} factions`);
    if (counts.badges) summaryParts.push(`${counts.badges} badges`);
    if (counts.messages) summaryParts.push(`${counts.messages} messages`);
    if (counts.history) summaryParts.push(`${counts.history} profile history`);
    if (counts.npcs) summaryParts.push(`${counts.npcs} NPC flags`);

    return {
      counts,
      summary: summaryParts.length ? summaryParts.join(', ') : '0 items'
    };
  }
}

if (typeof window !== 'undefined') {
  window.IntotericaDataManager = IntotericaDataManager;
}

