import { DIFFICULTY_SCALES } from '../../core/constants.js';
import { formatMarkdown } from '../../core/dialog.js';
import { hasPermission } from '../../core/permissions.js';

export function getActiveDifficultyScale() {
  const scaleKey = game.settings.get('intoterica', 'difficultyScale') || 'standard';
  return DIFFICULTY_SCALES[scaleKey] || DIFFICULTY_SCALES['standard'];
}

export function getDifficultyInfo(diffName) {
  if (!diffName) return { id: "Medium", label: "Medium", color: "#f59f00", tier: 2 };
  const clean = String(diffName).trim();
  const activeList = getActiveDifficultyScale();
  
  // Check in active scale
  const directMatch = activeList.find(d => d.id.toLowerCase() === clean.toLowerCase() || d.label.toLowerCase() === clean.toLowerCase());
  if (directMatch) return directMatch;

  // Check across all defined scales
  for (const scale of Object.values(DIFFICULTY_SCALES)) {
    const match = scale.find(d => d.id.toLowerCase() === clean.toLowerCase() || d.label.toLowerCase() === clean.toLowerCase());
    if (match) return match;
  }

  return { id: clean, label: clean, color: "#f59f00", tier: 2 };
}

export function getDifficultyOptions(selectedDiff = "") {
  const activeList = getActiveDifficultyScale();
  const selectedClean = String(selectedDiff || '').trim().toLowerCase();
  
  let hasMatch = false;
  const optionsHtml = activeList.map(d => {
    const isSelected = selectedClean === d.id.toLowerCase() || selectedClean === d.label.toLowerCase();
    if (isSelected) hasMatch = true;
    return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${d.label}</option>`;
  }).join('');

  if (selectedDiff && !hasMatch) {
    return `<option value="${selectedDiff}" selected>${selectedDiff}</option>` + optionsHtml;
  }

  return optionsHtml;
}

export function getPlayerActors() {
  const userCharMap = new Map();
  for (const u of game.users) {
    if (!u.isGM && u.character) {
      userCharMap.set(u.character.id, u.character);
    }
  }

  const unassignedOwned = [];
  for (const a of game.actors) {
    if (a.hasPlayerOwner && !userCharMap.has(a.id)) {
      unassignedOwned.push(a);
    }
  }

  return [...userCharMap.values(), ...unassignedOwned];
}

export function getQuestGiverOptions(selectedGiver = "") {
  const selectedClean = String(selectedGiver || "").trim().toLowerCase();
  let hasMatch = false;
  let html = `<option value="">-- No Quest Giver --</option>`;

  const settings = game.settings.get('intoterica', 'data') || {};

  // 1. Known NPCs
  const knownNPCIds = settings.knownNPCs || [];
  const knownActors = knownNPCIds.map(id => typeof id === 'object' && id !== null ? id : game.actors?.get(id)).filter(Boolean);
  if (knownActors.length) {
    html += `<optgroup label="📜 Known NPCs">`;
    for (const npc of knownActors) {
      if (!npc.name) continue;
      const isSel = selectedClean === npc.name.toLowerCase() || (selectedClean && npc.id.toLowerCase() === selectedClean);
      if (isSel) hasMatch = true;
      html += `<option value="${Handlebars.escapeExpression(npc.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(npc.name)}</option>`;
    }
    html += `</optgroup>`;
  }

  // 2. Factions
  const factions = settings.factions || [];
  if (factions.length) {
    html += `<optgroup label="🛡️ Factions">`;
    for (const f of factions) {
      if (!f.name) continue;
      const isSel = selectedClean === f.name.toLowerCase();
      if (isSel) hasMatch = true;
      html += `<option value="${Handlebars.escapeExpression(f.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`;
    }
    html += `</optgroup>`;
  }

  // 3. Actors in Folders
  const actorFolders = game.folders ? game.folders.filter(f => f.type === 'Actor').sort((a, b) => a.name.localeCompare(b.name)) : [];
  for (const folder of actorFolders) {
    const folderActors = folder.contents || [];
    if (folderActors.length) {
      html += `<optgroup label="📁 ${Handlebars.escapeExpression(folder.name)}">`;
      for (const actor of folderActors) {
        const isSel = selectedClean === actor.name.toLowerCase() || (selectedClean && actor.id.toLowerCase() === selectedClean);
        if (isSel) hasMatch = true;
        html += `<option value="${Handlebars.escapeExpression(actor.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
      }
      html += `</optgroup>`;
    }
  }

  // 4. Root Actors
  const rootActors = game.actors ? game.actors.filter(a => !a.folder).sort((a, b) => a.name.localeCompare(b.name)) : [];
  if (rootActors.length) {
    html += `<optgroup label="👤 Root Actors">`;
    for (const actor of rootActors) {
      const isSel = selectedClean === actor.name.toLowerCase() || (selectedClean && actor.id.toLowerCase() === selectedClean);
      if (isSel) hasMatch = true;
      html += `<option value="${Handlebars.escapeExpression(actor.name)}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
    }
    html += `</optgroup>`;
  }

  // 5. Custom / Freeform fallback option
  if (selectedGiver && !hasMatch) {
    html = `<option value="${Handlebars.escapeExpression(selectedGiver)}" selected>${Handlebars.escapeExpression(selectedGiver)} (Custom)</option>` + html;
  }
  html += `<option value="__custom__">✏️ Custom Name...</option>`;

  return html;
}

export function getSystemCurrencies() {
  const hookCurrencies = {};
  try {
    Hooks.callAll('intoterica.getCurrencies', hookCurrencies);
    if (Object.keys(hookCurrencies).length > 0) return hookCurrencies;
  } catch (_e) {}

  try {
    if (game.modules?.get('mythcraft-essence-sheet')?.active) {
      let esCurrs = null;
      if (game.settings?.settings?.has('mythcraft-essence-sheet.customCurrencyConfig')) {
        esCurrs = game.settings.get('mythcraft-essence-sheet', 'customCurrencyConfig');
      }
      if (!esCurrs && typeof window.WalletDialog?.getActiveCurrencies === 'function') {
        esCurrs = window.WalletDialog.getActiveCurrencies();
      }
      if (Array.isArray(esCurrs) && esCurrs.length > 0) {
        const list = {};
        for (const c of esCurrs) {
          const key = c.key || c.abbr || c.id;
          const label = c.label || c.name || (key ? key.toUpperCase() : "");
          if (key) list[key] = label;
        }
        if (Object.keys(list).length > 0) return list;
      }
    }
  } catch (_e) {}

  try {
    if (game.modules?.get('monks-enhanced-journal')?.active) {
      let mejCurrs = null;
      if (game.settings?.settings?.has('monks-enhanced-journal.currency')) {
        mejCurrs = game.settings.get('monks-enhanced-journal', 'currency');
      }
      if (!mejCurrs && window.MonksEnhancedJournal?.currencies) {
        mejCurrs = window.MonksEnhancedJournal.currencies;
      }
      if (Array.isArray(mejCurrs) && mejCurrs.length > 0) {
        const list = {};
        for (const c of mejCurrs) {
          const key = c.id || c.key || c.abbr || c.name;
          const label = c.name || c.label || (key ? key.toUpperCase() : "");
          if (key) list[key] = label;
        }
        if (Object.keys(list).length > 0) return list;
      }
    }
  } catch (_e) {}

  try {
    if (game.modules?.get('item-piles')?.active) {
      const ipCurrencies = game.itempiles?.API?.CURRENCIES || 
                           (game.settings?.settings?.has('item-piles.currencies') ? game.settings.get('item-piles', 'currencies') : null) ||
                           CONFIG?.ITEM_PILES?.CURRENCIES;
      if (ipCurrencies) {
        const list = {};
        if (Array.isArray(ipCurrencies)) {
          for (const c of ipCurrencies) {
            const key = c.abbreviation || c.id || c.name || c.key;
            if (key) list[key] = c.name || c.label || key.toUpperCase();
          }
        } else if (typeof ipCurrencies === 'object') {
          for (const [k, v] of Object.entries(ipCurrencies)) {
            const label = typeof v === 'string' ? v : (v?.name || v?.label || k.toUpperCase());
            list[k] = label;
          }
        }
        if (Object.keys(list).length > 0) return list;
      }
    }
  } catch (_e) {}

  try {
    if (game.modules?.get('beavers-currency')?.active || game.modules?.get('beavers-crafting')?.active || window.beaversSystemInterface) {
      const beaversCurrs = window.beaversSystemInterface?.configCurrencies || 
                           (game.settings?.settings?.has('beavers-currency.currencies') ? game.settings.get('beavers-currency', 'currencies') : null) ||
                           (game.settings?.settings?.has('beavers-crafting.currencies') ? game.settings.get('beavers-crafting', 'currencies') : null);
      if (beaversCurrs && typeof beaversCurrs === 'object') {
        const list = {};
        const entries = Array.isArray(beaversCurrs) ? beaversCurrs : Object.entries(beaversCurrs);
        for (const item of entries) {
          const c = Array.isArray(beaversCurrs) ? item : item[1];
          const k = c?.id || c?.key || c?.abbreviation || c?.name || (Array.isArray(beaversCurrs) ? null : item[0]);
          if (k) list[k] = c?.label || c?.name || k.toUpperCase();
        }
        if (Object.keys(list).length > 0) return list;
      }
    }
  } catch (_e) {}

  const customCurrencyModuleIds = [
    'dnd5e-custom-currency',
    'custom-currency',
    'currency-manager',
    'world-currency-5e',
    'currency-converter',
    'custom-currencies'
  ];
  for (const modId of customCurrencyModuleIds) {
    if (game.modules?.get(modId)?.active) {
      try {
        const keys = [`${modId}.currencies`, `${modId}.currency`, `${modId}.customCurrencies`, `${modId}.customCurrencyConfig`];
        for (const k of keys) {
          if (game.settings?.settings?.has(k)) {
            const val = game.settings.get(modId, k.split('.')[1]);
            if (val && typeof val === 'object') {
              const list = {};
              const entries = Array.isArray(val) ? val : Object.entries(val);
              for (const item of entries) {
                const c = Array.isArray(val) ? item : item[1];
                const key = c?.abbreviation || c?.id || c?.key || c?.abbr || c?.name || (Array.isArray(val) ? null : item[0]);
                if (key) list[key] = c?.name || c?.label || key.toUpperCase();
              }
              if (Object.keys(list).length > 0) return list;
            }
          }
        }
      } catch (_e) {}
    }
  }

  try {
    if (game.settings?.settings) {
      for (const [fullKey, setting] of game.settings.settings.entries()) {
        const modId = fullKey.split('.')[0];
        if (modId === 'intoterica') continue;
        const mod = game.modules?.get(modId);
        if (!mod || !mod.active) continue;
        const settingName = fullKey.split('.').slice(1).join('.');
        if (/currenc|denomination/i.test(settingName)) {
          try {
            const val = game.settings.get(modId, settingName);
            if (Array.isArray(val) && val.length > 0) {
              const list = {};
              for (const c of val) {
                if (!c || typeof c !== 'object') continue;
                const key = c.key || c.abbr || c.id || c.abbreviation || c.name;
                const label = c.label || c.name || (key ? key.toUpperCase() : "");
                if (key) list[key] = label;
              }
              if (Object.keys(list).length > 0) return list;
            } else if (val && typeof val === 'object') {
              const list = {};
              for (const [k, v] of Object.entries(val)) {
                if (v && typeof v === 'object') {
                  const key = v.key || v.abbr || v.id || v.abbreviation || k;
                  list[key] = v.label || v.name || key.toUpperCase();
                } else if (typeof v === 'string') {
                  list[k] = v;
                }
              }
              if (Object.keys(list).length > 0) return list;
            }
          } catch (_e) {}
        }
      }
    }
  } catch (_e) {}

  if (CONFIG?.currencies && typeof CONFIG.currencies === 'object' && Object.keys(CONFIG.currencies).length > 0) {
    const list = {};
    for (const [key, val] of Object.entries(CONFIG.currencies)) {
      list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
    }
    return list;
  }

  const sysId = game.system?.id;
  if (sysId) {
    const upperSys = sysId.toUpperCase();
    if (CONFIG?.[upperSys]?.currencies) {
      const list = {};
      for (const [key, val] of Object.entries(CONFIG[upperSys].currencies)) {
        list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
      }
      return list;
    }
    if (CONFIG?.[sysId]?.currencies) {
      const list = {};
      for (const [key, val] of Object.entries(CONFIG[sysId].currencies)) {
        list[key] = typeof val === 'string' ? val : (val.label || val.name || key.toUpperCase());
      }
      return list;
    }
  }

  if (CONFIG?.DND5E?.currencies) {
    const list = {};
    for (const [key, val] of Object.entries(CONFIG.DND5E.currencies)) {
      list[key] = val.label || val.name || key.toUpperCase();
    }
    return list;
  }
  if (CONFIG?.PF2E?.currencies) {
    const list = {};
    for (const [key, val] of Object.entries(CONFIG.PF2E.currencies)) {
      list[key] = typeof val === 'string' ? val : (val.label || key.toUpperCase());
    }
    return list;
  }

  const playerActors = getPlayerActors();
  const candidateActors = playerActors.length > 0 ? playerActors : Array.from(game.actors || []);
  for (const actor of candidateActors) {
    const curr = actor.system?.currency || actor.system?.currencies || actor.system?.wealth || actor.system?.coins || actor.system?.money || actor.system?.attributes?.currency;
    if (curr && typeof curr === 'object' && !Array.isArray(curr)) {
      const list = {};
      for (const [k, v] of Object.entries(curr)) {
        if (['notes', 'description', 'details', 'special', 'override'].includes(k.toLowerCase())) continue;
        if (typeof v === 'number' || typeof v === 'string' || (v && typeof v === 'object')) {
          list[k] = k.toUpperCase();
        }
      }
      if (Object.keys(list).length > 0) return list;
    }
  }

  for (const actor of candidateActors) {
    const currencyItems = actor.items?.filter?.(i => i.type === 'currency' || i.type === 'coin' || i.type === 'money' || i.type === 'wealth') || [];
    if (currencyItems.length > 0) {
      const list = {};
      for (const item of currencyItems) {
        const k = item.name.toLowerCase().replace(/\s+/g, '_');
        list[k] = item.name.toUpperCase();
      }
      if (Object.keys(list).length > 0) return list;
    }
  }

  try {
    const sysActorTemplate = game.system?.template?.Actor?.templates?.common || game.system?.template?.Actor?.character || game.system?.model?.Actor?.character;
    const modelCurr = sysActorTemplate?.currency || sysActorTemplate?.currencies || sysActorTemplate?.wealth || sysActorTemplate?.coins;
    if (modelCurr && typeof modelCurr === 'object') {
      const list = {};
      for (const k of Object.keys(modelCurr)) {
        list[k] = k.toUpperCase();
      }
      if (Object.keys(list).length > 0) return list;
    }
  } catch (_e) {}

  return {
    gp: "GP (Gold)",
    sp: "SP (Silver)",
    cp: "CP (Copper)"
  };
}

export async function addCurrencyToActor(actor, currencies, splitDivisor = 1) {
  if (!actor || !currencies || typeof currencies !== 'object') return;
  
  if (game.modules?.get('item-piles')?.active && game.itempiles?.API?.addCurrency) {
    try {
      const ipUpdates = {};
      for (const [denom, amount] of Object.entries(currencies)) {
        const rawVal = Number(amount) || 0;
        const addVal = splitDivisor > 1 ? Math.floor(rawVal / splitDivisor) : rawVal;
        if (addVal > 0) ipUpdates[denom] = addVal;
      }
      if (Object.keys(ipUpdates).length > 0) {
        await game.itempiles.API.addCurrency(actor, ipUpdates);
        return;
      }
    } catch (_e) {}
  }

  const updates = {};
  const sysCurr = actor.system?.currency || actor.system?.currencies || actor.system?.wealth || actor.system?.coins || actor.system?.money || actor.system?.attributes?.currency;
  const currPath = actor.system?.currency !== undefined ? 'system.currency' :
                   (actor.system?.currencies !== undefined ? 'system.currencies' :
                   (actor.system?.wealth !== undefined ? 'system.wealth' :
                   (actor.system?.coins !== undefined ? 'system.coins' :
                   (actor.system?.money !== undefined ? 'system.money' :
                   (actor.system?.attributes?.currency !== undefined ? 'system.attributes.currency' : 'system.currency')))));

  for (const [denom, amount] of Object.entries(currencies)) {
    const rawVal = Number(amount) || 0;
    if (rawVal <= 0) continue;
    const addVal = splitDivisor > 1 ? Math.floor(rawVal / splitDivisor) : rawVal;
    if (addVal <= 0) continue;

    let targetDenom = denom;
    if (game.system?.id === 'mythcraft') {
      const dLower = denom.toLowerCase();
      if (dLower === 'amber' || dLower === 'a' || dLower === 'astra') targetDenom = 'astra';
      else if (dLower === 'scillings' || dLower === 'sc' || dLower === 'silver') targetDenom = 'scillings';
      else if (dLower === 'qorn' || dLower === 'q' || dLower === 'quints') targetDenom = 'quints';
      else if (dLower === 'diamond' || dLower === 'dc' || dLower === 'denarii') targetDenom = 'denarii';
    }

    if (sysCurr && typeof sysCurr[targetDenom] === 'number') {
      updates[`${currPath}.${targetDenom}`] = (sysCurr[targetDenom] || 0) + addVal;
    } else if (sysCurr && typeof sysCurr[targetDenom] === 'object' && sysCurr[targetDenom] !== null && 'value' in sysCurr[targetDenom]) {
      updates[`${currPath}.${targetDenom}.value`] = (Number(sysCurr[targetDenom].value) || 0) + addVal;
    } else {
      const current = foundry.utils.getProperty(actor, `${currPath}.${targetDenom}`) || 0;
      updates[`${currPath}.${targetDenom}`] = Number(current) + addVal;
    }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await actor.update(updates);
    } catch (e) {
      console.warn("Intoterica | Failed to update currency for actor:", actor.name, e);
    }
  }
}

