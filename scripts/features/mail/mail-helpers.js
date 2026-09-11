/**
 * Intoterica Mail Helpers
 * Read status calculations, sender options generation, and mail context preparation
 */

/**
 * Checks if a specific mail message is unread for the given user.
 * @param {Object} message - Mail message object
 * @param {User} [user=game.user] - Foundry user
 * @returns {boolean}
 */
export function isMessageUnreadForUser(message, user = game.user) {
  if (!message || !user) return false;
  const userId = user.id;

  // 1. Check User Document flags (100% persisted per-client on User doc across all refreshes)
  const userFlagReads = user.getFlag?.('intoterica', 'readMessageIds') || [];
  const normSub = (message.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
  if (userFlagReads.includes(message.id) || (normSub && userFlagReads.includes(normSub))) {
    return false;
  }

  // 2. If readBy array exists and already contains this user ID, it is definitely READ
  if (Array.isArray(message.readBy) && message.readBy.includes(userId)) {
    return false;
  }

  // 3. Identify actor IDs and names owned by this user
  const myActors = game.actors ? game.actors.filter(a => a.isOwner || (user.character && a.id === user.character.id)) : [];
  const myActorIds = myActors.map(a => a.id);
  const myActorNames = myActors.map(a => a.name?.trim().toLowerCase()).filter(Boolean);

  // 4. If this user was the sender/author, it is NOT unread for them
  if (message.fromId === userId || message.fromId === `user:${userId}` || myActorIds.includes(message.fromId)) {
    return false;
  }
  if (message.from && typeof message.from === 'string' && myActorNames.includes(message.from.trim().toLowerCase())) {
    return false;
  }

  // 5. For non-GMs, only consider messages where the user is an intended recipient
  if (!user.isGM) {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    const cc = Array.isArray(message.cc) ? message.cc : [message.cc];
    const allRecipients = [...to, ...cc].filter(Boolean);

    const isRecipient = allRecipients.some(id => {
      if (id === userId || id === `user:${userId}`) return true;
      if (myActorIds.includes(id)) return true;
      if (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase())) return true;
      return false;
    });

    if (!isRecipient) return false;
  }

  // 6. If readBy exists and user is not in it, it is UNREAD
  if (Array.isArray(message.readBy)) {
    return !message.readBy.includes(userId);
  }

  // 7. Legacy fallback
  return message.status === 'unread';
}

/**
 * Marks messages as read for a given user.
 * @param {string|string[]} messageIdsOrSubjects
 * @param {User} [user=game.user]
 */
export async function markMessagesAsReadForUser(messageIdsOrSubjects, user = game.user) {
  if (!messageIdsOrSubjects || !user) return;
  const rawList = Array.isArray(messageIdsOrSubjects) ? messageIdsOrSubjects : [messageIdsOrSubjects];
  const items = rawList.filter(Boolean);
  if (items.length === 0) return;

  // 1. Update user flag (direct User document persistence, works for all users without GM restrictions)
  const existing = user.getFlag?.('intoterica', 'readMessageIds') || [];
  const updatedFlags = Array.from(new Set([
    ...existing,
    ...items.map(s => String(s).toLowerCase()),
    ...items
  ]));
  await user.setFlag('intoterica', 'readMessageIds', updatedFlags);

  // 2. If GM, also update world settings. If not GM, dispatch to GM via socket.
  if (game.user.isGM) {
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    let updated = false;

    (settings.inbox || []).forEach(m => {
      const norm = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      if (items.includes(m.id) || items.some(it => String(it).toLowerCase() === norm)) {
        if (!Array.isArray(m.readBy)) m.readBy = [];
        if (!m.readBy.includes(user.id)) {
          m.readBy.push(user.id);
          updated = true;
        }
        if (m.status !== 'read') {
          m.status = 'read';
          updated = true;
        }
      }
    });

    if (updated) {
      const instance = window.IntotericaApp?._instance;
      if (instance) {
        await instance._saveData(settings);
        instance._broadcastUpdate();
      } else {
        await game.settings.set('intoterica', 'data', settings);
      }
    }
  } else {
    game.socket.emit('module.intoterica', {
      type: 'dispatch',
      action: 'markReadMultiple',
      payload: { items, userId: user.id }
    });
  }

  window.IntotericaSceneBadges?.();
  if (window.IntotericaApp?._instance?.rendered) {
    window.IntotericaApp._instance.render();
  }
}

/**
 * Returns count of unread messages for the current user.
 * @param {User} [user=game.user]
 * @returns {number}
 */
export function getUnreadMailCount(user = game.user) {
  const settings = game.settings.get('intoterica', 'data') || {};
  const inbox = settings.inbox || [];
  return inbox.filter(m => isMessageUnreadForUser(m, user)).length;
}

