/**
 * Intoterica Mail Actions
 * User interactions and DOM event handlers for mail system
 */

import { hasPermission } from "../../core/permissions.js";
import { getSoundPath } from "../../core/audio.js";
import { THEMES } from "../../core/constants.js";
import { createDialog } from "../../core/dialog.js";
import { markMessagesAsReadForUser } from "./mail-helpers.js";

export const mailActions = {
  async _onReadMessage(event) {
    if (event) {
      event.preventDefault();
    }
    const messageId = event.currentTarget.dataset.messageId;
    const raw = game.settings.get('intoterica', 'data') || {};
    const inbox = raw.inbox || [];
    
    const message = inbox.find(m => m.id === messageId);
    if (!message) return;

    // Set view state to open the message thread
    this.mailViewSubject = message.subject || "(No Subject)";
    this.mailComposeData = null;

    const norm = (message.subject || "(No Subject)").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const matchingIds = inbox.filter(m => {
      const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      return s === norm;
    }).map(m => m.id);

    await markMessagesAsReadForUser([message.id, message.subject, ...matchingIds], game.user);
  },

  async _onMarkAllRead(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const raw = game.settings.get('intoterica', 'data') || {};
    const inbox = raw.inbox || [];
    const allIds = inbox.map(m => m.id).filter(Boolean);
    const allSubjects = inbox.map(m => m.subject).filter(Boolean);
    await markMessagesAsReadForUser([...allIds, ...allSubjects], game.user);
    ui.notifications?.info("All messages marked as read.");
  },

  async _onMarkThreadRead(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const subject = event?.currentTarget?.dataset?.subject || this.mailViewSubject;
    if (!subject) return;
    const raw = game.settings.get('intoterica', 'data') || {};
    const norm = subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const matchingIds = (raw.inbox || []).filter(m => {
      const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      return s === norm;
    }).map(m => m.id);
    await markMessagesAsReadForUser([subject, ...matchingIds], game.user);
    ui.notifications?.info("Conversation marked as read.");
  },

  async _performReadMessage(messageIdOrSubject, userId) {
    if (!game.user.isGM) return;
    const raw = game.settings.get('intoterica', 'data') || {};
    const settings = foundry.utils.deepClone(raw);
    if (!settings || !Array.isArray(settings.inbox) || settings.inbox.length === 0) return;
    
    const directMessage = settings.inbox.find(m => m.id === messageIdOrSubject);
    const targetSubject = directMessage ? directMessage.subject : messageIdOrSubject;
    const normalizedTargetSubject = (targetSubject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();

    const threadMessages = settings.inbox.filter(m => {
        if (m.id === messageIdOrSubject) return true;
        if (directMessage && m.id === directMessage.id) return true;
        if (normalizedTargetSubject) {
            const mSubject = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
            return mSubject === normalizedTargetSubject;
        }
        return false;
    });

    if (threadMessages.length === 0 && directMessage) {
        threadMessages.push(directMessage);
    }

    let updated = false;
    threadMessages.forEach(m => {
        if (!Array.isArray(m.readBy)) {
            m.readBy = m.status === 'read' ? game.users.map(u => u.id) : [];
        }

        if (!m.readBy.includes(userId)) {
            m.readBy.push(userId);
            updated = true;
        }
        if (m.status !== 'read') {
            m.status = 'read';
            updated = true;
        }
    });

    if (updated) {
      await this._saveData(settings);
      this._broadcastUpdate();
      window.IntotericaSceneBadges?.();
      if (this.rendered) this.render();
    }
  },

  _onDeleteThreadAction(event) {
    event.preventDefault();
    if (this.mailViewSubject !== null) {
      this._deleteThread(this.mailViewSubject);
    }
  },

  async _deleteThread(subject) {
    const settings = game.settings.get('intoterica', 'data');
    const normalizedSubject = subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    settings.inbox = settings.inbox.filter(m => {
        const mSubject = m.subject || "(No Subject)";
        return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() !== normalizedSubject;
    });
    await game.settings.set('intoterica', 'data', settings);
    this.mailViewSubject = null;
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Conversation deleted.`);
  },

  async _deleteMessage(event) {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    const settings = game.settings.get('intoterica', 'data');
    
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;
    
    const subject = message.subject;
    settings.inbox = settings.inbox.filter(m => m.id !== messageId);
    
    if (!settings.inbox.some(m => m.subject === subject)) {
        this.mailViewSubject = null;
    }
    
    await this._saveData(settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info("Message deleted.");
  },

  async _onEndConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      if (!settings.closedThreads) settings.closedThreads = [];
      
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      if (!settings.closedThreads.includes(normalizedSubject)) {
          settings.closedThreads.push(normalizedSubject);
      }
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  },

  async _onReopenConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      settings.closedThreads = (settings.closedThreads || []).filter(s => s !== normalizedSubject);
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  },

  async _onDropKnownNPC(event) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    if (data.type !== 'Actor') return;
    
    const settings = game.settings.get('intoterica', 'data');
    const known = settings.knownNPCs || [];
    
    // Handle UUID or ID
    let actorId = data.uuid ? data.uuid.split('.').pop() : data.id;
    const actor = game.actors.get(actorId);
    
    if (actor && !actor.hasPlayerOwner && !known.includes(actorId)) {
        known.push(actorId);
        settings.knownNPCs = known;
        await this._saveData(settings);
        this._broadcastUpdate();
        this.render();
        ui.notifications.info(`${actor.name} added to Known NPCs.`);
    }
  },

  async _onRemoveKnownNPC(event) {
      event.preventDefault();
      const id = event.currentTarget.dataset.id;
      const settings = game.settings.get('intoterica', 'data');
      settings.knownNPCs = (settings.knownNPCs || []).filter(k => k !== id);
      await this._saveData(settings);
      this._broadcastUpdate();
      this.render();
  },

  async _onReplyMail(originalMessage) {
    if (!originalMessage) return;

    // Automatically mark the message and thread as read for this user when replying
    const raw = game.settings.get('intoterica', 'data') || {};
    const norm = (originalMessage.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const matchingIds = (raw.inbox || []).filter(m => {
      const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      return s === norm;
    }).map(m => m.id);
    await markMessagesAsReadForUser([originalMessage.id, originalMessage.subject, ...matchingIds], game.user);

    // Determine recipients (Reply All logic: Sender + Original To + Original CC - Self)
    const originalTo = Array.isArray(originalMessage.to) ? originalMessage.to : [originalMessage.to];
    const originalCc = Array.isArray(originalMessage.cc) ? originalMessage.cc : [originalMessage.cc];
    
    // Determine From ID (Reply as the actor who received it if owned)
    const myActors = game.actors ? game.actors.filter(a => a.isOwner) : [];
    const myActorIds = myActors.map(a => a.id);
    let myRecipientId = [...originalTo, ...originalCc].find(id => myActorIds.includes(id));
    if (!myRecipientId) {
        const foundActor = myActors.find(a => [...originalTo, ...originalCc].some(t => typeof t === 'string' && t.trim().toLowerCase() === a.name?.trim().toLowerCase()));
        if (foundActor) myRecipientId = foundActor.id;
    }
    const replyFromId = myRecipientId || game.user.character?.id || (myActors[0]?.id) || game.user.id;

    let recipients = new Set([...originalTo, ...originalCc]);
    let replyToId = originalMessage.fromId;
    if (!game.actors.get(replyToId) && originalMessage.from && typeof originalMessage.from === 'string') {
        const matchingSender = game.actors.find(a => a.name?.trim().toLowerCase() === originalMessage.from.trim().toLowerCase());
        if (matchingSender) replyToId = matchingSender.id;
    }
    if (replyToId) recipients.add(replyToId);
    if (replyFromId) recipients.delete(replyFromId);

    const subject = originalMessage.subject || "(No Subject)";
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    const replyData = {
        fromId: replyFromId,
        to: Array.from(recipients),
        subject: replySubject,
        body: ""
    };
    
    this.mailComposeData = replyData;
    this.mailViewSubject = null;
    this.render();
  },

  async _onComposeMail(event) {
    event.preventDefault();
    this.mailComposeData = {};
    this.mailViewSubject = null;
    this.render();
  },

  _onReplyAction(event) {
      event.preventDefault();
      const settings = game.settings.get('intoterica', 'data');
      if (this.mailViewSubject !== null) {
          const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
          const threadMessages = (settings.inbox || []).filter(m => {
              const mSubject = m.subject || "(No Subject)";
              return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
          }).sort((a, b) => new Date(b.date) - new Date(a.date));
          
          if (threadMessages.length > 0) {
              this._onReplyMail(threadMessages[0]);
          }
      }
  },

  async _onSendMailAction(event) {
    event.preventDefault();
    const form = $(this.element).find('.email-compose-form')[0];
    if (!form) return;
    const fd = new FormData(form);
    const formData = Object.fromEntries(fd.entries());
    
    // Parse to/cc from string to array
    formData.to = formData.to ? formData.to.split(',').filter(Boolean) : [];
    formData.cc = formData.cc ? formData.cc.split(',').filter(Boolean) : [];
    formData.userId = game.user.id;

    // Automatically mark the replied conversation thread as read for this user
    if (formData.subject) {
      const raw = game.settings.get('intoterica', 'data') || {};
      const norm = formData.subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      const matchingIds = (raw.inbox || []).filter(m => {
        const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
        return s === norm;
      }).map(m => m.id);
      await markMessagesAsReadForUser([formData.subject, ...matchingIds], game.user);
    }

    await this._sendMail(formData);
    this.mailComposeData = null;
    this.render();
  },

  _onCancelCompose(event) {
      event.preventDefault();
      this.mailComposeData = null;
      this.render();
  },

  _openAddressBook(selectedIds, players, npcs, callback) {
      const content = `
        <form class="intoterica-form" style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
          <!-- Players Section -->
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-users"></i> Player Characters</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${players.map(p => `
                <div class="form-toggle-card">
                  <input type="checkbox" name="${p.id}" id="ab-${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''} />
                  <label for="ab-${p.id}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Handlebars.escapeExpression(p.name)}</label>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- NPCs Section -->
          <div class="form-section" style="margin-top: 10px;">
            <div class="form-section-title"><i class="fas fa-address-book"></i> Known NPCs</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${npcs.length ? npcs.map(n => `
                <div class="form-toggle-card">
                  <input type="checkbox" name="${n.id}" id="ab-${n.id}" ${selectedIds.includes(n.id) ? 'checked' : ''} />
                  <label for="ab-${n.id}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Handlebars.escapeExpression(n.name)}</label>
                </div>
              `).join('') : '<div style="color: var(--theme-dim); font-style: italic; font-size: 12px; padding: 4px;">No NPCs in address book.</div>'}
            </div>
          </div>
        </form>
      `;

      createDialog({
          title: "Address Book",
          content: content,
          buttons: {
              confirm: {
                  icon: '<i class="fas fa-check"></i>',
                  label: "Apply Selection",
                  callback: (html) => {
                      const newSelected = [];
                      html.find('input[type="checkbox"]:checked').each((i, el) => {
                          newSelected.push(el.name);
                      });
                      callback(newSelected);
                  }
              },
              cancel: {
                  icon: '<i class="fas fa-times"></i>',
                  label: "Cancel"
              }
          },
          default: "confirm"
      }, { width: 520 }).render(true);
  },

  async _sendMail(data) {
    const settings = game.settings.get('intoterica', 'data') || {};
    let fromId = data.fromId;
    let senderName = data.from;
    let senderImage = data.image || "icons/svg/mystery-man.svg";
    let sender = null;

    if (fromId && fromId.startsWith('faction:')) {
        const fId = fromId.split(':')[1];
        const f = (settings.factions || []).find(fac => fac.id === fId || fac.name === fId);
        if (f) {
            senderName = f.name;
            senderImage = f.icon || f.banner || "icons/svg/shield.svg";
        }
    } else if (fromId && fromId.startsWith('user:')) {
        const uId = fromId.split(':')[1];
        const u = game.users?.get(uId);
        if (u) {
            senderName = u.name;
            senderImage = u.avatar || "icons/svg/mystery-man.svg";
        }
    } else {
        sender = fromId ? game.actors?.get(fromId) : null;
        if (!sender && data.from && typeof data.from === 'string') {
            sender = game.actors?.find(a => a.name?.trim().toLowerCase() === data.from.trim().toLowerCase());
        }
        if (!sender && game.user.character) {
            sender = game.user.character;
        }
        if (sender) {
            fromId = sender.id;
            senderName = sender.name;
            senderImage = sender.prototypeToken?.texture?.src || sender.img || "icons/svg/mystery-man.svg";
        }
    }

    if (!fromId) {
        fromId = game.user.character?.id || `user:${game.user.id}`;
    }
    if (!senderName) {
        senderName = game.user.character?.name || game.user.name || "Unknown";
    }

    const senderUserId = data.userId || game.user.id;
    const senderUser = game.users.get(senderUserId) || game.user;

    const newMessage = {
      id: foundry.utils.randomID(),
      from: senderName,
      fromId: fromId,
      to: data.to,
      cc: data.cc || [],
      image: senderImage,
      subject: data.subject,
      body: data.body,
      date: data.date || (this._getGameDate ? this._getGameDate() : ""),
      readBy: [senderUserId],
      status: "unread"
    };
    
    if (!hasPermission('permMail')) {
        if (!game.users.some(u => u.isGM && u.active)) {
            // Queue message for later delivery
            const pending = game.user.getFlag('intoterica', 'pendingOutbox') || [];
            pending.push(newMessage);
            await game.user.setFlag('intoterica', 'pendingOutbox', pending);
            ui.notifications.info("Message queued. It will be delivered when a GM logs in.");
            this.render();
            return;
        }

        game.socket.emit('module.intoterica', {
            type: 'dispatch',
            action: 'sendMail',
            payload: { ...data, fromId, userId: senderUserId }
        });
        ui.notifications.info(`Mail sent!`);
        return;
    }

    if (data.subject) {
        const normSub = data.subject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
        (settings.inbox || []).forEach(m => {
            const mNorm = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
            if (mNorm === normSub) {
                if (!Array.isArray(m.readBy)) m.readBy = [];
                if (!m.readBy.includes(senderUserId)) m.readBy.push(senderUserId);
            }
        });
        if (senderUser) {
            const matchingIds = (settings.inbox || []).filter(m => {
                const s = (m.subject || "").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
                return s === normSub;
            }).map(m => m.id);
            await markMessagesAsReadForUser([data.subject, ...matchingIds], senderUser);
        }
    }

    settings.inbox.unshift(newMessage);

    await this._saveData(settings);
    this._broadcastUpdate({ action: 'newMessage' });
    window.IntotericaSceneBadges?.();

    // Play sound locally since socket doesn't loop back
    if (game.settings.get('intoterica', 'enableSounds')) {
        const soundPath = getSoundPath('mail');
        let volume = game.settings.get('intoterica', 'volumeNotification');
        
        // Apply Theme Scale
        const themeKey = game.settings.get('intoterica', 'theme');
        const themeConfig = THEMES[themeKey];
        if (themeConfig && themeConfig.volumeScale) {
            volume = Math.min(1.0, volume * themeConfig.volumeScale);
        }
        
        if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: volume, autoplay: true, loop: false}, false);
    }
    this.render();
    
    // Determine if sender is a player character
    const isPlayerSender = sender && sender.hasPlayerOwner;

    // GM Notification for player messages
    if (isPlayerSender) {
        const pSenderName = sender.name;
        const gmUsers = game.users.filter(u => u.isGM && u.id !== senderUserId).map(u => u.id);
        if (gmUsers.length > 0) {
            ChatMessage.create({
                content: `
                    <div class="intoterica-chat-card">
                        <div class="card-content" style="padding: 5px; font-size: 12px;">
                            <strong>${pSenderName}</strong> has sent a message: <em>"${newMessage.subject}"</em>
                            <button class="intoterica-open-inbox" data-message-id="${newMessage.id}" style="margin-top: 6px; width: 100%;">Access Inbox</button>
                        </div>
                    </div>
                `,
                whisper: gmUsers,
                sound: null
            });
        }
    }

    // Notifications to recipients
    const allRecipients = [
      ...(Array.isArray(data.to) ? data.to : (data.to ? [data.to] : [])),
      ...(Array.isArray(data.cc) ? data.cc : (data.cc ? [data.cc] : []))
    ].filter(Boolean);

    const recipientUsers = game.users.filter(u => {
      if (allRecipients.includes(u.id) || allRecipients.includes(`user:${u.id}`)) return true;
      if (!u.character) return false;
      if (allRecipients.includes(u.character.id)) return true;
      const charName = u.character.name?.trim().toLowerCase();
      return allRecipients.some(r => typeof r === 'string' && r.trim().toLowerCase() === charName);
    });

    let notifyMail = true;
    try {
      notifyMail = game.settings.get('intoterica', 'notifyMail') !== false;
    } catch (_e) {}

    if (notifyMail && recipientUsers.length > 0) {
      recipientUsers.forEach(u => {
        ChatMessage.create({
          content: `
            <div class="intoterica-chat-card">
              <h3>You've got mail!</h3>
              <div class="card-content">
                <div style="font-size: 48px; margin: 10px 0;">✉️</div>
                <div style="margin-bottom: 5px;"><strong>${u.character?.name || u.name}</strong></div>
                <div style="font-size: 12px;">From: ${newMessage.from}</div>
                <div style="font-style: italic; margin-top: 5px; opacity: 0.8;">${newMessage.subject}</div>
                <button class="intoterica-open-inbox" data-message-id="${newMessage.id}" style="margin-top: 10px; width: 100%;">Access Inbox</button>
              </div>
            </div>
          `,
          whisper: [u.id],
          sound: null
        });
      });
    }

    ui.notifications?.info("Mail sent!");
  }
};

/**
 * Binds mail-related events.
 * @param {JQuery} html 
 * @param {Object} app 
 * @param {Object} context 
 */
export function bindMailEvents(html, app, context) {
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (app._onReadMessage) {
    html.find('.inbox-item').click(app._onReadMessage.bind(app));
  }

  // Known NPCs Drag & Drop (GM Only)
  if (app.currentView === 'known-npcs' && hasPermission('permMail')) {
      const dropZone = html.find('.known-npcs-container')[0];
      if (dropZone) {
          dropZone.addEventListener('dragover', e => e.preventDefault());
          dropZone.addEventListener('drop', app._onDropKnownNPC.bind(app));
      }
      html.find('.remove-known-npc').click(app._onRemoveKnownNPC.bind(app));
  }

  // Mail Integrated Controls
  if (app.currentView === 'mail') {
      html.find('.compose-mail').click(app._onComposeMail.bind(app));
      // Force select value for GM sender to match state
      if (context.mailContext?.compose?.currentFrom?.id && hasPermission('permMail')) {
           html.find('select[name="fromId"]').val(context.mailContext.compose.currentFrom.id);
      }

      // Compose Actions
      html.find('.send-mail-btn').click(app._onSendMailAction.bind(app));
      html.find('.cancel-compose-btn').click(app._onCancelCompose.bind(app));
      html.find('.reply-btn').click(app._onReplyAction.bind(app));
      html.find('.end-conversation-btn').click(app._onEndConversation.bind(app));
      html.find('.reopen-conversation-btn').click(app._onReopenConversation.bind(app));
      html.find('.mark-all-read-btn').click(app._onMarkAllRead.bind(app));
      html.find('.mark-thread-read-btn').click(app._onMarkThreadRead.bind(app));
      html.find('.delete-message-btn').click(app._deleteMessage.bind(app));
      html.find('.delete-thread-btn').click(app._onDeleteThreadAction.bind(app));
      
      // Address Book
      html.find('.open-address-book').click(ev => {
          const target = ev.currentTarget.dataset.target;
          const currentIds = (app.mailComposeData[target] || []);
          const npcs = game.actors ? game.actors.filter(a => a.type === 'npc').sort((a, b) => a.name.localeCompare(b.name)) : [];
          const players = game.users ? game.users.filter(u => !u.isGM && u.character).map(u => u.character) : [];
          const knownNPCIds = game.settings.get('intoterica', 'data').knownNPCs || [];
          const availableNPCs = hasPermission('permMail') ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));

          app._openAddressBook(currentIds, players, availableNPCs, (newIds) => {
              app.mailComposeData[target] = newIds;
              app.render();
          });
      });

      // GM / Sender From Selection Change
      html.find('select[name="fromId"]').on('change', ev => {
          ev.preventDefault();
          if (app.mailComposeData) {
              app.mailComposeData.fromId = $(ev.currentTarget).val();
              app.mailComposeData.subject = html.find('input[name="subject"]').val();
              app.mailComposeData.body = html.find('textarea[name="body"]').val();
              app.render();
          }
      });

      // Input preservation on re-render
      html.find('input[name="subject"]').on('input', ev => {
           if (app.mailComposeData) app.mailComposeData.subject = $(ev.currentTarget).val();
      });
      html.find('textarea[name="body"]').on('input', ev => {
           if (app.mailComposeData) app.mailComposeData.body = $(ev.currentTarget).val();
      });
  }
}