export async function grantItemsToActor(actor, items) {
  if (!actor || !Array.isArray(items) || items.length === 0) return;
  const docsToCreate = [];
  for (const item of items) {
    let docData = null;
    if (item.uuid) {
      try {
        const source = await fromUuid(item.uuid);
        if (source) docData = source.toObject();
      } catch (e) {}
    }
    if (!docData && item.itemData) {
      docData = foundry.utils.duplicate(item.itemData);
    }
    if (!docData) {
      docData = {
        name: item.name || "Quest Reward Item",
        type: item.type || "loot",
        img: item.img || "icons/svg/item-bag.svg",
        system: {}
      };
    }
    delete docData._id;
    const qty = Number(item.quantity) || 1;
    if (docData.system) {
      if ('quantity' in docData.system) docData.system.quantity = qty;
      else if ('qty' in docData.system) docData.system.qty = qty;
    }
    docsToCreate.push(docData);
  }

  if (docsToCreate.length > 0) {
    try {
      await actor.createEmbeddedDocuments("Item", docsToCreate);
    } catch (e) {
      console.warn("Intoterica | Error creating embedded items for actor:", actor.name, e);
    }
  }
}

export function prepareQuestsContext(settings, app, perms = {}) {
  // Support both (settings, app, perms) and (app, settings, perms)
  if (settings && typeof settings.render === 'function') {
    const tmp = settings;
    settings = app;
    app = tmp;
  }
  settings = settings || game.settings.get('intoterica', 'data') || {};
  app = app || {};
  perms = perms || {};

  const rawQuests = settings.quests || [];
  const myActors = game.actors ? game.actors.filter(a => a.isOwner || (typeof a.testUserPermission === 'function' && a.testUserPermission(game.user, "OWNER"))) : [];
  const myActorIds = myActors.map(a => a.id);
  if (game.user.character && !myActorIds.includes(game.user.character.id)) {
    myActorIds.push(game.user.character.id);
  }
  const myActorNames = myActors.map(a => a.name?.trim().toLowerCase()).filter(Boolean);
  if (game.user.character?.name) {
    const charName = game.user.character.name.trim().toLowerCase();
    if (!myActorNames.includes(charName)) myActorNames.push(charName);
  }

  const isGM = Boolean(game.user.isGM);
  const canEditQuests = isGM || Boolean(perms.quests || (typeof hasPermission === 'function' && hasPermission('permQuests')));

  const processedQuests = rawQuests.map(q => {
    let currentSubstory = false;
    const tasks = (Array.isArray(q.tasks) ? q.tasks : []).map(t => {
      const isSubstory = Boolean(t.isSubstory || t.isSubquest);
      if (isSubstory) currentSubstory = true;
      return {
        ...t,
        isSubstory,
        isSubquest: isSubstory,
        isSubstoryChild: !isSubstory && currentSubstory,
        isSubquestChild: !isSubstory && currentSubstory,
        completed: Boolean(t.completed),
        failed: Boolean(t.failed),
        optional: Boolean(t.optional),
        hidden: Boolean(t.hidden)
      };
    });
    const visibleTasks = canEditQuests ? tasks : tasks.filter(t => !t.hidden);
    const totalTasks = visibleTasks.length;
    const completedTasks = visibleTasks.filter(t => t.completed && !t.failed).length;
    const failedTasks = visibleTasks.filter(t => t.failed).length;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (q.status === 'Completed' ? 100 : 0);
    
    const isAssignAll = q.assignedAll !== false && (!q.assignedTo || q.assignedTo.length === 0);
    const assignedTo = Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []);
    const assignedActors = assignedTo.map(id => game.actors?.get(id)).filter(Boolean);
    const assignedNames = isAssignAll ? "Whole Party" : (assignedActors.map(a => a.name).join(', ') || "Whole Party");

    const isExpanded = app.expandedQuestIds?.has(q.id);
    const isPrimary = !!q.isPrimary;
    const rewards = q.rewards || {};

    const diffInfo = getDifficultyInfo(q.difficulty);
    const difficulty = diffInfo.label || q.difficulty || "Medium";
    const difficultyColor = diffInfo.color || "#f59f00";
    const difficultyTier = diffInfo.tier || 2;
    const commissionedFaction = q.commissionedFaction || "";
    const giver = q.giver || "";
    const title = q.title || q.name || "Untitled Quest";

    const descriptionHtml = formatMarkdown(q.description || "");

    const factionXpList = Array.isArray(rewards.factionXp) ? rewards.factionXp.filter(fx => Number(fx.amount) > 0) : [];
    const reputationsList = Array.isArray(rewards.reputations)
      ? rewards.reputations.filter(r => Number(r.amount) !== 0)
      : (rewards.reputation && Number(rewards.reputation.amount) !== 0 ? [rewards.reputation] : []);
    const repData = reputationsList[0] || null;
    const currencyList = rewards.currencies && typeof rewards.currencies === 'object' 
      ? Object.entries(rewards.currencies).filter(([k, v]) => Number(v) > 0).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(', ')
      : (rewards.currency || "");
    const itemsList = Array.isArray(rewards.items) ? rewards.items : [];
    const hasAnyRewards = Boolean(factionXpList.length > 0 || reputationsList.length > 0 || currencyList || itemsList.length > 0 || rewards.xp || rewards.text);

    let rewardValue = Number(rewards.xp || 0);
    for (const fx of factionXpList) {
      rewardValue += Number(fx.amount || 0);
    }
    if (rewards.currencies && typeof rewards.currencies === 'object') {
      for (const [k, v] of Object.entries(rewards.currencies)) {
        const num = Number(v) || 0;
        if (/sp\b|silver/i.test(k)) rewardValue += num * 0.1;
        else if (/cp\b|copper/i.test(k)) rewardValue += num * 0.01;
        else if (/pp\b|plat/i.test(k)) rewardValue += num * 10;
        else rewardValue += num;
      }
    } else if (rewards.currency) {
      const numMatch = String(rewards.currency).match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (/sp\b|silver/i.test(rewards.currency)) rewardValue += val * 0.1;
        else if (/cp\b|copper/i.test(rewards.currency)) rewardValue += val * 0.01;
        else rewardValue += val;
      }
    }
    rewardValue += itemsList.length * 10;

    const rawStatus = q.status === 'Hidden' ? (q._prevStatus || 'Active') : (q.status || 'Active');
    const isHidden = Boolean(q.hidden || q.status === 'Hidden');

    return {
      ...q,
      status: rawStatus,
      hidden: isHidden,
      title,
      name: title,
      descriptionHtml,
      tasks,
      totalTasks,
      completedTasks,
      taskProgress,
      isAssignAll,
      assignedTo,
      assignedActors,
      assignedNames,
      isExpanded,
      isPrimary,
      rewards: {
        ...rewards,
        factionXpList,
        reputationsList,
        repData,
        currencyList,
        itemsList,
        hasAnyRewards
      },
      difficulty,
      difficultyColor,
      difficultyTier,
      commissionedFaction,
      giver,
      rewardValue
    };
  });

  const visibleQuests = processedQuests.filter(q => {
    if (canEditQuests) return true;
    if (q.hidden) return false;
    if (q.assignedAll === true || q.isAssignAll || (!q.assignedTo || q.assignedTo.length === 0)) return true;
    const assigned = Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []);
    return assigned.some(id => 
      myActorIds.includes(id) || 
      id === game.user.id || 
      (game.user.character && id === game.user.character.id) ||
      (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase()))
    );
  });

  if (!app.questFilter || app.questFilter === 'all') {
    app.questFilter = 'active';
  }

  const questStats = {
    active: visibleQuests.filter(q => q.status === 'Active').length,
    available: visibleQuests.filter(q => q.status === 'Available' || q.status === 'Inactive').length,
    completed: visibleQuests.filter(q => q.status === 'Completed').length,
    failed: visibleQuests.filter(q => q.status === 'Failed').length
  };

  const questFilterFactions = Array.from(new Set([
    ...(settings.factions || []).map(f => f.name).filter(Boolean),
    ...visibleQuests.map(q => q.commissionedFaction).filter(Boolean)
  ])).sort();

  const questFilterGivers = Array.from(new Set([
    ...(settings.knownNPCs || []).map(id => typeof id === 'object' && id ? id.name : game.actors?.get(id)?.name).filter(Boolean),
    ...visibleQuests.map(q => q.giver).filter(Boolean)
  ])).sort();

  const questFilterDifficulties = getActiveDifficultyScale();

  let filteredQuests = visibleQuests;
  if (app.questFilter === 'available') {
    filteredQuests = visibleQuests.filter(q => (q.status || '').toLowerCase() === 'available' || (q.status || '').toLowerCase() === 'inactive');
  } else if (app.questFilter) {
    filteredQuests = visibleQuests.filter(q => (q.status || '').toLowerCase() === app.questFilter.toLowerCase());
  }

  if (app.questFactionFilter) {
    filteredQuests = filteredQuests.filter(q => (q.commissionedFaction || '').toLowerCase() === app.questFactionFilter.toLowerCase());
  }

  if (app.questGiverFilter) {
    filteredQuests = filteredQuests.filter(q => (q.giver || '').toLowerCase() === app.questGiverFilter.toLowerCase());
  }

  if (app.questDifficultyFilter) {
    const targetDiff = app.questDifficultyFilter.toLowerCase();
    filteredQuests = filteredQuests.filter(q => {
      const info = getDifficultyInfo(q.difficulty);
      return info.id.toLowerCase() === targetDiff || info.label.toLowerCase() === targetDiff || (q.difficulty || '').toLowerCase() === targetDiff;
    });
  }

  const searchQuery = (app.questSearch || '').trim().toLowerCase();
  if (searchQuery) {
    filteredQuests = filteredQuests.filter(q => {
      const titleMatch = (q.title || '').toLowerCase().includes(searchQuery);
      const giverMatch = (q.giver || '').toLowerCase().includes(searchQuery);
      const factionMatch = (q.commissionedFaction || '').toLowerCase().includes(searchQuery);
      const descMatch = (q.description || '').toLowerCase().includes(searchQuery);
      const taskMatch = (q.tasks || []).some(t => (t.text || '').toLowerCase().includes(searchQuery));
      return titleMatch || giverMatch || factionMatch || descMatch || taskMatch;
    });
  }

  const sort = app.questSort || 'default';
  if (sort === 'title-asc') {
    filteredQuests.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sort === 'title-desc') {
    filteredQuests.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  } else if (sort === 'diff-asc') {
    filteredQuests.sort((a, b) => (a.difficultyTier - b.difficultyTier) || (a.title || '').localeCompare(b.title || ''));
  } else if (sort === 'diff-desc') {
    filteredQuests.sort((a, b) => (b.difficultyTier - a.difficultyTier) || (a.title || '').localeCompare(b.title || ''));
  } else if (sort === 'reward-desc') {
    filteredQuests.sort((a, b) => (b.rewardValue - a.rewardValue));
  } else if (sort === 'reward-asc') {
    filteredQuests.sort((a, b) => (a.rewardValue - b.rewardValue));
  } else if (sort === 'progress-desc') {
    filteredQuests.sort((a, b) => (b.taskProgress - a.taskProgress));
  } else if (sort === 'progress-asc') {
    filteredQuests.sort((a, b) => (a.taskProgress - b.taskProgress));
  } else {
    const sortOrder = { "Active": 0, "Available": 1, "Inactive": 1, "Completed": 2, "Failed": 3 };
    filteredQuests.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9);
    });
  }

  const hasActiveFilters = Boolean(app.questFactionFilter || app.questGiverFilter || app.questDifficultyFilter || (app.questSort && app.questSort !== 'default'));
  const activeFilterCount = (app.questFactionFilter ? 1 : 0) + (app.questGiverFilter ? 1 : 0) + (app.questDifficultyFilter ? 1 : 0) + ((app.questSort && app.questSort !== 'default') ? 1 : 0);

  return {
    quests: filteredQuests,
    filteredQuests,
    processedQuests,
    allQuests: processedQuests,
    visibleQuests,
    activeQuests: visibleQuests.filter(q => q.status === 'Active'),
    questStats,
    questFilter: app.questFilter,
    questSearch: app.questSearch,
    questGiverFilter: app.questGiverFilter,
    questFactionFilter: app.questFactionFilter,
    questDifficultyFilter: app.questDifficultyFilter,
    questSort: app.questSort,
    questFilterFactions,
    questFilterGivers,
    questFilterDifficulties,
    showAdvancedFilters: app.showAdvancedFilters,
    hasActiveFilters,
    activeFilterCount
  };
}