/**
 * Generates sender dropdown options HTML.
 * @param {string} [selectedFromId=""] 
 * @param {boolean} [isGM=false] 
 * @returns {string}
 */
export function getMailSenderOptions(selectedFromId = "", isGM = false) {
  const selectedClean = String(selectedFromId || "").trim().toLowerCase();
  let hasMatch = false;
  let html = "";

  const settings = game.settings.get('intoterica', 'data') || {};

  if (isGM) {
    // 1. Known NPCs
    const knownNPCIds = settings.knownNPCs || [];
    const knownActors = knownNPCIds.map(id => typeof id === 'object' && id !== null ? id : game.actors?.get(id)).filter(Boolean);
    if (knownActors.length) {
      html += `<optgroup label="📜 Known NPCs">`;
      for (const npc of knownActors) {
        if (!npc.name) continue;
        const isSel = selectedClean === npc.id.toLowerCase() || selectedClean === npc.name.toLowerCase();
        if (isSel) hasMatch = true;
        html += `<option value="${npc.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(npc.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 2. Factions & Organizations
    const factions = settings.factions || [];
    if (factions.length) {
      html += `<optgroup label="🛡️ Factions & Organizations">`;
      for (const f of factions) {
        if (!f.name) continue;
        const val = `faction:${f.id}`;
        const isSel = selectedClean === val.toLowerCase() || selectedClean === f.id.toLowerCase() || selectedClean === f.name.toLowerCase();
        if (isSel) hasMatch = true;
        html += `<option value="${val}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(f.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 3. Actors in Folders (Foundry Folder File Structure)
    const actorFolders = game.folders ? game.folders.filter(f => f.type === 'Actor').sort((a, b) => a.name.localeCompare(b.name)) : [];
    for (const folder of actorFolders) {
      const folderActors = folder.contents || [];
      if (folderActors.length) {
        html += `<optgroup label="📁 ${Handlebars.escapeExpression(folder.name)}">`;
        for (const actor of folderActors) {
          const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
          if (isSel) hasMatch = true;
          html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
        }
        html += `</optgroup>`;
      }
    }

    // 4. Root Actors
    const rootActors = game.actors ? game.actors.filter(a => !a.folder).sort((a, b) => a.name.localeCompare(b.name)) : [];
    if (rootActors.length) {
      html += `<optgroup label="👤 Root Actors & Characters">`;
      for (const actor of rootActors) {
        const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
        if (isSel) hasMatch = true;
        html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
      }
      html += `</optgroup>`;
    }

    // 5. Game Master / Current User
    html += `<optgroup label="👑 Game Master">`;
    const gmVal = `user:${game.user.id}`;
    const isGmSel = selectedClean === gmVal.toLowerCase() || selectedClean === game.user.id.toLowerCase() || selectedClean === 'gm';
    if (isGmSel) hasMatch = true;
    html += `<option value="${gmVal}" ${isGmSel ? 'selected' : ''}>${Handlebars.escapeExpression(game.user.name)} (GM)</option>`;
    html += `</optgroup>`;
  } else {
    // Player characters
    const myActors = game.actors ? game.actors.filter(a => a.isOwner).sort((a, b) => a.name.localeCompare(b.name)) : [];
    if (myActors.length) {
      html += `<optgroup label="👤 Your Characters">`;
      for (const actor of myActors) {
        const isSel = selectedClean === actor.id.toLowerCase() || selectedClean === actor.name.toLowerCase();
        if (isSel) hasMatch = true;
        html += `<option value="${actor.id}" ${isSel ? 'selected' : ''}>${Handlebars.escapeExpression(actor.name)}</option>`;
      }
      html += `</optgroup>`;
    }
    const userVal = `user:${game.user.id}`;
    const isUserSel = selectedClean === userVal.toLowerCase() || selectedClean === game.user.id.toLowerCase() || (!hasMatch && !myActors.length);
    html += `<optgroup label="👤 User">`;
    html += `<option value="${userVal}" ${isUserSel ? 'selected' : ''}>${Handlebars.escapeExpression(game.user.name)}</option>`;
    html += `</optgroup>`;
  }

  return html;
}

/**
 * Prepares mail context (inbox, threading, compose, view thread).
 * @param {Object} settings - Module settings data
 * @param {Object} app - IntotericaApp instance
 * @param {Object} perms - Granular permissions object
 * @returns {{inbox: Array, knownNPCs: Array, mailContext: Object, unreadMailCount: number}}
 */
export function prepareMailContext(settings, app, perms = {}) {
  const userId = game.user.id;
  const isMsgUnread = (m) => isMessageUnreadForUser(m, game.user);

  // Process Inbox for Current User (Threading)
  let userInbox = [];
  
  if (perms.mail) {
    userInbox = settings.inbox || [];
  } else {
    const myActors = game.actors ? game.actors.filter(a => a.isOwner) : [];
    const myActorIds = myActors.map(a => a.id);
    const myActorNames = myActors.map(a => a.name?.trim().toLowerCase()).filter(Boolean);
    userInbox = (settings.inbox || []).filter(m => {
      const to = Array.isArray(m.to) ? m.to : [m.to];
      const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
      const isSender = myActorIds.includes(m.fromId) || m.fromId === game.user.id || (m.from && myActorNames.includes(m.from.trim().toLowerCase()));
      return isSender || to.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase()))) || cc.some(id => myActorIds.includes(id) || (typeof id === 'string' && myActorNames.includes(id.trim().toLowerCase())));
    });

    // Include pending messages in view
    const pending = game.user.getFlag('intoterica', 'pendingOutbox') || [];
    if (pending.length > 0) {
        userInbox = [...pending, ...userInbox];
    }
  }

  // Known NPCs (Moved up for message processing)
  const knownNPCIds = settings.knownNPCs || [];

  // Helper to mask unknown senders & dynamically resolve current actor image by id or name
  const getMessageDisplayData = (msg) => {
      let displayFrom = msg.from;
      let displayImage = msg.image;
      
      // Find actor by fromId or matching actor name
      let matchedActor = msg.fromId ? game.actors.get(msg.fromId) : null;
      if (!matchedActor && msg.from && typeof msg.from === 'string') {
          const cleanFrom = msg.from.trim().toLowerCase();
          matchedActor = game.actors.find(a => a.name?.trim().toLowerCase() === cleanFrom);
      }

      if (matchedActor) {
          if (!perms.mail && !knownNPCIds.includes(matchedActor.id) && !matchedActor.hasPlayerOwner) {
              displayFrom = "Unknown Sender";
              displayImage = "icons/svg/mystery-man.svg";
          } else {
              displayImage = matchedActor.prototypeToken?.texture?.src || matchedActor.img || displayImage;
              if (!displayImage || displayImage === "👤") {
                  displayImage = matchedActor.img || "icons/svg/mystery-man.svg";
              }
          }
      } else if (!perms.mail && msg.fromId && !knownNPCIds.includes(msg.fromId)) {
          displayFrom = "Unknown Sender";
          displayImage = "icons/svg/mystery-man.svg";
      }
      
      const isImage = displayImage && (displayImage.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(displayImage));
      return { ...msg, from: displayFrom, image: displayImage, isImage };
  };

  // Group by Subject
  const threads = {};
  userInbox.forEach(m => {
    const subject = m.subject || "(No Subject)";
    const normalizedSubject = subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    if (!threads[normalizedSubject]) threads[normalizedSubject] = [];
    threads[normalizedSubject].push(m);
  });

  const displayInbox = Object.values(threads).map(threadMsgs => {
    let latest = threadMsgs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    // Thread is unread if ANY message in it is unread for this user
    const isThreadUnread = threadMsgs.some(isMsgUnread);
    latest = getMessageDisplayData(latest);
    return {
      ...latest,
      status: isThreadUnread ? 'unread' : 'read', // Override status for display
      isImage: latest.image && (latest.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(latest.image))
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const knownNPCs = knownNPCIds.map(id => game.actors.get(id)).filter(Boolean);

  // Mail Context (Compose/View)
  let mailContext = {};
  if (app.currentView === 'mail') {
      const npcs = game.actors ? game.actors.filter(a => !a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name)) : [];
      const players = game.users ? game.users.filter(u => !u.isGM && u.character).map(u => u.character) : [];
      const availableNPCs = perms.mail ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));
      const allRecipients = [...players, ...availableNPCs];

      if (app.mailComposeData) {
          const defaults = app.mailComposeData;
          const isGM = perms.mail;

          // Generate hierarchical from sender options (Folders, Known NPCs, Factions, Root Actors, Users)
          const activeFromId = defaults.fromId || defaults.from || (game.user.character?.id || `user:${game.user.id}`);
          const fromOptionsHtml = getMailSenderOptions(activeFromId, isGM);

          // Determine current sender for visual display
          let currentFromId = defaults.fromId;
          let currentFromName = "";
          let currentFromImage = "icons/svg/mystery-man.svg";
          let currentFromIdVal = currentFromId;

          if (currentFromId && currentFromId.startsWith('faction:')) {
              const fId = currentFromId.split(':')[1];
              const f = (settings.factions || []).find(fac => fac.id === fId || fac.name === fId);
              if (f) {
                  currentFromName = f.name;
                  currentFromImage = f.icon || f.banner || "icons/svg/shield.svg";
              }
          } else if (currentFromId && currentFromId.startsWith('user:')) {
              const uId = currentFromId.split(':')[1];
              const u = game.users?.get(uId);
              if (u) {
                  currentFromName = u.name;
                  currentFromImage = u.avatar || "icons/svg/mystery-man.svg";
              }
          } else if (currentFromId) {
              const a = game.actors?.get(currentFromId);
              if (a) {
                  currentFromName = a.name;
                  currentFromImage = a.prototypeToken?.texture?.src || a.img || "icons/svg/mystery-man.svg";
              }
          }

          if (!currentFromName && defaults.from && typeof defaults.from === 'string') {
              currentFromName = defaults.from;
              const matched = game.actors?.find(a => a.name?.trim().toLowerCase() === defaults.from.trim().toLowerCase());
              if (matched) {
                  currentFromImage = matched.prototypeToken?.texture?.src || matched.img || "icons/svg/mystery-man.svg";
                  currentFromIdVal = matched.id;
              }
          }

          if (!currentFromName) {
              if (game.user.character) {
                  currentFromName = game.user.character.name;
                  currentFromImage = game.user.character.prototypeToken?.texture?.src || game.user.character.img || "icons/svg/mystery-man.svg";
                  currentFromIdVal = game.user.character.id;
              } else {
                  currentFromName = game.user.name;
                  currentFromImage = game.user.avatar || "icons/svg/mystery-man.svg";
                  currentFromIdVal = `user:${game.user.id}`;
              }
          }

          const currentFrom = {
              id: currentFromIdVal,
              name: currentFromName,
              image: currentFromImage
          };

          // Helper to get actor data for chips (supporting name matching if sheet changed)
          const getRecipientData = (ids) => {
              if (!ids) return [];
              const idList = Array.isArray(ids) ? ids : [ids];
              return idList.map(id => {
                  let actor = allRecipients.find(a => a.id === id);
                  if (!actor) {
                      actor = game.actors.get(id);
                  }
                  if (!actor && typeof id === 'string') {
                      const cleanId = id.trim().toLowerCase();
                      actor = game.actors.find(a => a.name?.trim().toLowerCase() === cleanId);
                  }
                  if (!actor && typeof id === 'string') {
                      const user = game.users.get(id) || game.users.find(u => u.name?.trim().toLowerCase() === id.trim().toLowerCase());
                      if (user?.character) {
                          actor = user.character;
                      }
                  }
                  // Handle replying to unknown sender (not in allRecipients)
                  if (actor && !actor.hasPlayerOwner && !perms.mail && !knownNPCIds.includes(actor.id)) {
                      return { id: actor.id, name: "Unknown Sender", image: "icons/svg/mystery-man.svg", isUnknown: true };
                  }
                  
                  if (!actor) return null;
                  
                  return {
                      id: actor.id,
                      name: actor.name,
                      image: actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
                      isUnknown: false
                  };
              }).filter(Boolean);
          };

          const formatIds = (ids) => Array.isArray(ids) ? ids.join(",") : (ids || "");

          mailContext.compose = {
              fromOptionsHtml,
              currentFrom,
              toRecipients: getRecipientData(defaults.to),
              toIds: formatIds(defaults.to),
              ccRecipients: getRecipientData(defaults.cc),
              ccIds: formatIds(defaults.cc),
              subject: defaults.subject || "",
              body: defaults.body || ""
          };
      } else if (app.mailViewSubject !== null) {
          const closedThreads = settings.closedThreads || [];
          const normalizedViewSubject = app.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
          
          const threadMessages = (settings.inbox || []).filter(m => {
              const mSubject = m.subject || "(No Subject)";
              return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedViewSubject;
          }).sort((a, b) => new Date(a.date) - new Date(b.date));
          
          // Auto mark thread as read when viewed on message page
          const hasUnread = threadMessages.some(isMsgUnread);
          if (hasUnread) {
              markMessagesAsReadForUser([app.mailViewSubject, ...threadMessages.map(m => m.id)], game.user);
              threadMessages.forEach(m => {
                  if (!Array.isArray(m.readBy)) m.readBy = [];
                  if (!m.readBy.includes(userId)) m.readBy.push(userId);
                  m.status = 'read';
              });
          }

          // Check if normalized subject is in closedThreads list
          const isClosed = closedThreads.includes(normalizedViewSubject);

          mailContext.thread = {
              subject: app.mailViewSubject,
              messages: threadMessages.map(getMessageDisplayData),
              isClosed: isClosed
          };
      }
  }

  // Calculate Stats Efficiently
  let showNotificationBadges = true;
  try {
    showNotificationBadges = game.settings.get('intoterica', 'showNotificationBadges') !== false;
  } catch (_e) {}

  const unreadMailCount = showNotificationBadges ? (settings.inbox || []).filter(isMsgUnread).length : 0;

  return {
    inbox: displayInbox,
    knownNPCs,
    mailContext,
    unreadMailCount
  };
}

