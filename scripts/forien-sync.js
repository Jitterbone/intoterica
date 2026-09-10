/**
 * Forien's Quest Log Data Integration & Synchronizer for Intoterica
 */

export class ForienQuestSync {
  /**
   * Check if Forien's Quest Log module is installed in the world.
   * @returns {boolean}
   */
  static isInstalled() {
    return Boolean(game.modules.get('forien-quest-log'));
  }

  /**
   * Check if Forien's Quest Log module is currently active.
   * @returns {boolean}
   */
  static isActive() {
    return Boolean(game.modules.get('forien-quest-log')?.active);
  }

  /**
   * Find all JournalEntry documents in the world that contain Forien's Quest Log data.
   * @returns {JournalEntry[]}
   */
  static getForienJournals() {
    return game.journal.contents.filter(j => {
      const flags = j.flags?.['forien-quest-log'];
      return flags && (flags.json || flags._quest || flags.name || flags.status);
    });
  }

  /**
   * Parse a single Forien JournalEntry into Intoterica Quest format.
   * @param {JournalEntry} journal
   * @returns {object|null}
   */
  static parseQuest(journal) {
    if (!journal) return null;
    const flags = journal.flags?.['forien-quest-log'] || {};
    const raw = flags.json || flags;

    const title = raw.name || journal.name || "Untitled Quest";
    
    // Status mapping: 'active' | 'completed' | 'failed' | 'available' | 'inactive'
    let status = "Active";
    const rawStatus = String(raw.status || '').toLowerCase();
    if (rawStatus === 'completed') status = "Completed";
    else if (rawStatus === 'failed') status = "Failed";
    else if (rawStatus === 'available') status = "Available";
    else if (rawStatus === 'inactive') status = "Inactive";
    else status = "Active";

    // Description extraction
    let description = raw.description || "";
    if (!description && journal.pages?.contents?.length) {
      const textPage = journal.pages.contents.find(p => p.type === 'text');
      if (textPage?.text?.content) {
        description = textPage.text.content;
      }
    }

    // Tasks / Objectives
    const tasks = (raw.tasks || []).map(t => ({
      id: t.uuidv4 || foundry.utils.randomID(),
      text: t.name || t.text || "Objective",
      completed: Boolean(t.completed),
      optional: Boolean(t.optional)
    }));

    // Rewards
    let rewardXp = 0;
    let rewardCurrency = "";
    const rewardTexts = [];

    if (Array.isArray(raw.rewards)) {
      for (const r of raw.rewards) {
        const rData = r.data || {};
        const rName = rData.name || r.name || "";
        if (!rName) continue;

        // Try extracting XP or currency from text
        const xpMatch = rName.match(/(\d+)\s*(?:xp|experience)/i);
        if (xpMatch) {
          rewardXp += parseInt(xpMatch[1], 10);
        } else if (/\b(?:gp|sp|cp|gold|silver|credits)\b/i.test(rName)) {
          rewardCurrency = rewardCurrency ? `${rewardCurrency}, ${rName}` : rName;
        } else {
          rewardTexts.push(rName);
        }
      }
    } else if (typeof raw.rewards === 'object' && raw.rewards !== null) {
      rewardXp = Number(raw.rewards.xp || 0);
      rewardCurrency = String(raw.rewards.currency || "");
      if (raw.rewards.text) rewardTexts.push(raw.rewards.text);
    }

    // Quest Image / Splash
    let image = raw.splash || raw.image || "";
    if (!image || image === 'actor' || image === 'token') {
      const imgPage = journal.pages?.contents?.find(p => p.type === 'image');
      image = imgPage?.src || "icons/svg/book.svg";
    }

    // Giver Name
    let giver = raw.giverName || "";
    if (!giver && typeof raw.giver === 'string' && raw.giver !== 'abstract') {
      const giverDoc = fromUuidSync?.(raw.giver);
      if (giverDoc) giver = giverDoc.name || "";
    }

    // Primary Quest check
    let isPrimary = Boolean(raw.isPrimary);
    try {
      if (game.settings.settings.has('forien-quest-log.primary-quest')) {
        const primaryId = game.settings.get('forien-quest-log', 'primary-quest');
        if (primaryId === journal.id) isPrimary = true;
      }
    } catch (_e) {}

    return {
      forienQuestId: journal.id,
      title,
      description,
      status,
      difficulty: raw.difficulty || "Medium",
      giver,
      image,
      tasks,
      rewards: {
        xp: rewardXp,
        currency: rewardCurrency,
        text: rewardTexts.join(', ')
      },
      gmNotes: raw.gmnotes || "",
      isPrimary,
      date: raw.date?.create ? new Date(raw.date.create).toLocaleDateString() : ""
    };
  }

  /**
   * Sync and merge all Forien quests into Intoterica data.
   * @param {object} options
   * @param {boolean} [options.notify=false]
   * @returns {Promise<{created: number, updated: number, total: number}>}
   */
  static async sync({ notify = false } = {}) {
    const raw = game.settings.get('intoterica', 'data') || {};
    const data = foundry.utils.deepClone(raw);
    data.quests = Array.isArray(data.quests) ? data.quests : [];

    const journals = ForienQuestSync.getForienJournals();
    if (!journals.length) {
      if (notify) ui.notifications.warn("Intoterica: No quests found in Forien's Quest Log.");
      return { created: 0, updated: 0, total: 0 };
    }

    let created = 0;
    let updated = 0;

    for (const journal of journals) {
      const parsed = ForienQuestSync.parseQuest(journal);
      if (!parsed) continue;

      // Find existing quest by forienQuestId or matching title
      const existing = data.quests.find(q => q.forienQuestId === journal.id || q.title === parsed.title);

      if (existing) {
        // Update fields while preserving player assignments & manual settings
        existing.forienQuestId = journal.id;
        existing.title = parsed.title;
        existing.description = parsed.description;
        existing.status = parsed.status;
        existing.difficulty = parsed.difficulty || existing.difficulty || "Medium";
        existing.giver = parsed.giver || existing.giver || "";
        existing.image = parsed.image || existing.image || "";
        existing.tasks = parsed.tasks.length ? parsed.tasks : existing.tasks;
        existing.rewards = parsed.rewards;
        existing.gmNotes = parsed.gmNotes || existing.gmNotes || "";
        existing.isPrimary = parsed.isPrimary;
        if (!existing.assignedTo) existing.assignedTo = [];
        updated++;
      } else {
        // Add new quest
        data.quests.push({
          id: foundry.utils.randomID(),
          ...parsed,
          assignedTo: []
        });
        created++;
      }
    }

    await game.settings.set('intoterica', 'data', data);

    if (notify) {
      ui.notifications.info(`Intoterica: Synced ${created + updated} quests from Forien's Quest Log (${created} imported, ${updated} updated).`);
    }

    return { created, updated, total: created + updated };
  }
}

if (typeof window !== 'undefined') {
  window.ForienQuestSync = ForienQuestSync;
}

