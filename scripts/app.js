export class IntotericaApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "intoterica",
    window: {
      title: "Intoterica",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 1000,
      height: 700
    },
    classes: ["intoterica"]
  };

  static PARTS = {
    main: {
      template: "modules/intoterica/templates/intoterica.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this.currentView = 'dashboard';
    this.selectedFaction = null;
    this.profileActorId = null;
    this._idleSound = null;
    this.mailComposeData = null;
    this.mailViewSubject = null;
    IntotericaApp._instance = this;
  }

  async close(options = {}) {
    // Stop and clean up idle sound
    if (this._idleSound) {
      this._idleSound.stop();
      this._idleSound = null;
    }

    if (IntotericaApp._instance === this) IntotericaApp._instance = null;
    return super.close(options);
  }

  async _prepareContext(_options) {
    const settings = game.settings.get('intoterica', 'data');
    const isGM = game.user.isGM;

    // GM: Process Pending Mail from Offline Players
    if (isGM) {
        let hasUpdates = false;
        for (const user of game.users) {
            const pending = user.getFlag('intoterica', 'pendingOutbox');
            if (pending && Array.isArray(pending) && pending.length > 0) {
                settings.inbox.unshift(...pending);
                await user.unsetFlag('intoterica', 'pendingOutbox');
                hasUpdates = true;
                ui.notifications.info(`Processed ${pending.length} pending messages from ${user.name}`);
            }
        }
        if (hasUpdates) {
            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate({ action: 'newMessage' });
        }
    }

    // Helper: Get Reputation Tier Info
    const getRepStatus = (rep) => {
      if (rep <= -80) return { label: "Nemesis", class: "rep-tier-nemesis", face: "👿", xpMod: 0.5, color: "#8b0000" };
      if (rep <= -50) return { label: "Hostile", class: "rep-tier-hostile", face: "😠", xpMod: 0.75, color: "#ff4500" };
      if (rep <= -30) return { label: "Unfriendly", class: "rep-tier-unfriendly", face: "😒", xpMod: 0.9, color: "#ffd700" };
      if (rep <= -10) return { label: "Wary", class: "rep-tier-wary", face: "😕", xpMod: 1.0, color: "#f5f5dc" };
      if (rep < 10) return { label: "Neutral", class: "rep-tier-neutral", face: "😐", xpMod: 1.0, color: "#ffffff" };
      if (rep < 30) return { label: "Friendly", class: "rep-tier-friendly", face: "🙂", xpMod: 1.1, color: "#98fb98" };
      if (rep < 50) return { label: "Allied", class: "rep-tier-allied", face: "😃", xpMod: 1.25, color: "#00ff00" };
      if (rep < 80) return { label: "Devoted", class: "rep-tier-devoted", face: "😇", xpMod: 1.5, color: "#00bfff" };
      return { label: "Devoted", class: "rep-tier-devoted", face: "🧞", xpMod: 1.5, color: "#00bfff" };
    };

    // Process Factions (Auto-Calc & Normalization)
    const processedFactions = (settings.factions || []).map(f => {
      let ranks = f.ranks || [];
      // Normalize Ranks (Handle legacy string arrays vs new object arrays)
      if (ranks.length > 0 && typeof ranks[0] === 'string') {
        ranks = ranks.map(r => ({ name: r, xp: 0, modifier: 1.0 }));
      }

      // Auto-Calculate Reputation if enabled
      let currentRep = f.reputation;
      if (f.autoCalc) {
        let totalWeightedRep = 0;
        let totalWeights = 0;
        (f.members || []).forEach(m => {
          const rankData = ranks[m.rank] || { modifier: 1.0 };
          const weight = rankData.modifier || 1.0;
          totalWeightedRep += (m.reputation || 0) * weight;
          totalWeights += weight;
        });
        currentRep = totalWeights > 0 ? Math.round(totalWeightedRep / totalWeights) : 0;
        currentRep = Math.max(-100, Math.min(100, currentRep));
      }

      // Check enlistment eligibility
      const userActorId = game.user.character?.id;
      const isMember = (f.members || []).some(m => m.id === userActorId);
      const canEnlist = !isGM && f.autoCalc === false && f.allowEnlistment && userActorId && !isMember;

      const status = getRepStatus(currentRep);
      const isImage = f.image && (f.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.image));
      return { ...f, ranks, reputation: currentRep, statusLabel: status.label, statusClass: status.class, face: status.face, xpMod: status.xpMod, statusColor: status.color, canEnlist, isImage };
    });

    // Sync selected faction with latest data
    if (this.selectedFaction) {
      this.selectedFaction = processedFactions.find(f => f.id === this.selectedFaction.id) || null;
    }

    // Quest Data Source (FQL Integration)
    let allQuests = settings.quests || [];
    const useFQL = game.modules.get("forien-quest-log")?.active;

    if (useFQL) {
      allQuests = game.journal.filter(j => j.getFlag("forien-quest-log", "json")).map(j => {
        const fql = j.getFlag("forien-quest-log", "json");
        const s = (fql.status || "active").toLowerCase();
        
        let status = "Hidden";
        if (s === "active") status = "In Progress";
        else if (s === "completed") status = "Completed";
        else if (s === "failed") status = "Failed";

        const div = document.createElement("div");
        div.innerHTML = fql.description || "";
        const description = div.textContent || div.innerText || "";

        return {
          id: j.id,
          title: fql.name || j.name,
          description: description,
          difficulty: "Medium",
          status: status,
          image: fql.splash || null,
          actors: fql.actors || []
        };
      }).filter(q => q.status !== "Hidden");

      // Sort: In Progress > Completed > Failed
      const sortOrder = { "In Progress": 0, "Completed": 1, "Failed": 2 };
      allQuests.sort((a, b) => (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9));
    }

    // Filter for Main Tab: Only show Active/In Progress
    const activeQuests = allQuests.filter(q => q.status === 'In Progress' || q.status === 'Active');

    // World Clock Logic
    const useWorldClock = game.settings.get('intoterica', 'useWorldClock');
    let clockDisplay;

    if (useWorldClock) {
      if (window.SimpleCalendar?.api) {
        const date = SimpleCalendar.api.timestampToDate(game.time.worldTime);
        clockDisplay = SimpleCalendar.api.formatDateTime(date);
      } else {
        const day = Math.floor(game.time.worldTime / 86400);
        clockDisplay = `Day ${day}`;
      }
    } else {
      const c = settings.worldClock || { era: 1, day: 1 };
      clockDisplay = `Era ${c.era}, Day ${c.day}`;
    }

    // Player Overview Logic
    const players = [];
    const users = game.users.filter(u => !u.isGM && u.character);

    for (const u of users) {
      const actor = u.character;
      const isOnline = u.active;
      const isSelf = u.isSelf;

      // GM sees all players. Players see themselves and online players.
      if (isGM || isSelf || isOnline) {
        const actorId = actor.id;
        const badgesCount = (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(actorId)).length;
        const factionsCount = (settings.factions || []).filter(f => (f.members || []).some(m => m.id === actorId)).length;
        const unreadMessages = (settings.inbox || []).filter(m => m.to === actorId && m.status === 'unread').length;

        players.push({
          id: actorId,
          name: actor.name,
          img: actor.img,
          userName: u.name,
          online: isOnline,
          isSelf: isSelf,
          badgesCount,
          factionsCount,
          unreadMessages,
          canExpand: isGM || isSelf // Only GM or Self can view full profile
        });
      }
    }

    // Profile Data
    let profile = null;
    if (this.profileActorId) {
      const actor = game.actors.get(this.profileActorId);
      const isOwnCharacter = game.user.character?.id === this.profileActorId;

      if (actor && (isGM || isOwnCharacter)) {
        const actorId = actor.id;
        
        // Get Profile History (Hidden/Added quests)
        const profileHistory = (settings.profileHistory || {})[actorId] || { hidden: [], added: [] };
        
        // Determine quests for this actor (For FQL, we show all history for now as assignment is complex)
        let historyQuests = [];
        if (useFQL) {
          historyQuests = allQuests.filter(q => {
             // Exclude manually hidden quests
             if (profileHistory.hidden.includes(q.id)) return false;
             // Check FQL actors (if specific assignment exists)
             if (q.actors && q.actors.length > 0) {
                 return q.actors.includes(actorId);
             }
             // Party quest (no specific actors) - include by default, GM can hide manually
             return true;
          });
        } else {
          historyQuests = (settings.quests || []).filter(q => 
            ((q.assignedTo === actorId) || (Array.isArray(q.assignedTo) && q.assignedTo.includes(actorId))) &&
            !profileHistory.hidden.includes(q.id)
          );
        }
        
        // Add Manual/Legacy Quests
        if (profileHistory.added) {
            historyQuests = historyQuests.concat(profileHistory.added);
        }

        profile = {
          id: actorId,
          name: actor.name,
          img: actor.img,
          badges: (settings.meritBadges || []).filter(b => (b.earnedBy || []).includes(actorId)).map(b => ({
            ...b,
            isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
          })),
          factions: processedFactions.filter(f => (f.members || []).some(m => m.id === actorId)).map(f => {
            const member = f.members.find(m => m.id === actorId);
            return {
              id: f.id,
              name: f.name,
              image: f.image,
              isImage: f.isImage,
              rank: member ? (f.ranks[member.rank]?.name || member.rank) : ''
            };
          }),
          messages: (settings.inbox || []).filter(m => {
            const to = Array.isArray(m.to) ? m.to : [m.to];
            const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
            return to.includes(actorId) || cc.includes(actorId);
          }),
          completedQuests: historyQuests.filter(q => q.status === 'Completed'),
          failedQuests: historyQuests.filter(q => q.status === 'Failed')
        };
      } else {
        this.profileActorId = null;
      }
    }

    // Process Inbox for Current User (Threading)
    let userInbox = [];
    
    if (isGM) {
      userInbox = settings.inbox || [];
    } else {
      const myActorIds = game.actors.filter(a => a.isOwner).map(a => a.id);
      userInbox = (settings.inbox || []).filter(m => {
        const to = Array.isArray(m.to) ? m.to : [m.to];
        const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
        const isSender = myActorIds.includes(m.fromId) || m.fromId === game.user.id;
        return isSender || to.some(id => myActorIds.includes(id)) || cc.some(id => myActorIds.includes(id));
      });

      // Include pending messages in view
      const pending = game.user.getFlag('intoterica', 'pendingOutbox') || [];
      if (pending.length > 0) {
          userInbox = [...pending, ...userInbox];
      }
    }

    // Known NPCs (Moved up for message processing)
    const knownNPCIds = settings.knownNPCs || [];

    // Helper to mask unknown senders
    const getMessageDisplayData = (msg) => {
        let displayFrom = msg.from;
        let displayImage = msg.image;
        
        if (!isGM && msg.fromId && !knownNPCIds.includes(msg.fromId)) {
            const actor = game.actors.get(msg.fromId);
            if (actor && !actor.hasPlayerOwner) {
                displayFrom = "Unknown Sender";
                displayImage = "icons/svg/mystery-man.svg";
            }
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
      latest = getMessageDisplayData(latest);
      return {
        ...latest,
        isImage: latest.image && (latest.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(latest.image))
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const knownNPCs = knownNPCIds.map(id => game.actors.get(id)).filter(a => a);
    const allNPCs = game.actors.filter(a => !a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));

    // Mail Context (Compose/View)
    let mailContext = {};
    if (this.currentView === 'mail') {
        const npcs = game.actors.filter(a => !a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));
        const players = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
        const availableNPCs = isGM ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));
        const allRecipients = [...players, ...availableNPCs];

        if (this.mailComposeData) {
            const defaults = this.mailComposeData;
            let fromOptions = [];
            if (isGM) {
                if (!defaults.fromId && npcs.length > 0) defaults.fromId = npcs[0].id;
                fromOptions = npcs.map(a => ({id: a.id, name: a.name, selected: a.id === defaults.fromId}));
            } else {
                const myActors = game.actors.filter(a => a.isOwner);
                if (myActors.length > 0) {
                    myActors.sort((a, b) => a.name.localeCompare(b.name));
                    const defaultId = defaults.fromId || game.user.character?.id || myActors[0].id;
                    fromOptions = myActors.map(a => ({id: a.id, name: a.name, selected: a.id === defaultId}));
                } else {
                    fromOptions = [{id: game.user.id, name: game.user.name, selected: true}];
                }
            }

            // Helper to get actor data for chips
            const getRecipientData = (ids) => {
                if (!ids) return [];
                const idList = Array.isArray(ids) ? ids : [ids];
                return idList.map(id => {
                    let actor = allRecipients.find(a => a.id === id);
                    let isUnknown = false;
                    // Handle replying to unknown sender (not in allRecipients)
                    if (!actor) {
                        const unknownActor = game.actors.get(id);
                        if (unknownActor && !unknownActor.hasPlayerOwner && !isGM && !knownNPCIds.includes(id)) {
                            return { id: id, name: "Unknown Sender", image: "icons/svg/mystery-man.svg", isUnknown: true };
                        }
                        actor = unknownActor;
                    }
                    
                    if (!actor) return null;
                    
                    return {
                        id: actor.id,
                        name: actor.name,
                        image: actor.prototypeToken?.texture?.src || actor.img,
                        isUnknown: false
                    };
                }).filter(Boolean);
            };

            const formatIds = (ids) => Array.isArray(ids) ? ids.join(",") : (ids || "");

            // Determine current sender for visual display
            const currentFromId = defaults.fromId || (fromOptions.find(o => o.selected)?.id) || fromOptions[0]?.id;
            const currentFromActor = game.actors.get(currentFromId);
            const currentFrom = currentFromActor ? {
                id: currentFromActor.id,
                name: currentFromActor.name,
                image: currentFromActor.prototypeToken?.texture?.src || currentFromActor.img
            } : (isGM ? { id: 'gm', name: game.user.name, image: 'icons/svg/mystery-man.svg' } : null);

            mailContext.compose = {
                fromOptions,
                currentFrom,
                toRecipients: getRecipientData(defaults.to),
                toIds: formatIds(defaults.to),
                ccRecipients: getRecipientData(defaults.cc),
                ccIds: formatIds(defaults.cc),
                subject: defaults.subject || "",
                body: defaults.body || ""
            };
        } else if (this.mailViewSubject !== null) {
            const closedThreads = settings.closedThreads || [];
            const normalizedViewSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
            
            const threadMessages = (settings.inbox || []).filter(m => {
                const mSubject = m.subject || "(No Subject)";
                return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedViewSubject;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Check if normalized subject is in closedThreads list
            const isClosed = closedThreads.includes(normalizedViewSubject);

            mailContext.thread = {
                subject: this.mailViewSubject,
                messages: threadMessages.map(getMessageDisplayData),
                isClosed: isClosed
            };
        }
    }

    return {
      isGM,
      clockDisplay,
      canEditClock: isGM && !useWorldClock,
      theme: game.settings.get('intoterica', 'theme'),
      currentView: this.currentView,
      selectedFaction: this.selectedFaction,
      meritBadges: (settings.meritBadges || []).map(b => ({
        ...b,
        isImage: b.icon && (b.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(b.icon))
      })),
      quests: activeQuests, // Only active quests for the main list
      factions: processedFactions,
      players: players,
      profile: profile,
      inbox: displayInbox,
      knownNPCs: knownNPCs,
      mailContext: mailContext,
      showDashboard: this.currentView === 'dashboard' && !this.profileActorId,
      showProfile: this.currentView === 'dashboard' && this.profileActorId,
      stats: {
        activeQuests: activeQuests.length,
        unreadMail: (settings.inbox || []).filter(m => {
            const myActorIds = isGM ? [] : game.actors.filter(a => a.isOwner).map(a => a.id);
            const to = Array.isArray(m.to) ? m.to : [m.to];
            const cc = Array.isArray(m.cc) ? m.cc : [m.cc];
            return m.status === 'unread' && (isGM || (to.some(id => myActorIds.includes(id)) || cc.some(id => myActorIds.includes(id))));
        }).length,
        earnedBadges: (settings.meritBadges || []).filter(b => b.earned).length
      },
      worldClock: settings.worldClock || { era: 4, day: 442 }
    };
  }

  async _onRender(_context, _options) {
    const html = $(this.element);

    // CRITICAL FIX: Prevent form submission globally using the nuclear option
    html.find('form').attr('onsubmit', 'return false;').on('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    });
    // Ensure all buttons are explicitly typed as buttons
    html.find('button').prop('type', 'button');

    // Fix XP Modifier badge color for Neutral/Wary (Light background)
    if (this.selectedFaction) {
      const rep = this.selectedFaction.reputation;
      if (rep > -30 && rep < 10) {
        html.find('.xp-modifier-badge').css({
          'color': '#000000',
          'border-color': '#000000'
        });
      }
    }

    // Known NPCs Drag & Drop (GM Only)
    if (this.currentView === 'known-npcs' && game.user.isGM) {
        const dropZone = html.find('.known-npcs-container')[0];
        if (dropZone) {
            dropZone.addEventListener('dragover', e => e.preventDefault());
            dropZone.addEventListener('drop', this._onDropKnownNPC.bind(this));
        }
        html.find('.remove-known-npc').click(this._onRemoveKnownNPC.bind(this));
    }

    // Mail Integrated Controls
    if (this.currentView === 'mail') {
        html.find('.compose-mail').click(this._onComposeMail.bind(this));
        // Force select value for GM sender to match state
        if (_context.mailContext?.compose?.currentFrom?.id && game.user.isGM) {
             html.find('select[name="fromId"]').val(_context.mailContext.compose.currentFrom.id);
        }

        // Compose Actions
        html.find('.send-mail-btn').click(this._onSendMailAction.bind(this));
        html.find('.cancel-compose-btn').click(this._onCancelCompose.bind(this));
        html.find('.reply-btn').click(this._onReplyAction.bind(this));
        html.find('.end-conversation-btn').click(this._onEndConversation.bind(this));
        html.find('.reopen-conversation-btn').click(this._onReopenConversation.bind(this));
        html.find('.delete-message-btn').click(this._deleteMessage.bind(this));
        
        // Address Book
        html.find('.open-address-book').click(ev => {
            const target = ev.currentTarget.dataset.target;
            const currentIds = (this.mailComposeData[target] || []);
            const npcs = game.actors.filter(a => a.type === 'npc').sort((a, b) => a.name.localeCompare(b.name));
            const players = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
            const knownNPCIds = game.settings.get('intoterica', 'data').knownNPCs || [];
            const availableNPCs = game.user.isGM ? npcs : npcs.filter(n => knownNPCIds.includes(n.id));

            this._openAddressBook(currentIds, players, availableNPCs, (newIds) => {
                this.mailComposeData[target] = newIds;
                this.render();
            });
        });

        // GM From Selection Change
        html.find('select[name="fromId"]').on('change', ev => {
            ev.preventDefault();
            if (this.mailComposeData) {
                this.mailComposeData.fromId = $(ev.currentTarget).val();
                this.render();
            }
        });

        // Input preservation on re-render
        html.find('input[name="subject"]').on('input', ev => {
             if (this.mailComposeData) this.mailComposeData.subject = ev.target.value;
        });
        html.find('textarea[name="body"]').on('input', ev => {
             if (this.mailComposeData) this.mailComposeData.body = ev.target.value;
        });
    }

    // View switching (available to all users)
    if (this._onViewChange) html.find('.nav-item').click(this._onViewChange.bind(this));

    // Faction selection (available to all users)
    if (this._onSelectFaction) html.find('.faction-card').click(this._onSelectFaction.bind(this));
    if (this._onReadMessage) html.find('.inbox-item').click(this._onReadMessage.bind(this));
    if (this._onSelectPlayer) html.find('.player-card').click(this._onSelectPlayer.bind(this));
    
    // Profile Back Button - Explicit binding with off() to prevent duplicates
    if (this._onCloseProfile) {
      html.find('.back-btn').off('click').on('click', this._onCloseProfile.bind(this));
    }

    // FQL Integration
    if (game.modules.get("forien-quest-log")?.active) {
      html.find('.add-quest').hide();
      html.find('.quest-actions').hide();
      
      // Inject Headers for File Folder Look
      const questItems = html.find('.quest-item');
      
      questItems.each((i, el) => {
        const $el = $(el);
        const id = $el.find('[data-quest-id]').data('questId') || $el.data('questId');
        const quest = _context.quests.find(q => q.id === id);
        
        // Inject Splash Art if available
        if (quest && quest.image) {
          $el.prepend(`<img src="${quest.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #4a3b28; flex-shrink: 0;">`);
        }
        
        $el.css('cursor', 'pointer').attr('title', 'Open Quest Log').click(ev => {
          ev.preventDefault();
          ev.stopPropagation();
        const journal = game.journal.get(id);
        if (journal) journal.sheet.render(true);
      });
      });
    } else {
      // Hide Quest Tab if FQL is not active
      html.find('.nav-item[data-view="quests"]').hide();
      if (this.currentView === 'quests') {
        this.currentView = 'dashboard';
        this.render();
      }
    }

    // Inject Profile "Mission Report" (Completed/Failed Quests)
    if (this.profileActorId && _context.profile) {
      const content = html.find('.intoterica-content');
      
      const generateQuestHtml = (quests, statusClass) => {
        if (!quests || quests.length === 0) return '<div class="empty-text">None recorded</div>';
        return quests.map(q => `
          <div class="quest-item" style="cursor: pointer; position: relative;" data-quest-id="${q.id}" data-is-manual="${q.isManual || false}">
            ${q.image ? `<img src="${q.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #4a3b28; flex-shrink: 0;">` : ''}
            <div class="quest-content">
              <div class="quest-header">
                <div class="quest-title">${q.title}</div>
                ${game.user.isGM ? `<i class="fas fa-trash remove-profile-quest" title="Remove from Report" style="margin-left: auto; color: #c92a2a; cursor: pointer; z-index: 10;"></i>` : ''}
              </div>
              <div class="quest-status ${statusClass}">${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}</div>
            </div>
          </div>
        `).join('');
      };

      const reportHtml = `
        <div class="section-header" style="margin-top: 2rem;">
            <div class="section-title">Mission Report</div>
            ${game.user.isGM ? `<button type="button" class="add-legacy-quest" style="font-size: 12px;"><i class="fas fa-plus"></i> Add Entry</button>` : ''}
        </div>
        <div class="content-grid two-column" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="report-column">
             <h3 class="quest-section-header completed">Completed</h3>
             ${generateQuestHtml(_context.profile.completedQuests, 'completed')}
          </div>
          <div class="report-column">
             <h3 class="quest-section-header failed">Failed</h3>
             ${generateQuestHtml(_context.profile.failedQuests, 'failed')}
          </div>
        </div>
      `;
      
      content.append(reportHtml);

      // Re-bind clicks for the injected quests
      if (game.modules.get("forien-quest-log")?.active) {
        content.find('.report-column .quest-item').click(ev => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = $(ev.currentTarget).data('questId');
          const journal = game.journal.get(id);
          if (journal) journal.sheet.render(true);
        });
      }
      
      if (game.user.isGM) {
          content.find('.remove-profile-quest').click(this._onRemoveProfileQuest.bind(this));
          content.find('.add-legacy-quest').click(this._onAddLegacyQuest.bind(this));
      }
    }

    // GM-only controls
    if (game.user.isGM) {
      if (this._onAddBadge) html.find('.add-badge').click(this._onAddBadge.bind(this));
      if (this._onManageBadge) html.find('.manage-badge').click(this._onManageBadge.bind(this));
      if (this._onEditBadge) html.find('.edit-badge').click(this._onEditBadge.bind(this));
      if (this._onAddQuest) html.find('.add-quest').click(this._onAddQuest.bind(this));
      if (this._onCompleteQuest) html.find('.complete-quest').click(this._onCompleteQuest.bind(this));
      if (this._onEditQuest) html.find('.edit-quest').click(this._onEditQuest.bind(this));
      if (this._onAdjustReputation) html.find('.adjust-reputation').click(this._onAdjustReputation.bind(this));
      if (this._onAddFaction) html.find('.add-faction').click(this._onAddFaction.bind(this));
      if (this._onAddMember) html.find('.add-member').click(this._onAddMember.bind(this));
      if (this._onComposeMail) html.find('.compose-mail').click(this._onComposeMail.bind(this));
      if (this._onEditClock) html.find('.edit-clock').click(this._onEditClock.bind(this));
      if (this._onAwardXP) html.find('.award-xp').click(this._onAwardXP.bind(this));
      if (this._onToggleAutoRep) html.find('.toggle-auto-rep').change(this._onToggleAutoRep.bind(this));
      if (this._onMemberRepChange) html.find('.member-rep-slider').change(this._onMemberRepChange.bind(this));
      if (this._onFactionRepSliderChange) html.find('.faction-rep-slider').change(this._onFactionRepSliderChange.bind(this));
      if (this._onEditFaction) html.find('.edit-faction').click(this._onEditFaction.bind(this));
      if (this._onEnlistFaction) html.find('.enlist-faction').click(this._onEnlistFaction.bind(this));
      if (this._onRemoveMember) html.find('.remove-member').click(this._onRemoveMember.bind(this));
    }

    // Start idle sound if enabled (Async - do not await to prevent blocking UI)
    const enableSounds = game.settings.get('intoterica', 'enableSounds');
    const soundPath = game.settings.get('intoterica', 'soundIdle');

    if (enableSounds && !this._idleSound && soundPath) {
      foundry.audio.AudioHelper.play({
        src: soundPath,
        volume: 0.2,
        loop: true
      }, false).then(sound => {
        this._idleSound = sound;
      }).catch(err => {
        console.warn("Intoterica | Error playing idle sound:", err);
      });
    }
  }

  _onViewChange(event) {
    event.preventDefault();
    if (game.settings.get('intoterica', 'enableSounds')) {
      const soundPath = game.settings.get('intoterica', 'soundNav');
      if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: 0.8, autoplay: true, loop: false}, true);
    }
    this.currentView = event.currentTarget.dataset.view;
    this.profileActorId = null;
    this.render();
  }

  _onSelectPlayer(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    const targetUser = game.users.find(u => u.character?.id === actorId);
    
    if (game.user.isGM || (targetUser && targetUser.isSelf)) {
      this.profileActorId = actorId;
      this.render();
    }
  }

  _onCloseProfile(event) {
    event.preventDefault();
    event.stopPropagation();
    this.profileActorId = null;
    // Small delay to ensure event bubbling finishes before DOM destruction
    setTimeout(() => this.render(), 10);
  }

  _onSelectFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    this.selectedFaction = settings.factions.find(f => f.id === factionId);
    this.render();
  }

  async _onReadMessage(event) {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    const settings = game.settings.get('intoterica', 'data');
    
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;

    // Set view state
    this.mailViewSubject = message.subject || "(No Subject)";
    this.mailComposeData = null;
    this.render();
    
    if (!game.user.isGM) {
        game.socket.emit('module.intoterica', {
            type: 'dispatch',
            action: 'readMessage',
            payload: { messageId }
        });
        return;
    }

    // Find Thread
    const normalizedSubject = this.mailViewSubject.replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const threadMessages = settings.inbox.filter(m => {
        const mSubject = m.subject || "(No Subject)";
        return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Mark all as read for this user
    let updated = false;
    threadMessages.forEach(m => {
        if (m.status === 'unread') {
            m.status = 'read';
            updated = true;
        }
    });

    if (updated) {
      await game.settings.set('intoterica', 'data', settings); 
      this._broadcastUpdate();
      this.render();
    }
  }

  async _performReadMessage(messageId) {
    const settings = game.settings.get('intoterica', 'data');
    const message = settings.inbox.find(m => m.id === messageId);
    if (!message) return;

    const normalizedSubject = (message.subject || "(No Subject)").toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
    const threadMessages = settings.inbox.filter(m => {
        const mSubject = m.subject || "(No Subject)";
        return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
    });

    let updated = false;
    threadMessages.forEach(m => {
        if (m.status === 'unread') {
            m.status = 'read';
            updated = true;
        }
    });

    if (updated) {
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
    }
  }

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
  }

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
    
    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info("Message deleted.");
  }

  async _onEndConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      if (!settings.closedThreads) settings.closedThreads = [];
      
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      if (!settings.closedThreads.includes(normalizedSubject)) {
          settings.closedThreads.push(normalizedSubject);
      }
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
  }

  async _onReopenConversation(event) {
      event.preventDefault();
      if (this.mailViewSubject === null) return;
      const settings = game.settings.get('intoterica', 'data');
      const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      settings.closedThreads = (settings.closedThreads || []).filter(s => s !== normalizedSubject);
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
  }

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
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
        this.render();
        ui.notifications.info(`${actor.name} added to Known NPCs.`);
    }
  }

  async _onRemoveKnownNPC(event) {
      event.preventDefault();
      const id = event.currentTarget.dataset.id;
      const settings = game.settings.get('intoterica', 'data');
      settings.knownNPCs = (settings.knownNPCs || []).filter(k => k !== id);
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
  }

  async _onAddBadge(event) {
    event.preventDefault();
    
    new Dialog({
      title: "Create Merit Badge",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Badge Name</label>
            <input type="text" name="name" placeholder="Enter badge name" autofocus />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" placeholder="Achievement description" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Icon</label>
            <div style="display: flex; gap: 5px;">
                <input type="text" name="icon" value="⭐" />
                <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
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
    }).render(true);
  }

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
    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Badge "${data.name}" created`);
  }

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

    new Dialog({
      title: "Manage Badge Awards",
      content: `<form class="intoterica-form"><p>Select players to award <strong>${badge.name}</strong>:</p>${players.map(p => `<div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;"><input type="checkbox" name="${p.id}" ${p.hasBadge ? 'checked' : ''} style="width: auto; margin: 0;"><label style="margin: 0;">${p.name}</label></div>`).join('')}</form>`,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            const newEarnedBy = Object.keys(formData).filter(k => formData[k]);
            const newlyAwarded = newEarnedBy.filter(id => !previousEarned.includes(id));
            
            badge.earnedBy = newEarnedBy;
            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate();
            this.render();
            
            if (newlyAwarded.length > 0) {
                this._sendBadgeNotifications(badge, newlyAwarded);
            }
          }
        }
      },
      default: "save"
    }).render(true);
  }

  _sendBadgeNotifications(badge, actorIds) {
      const isImage = badge.icon && (badge.icon.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(badge.icon));
      
      actorIds.forEach(actorId => {
          const actor = game.actors.get(actorId);
          if (actor) {
              ChatMessage.create({
                  content: `
                    <div style="text-align: center; border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;">
                      <h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">Merit Badge Awarded!</h3>
                      <div style="padding: 10px;">
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
  }

  async _onEditBadge(event) {
    event.preventDefault();
    const badgeId = event.currentTarget.dataset.badgeId;
    const settings = game.settings.get('intoterica', 'data');
    const badge = settings.meritBadges.find(b => b.id === badgeId);
    if (!badge) return;

    new Dialog({
      title: "Edit Merit Badge",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Badge Name</label>
            <input type="text" name="name" value="${badge.name}" placeholder="Enter badge name" autofocus />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" placeholder="Achievement description" rows="3">${badge.description}</textarea>
          </div>
          <div class="form-group">
            <label>Icon</label>
            <div style="display: flex; gap: 5px;">
                <input type="text" name="icon" value="${badge.icon}" />
                <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            
            badge.name = formData.name;
            badge.description = formData.description;
            badge.icon = formData.icon;

            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        delete: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Delete",
            callback: async () => {
                settings.meritBadges = settings.meritBadges.filter(b => b.id !== badgeId);
                await game.settings.set('intoterica', 'data', settings);
                this._broadcastUpdate();
                this.render();
            }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => { html.find('.file-picker').click(ev => new FilePicker({ type: "image", callback: (path) => html.find('input[name="icon"]').val(path) }).render(true)); },
      default: "save"
    }).render(true);
  }

  async _onAddQuest(event) {
    event.preventDefault();
    
    new Dialog({
      title: "Add Quest",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Quest Title</label>
            <input type="text" name="title" placeholder="Enter quest title" autofocus />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" placeholder="Quest details" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label>Difficulty</label>
            <select name="difficulty">
              <option value="Easy">Easy</option>
              <option value="Medium" selected>Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            await this._createQuest(formData);
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
    }).render(true);
  }

  async _createQuest(data) {
    const settings = game.settings.get('intoterica', 'data');
    const newQuest = {
      id: foundry.utils.randomID(),
      title: data.title,
      description: data.description,
      difficulty: data.difficulty || "Medium",
      status: "Active",
      assignedTo: []
    };
    
    settings.quests.push(newQuest);
    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Quest "${data.title}" created`);
  }

  async _onCompleteQuest(event) {
    event.preventDefault();
    const questId = event.currentTarget.dataset.questId;
    const settings = game.settings.get('intoterica', 'data');
    const quest = settings.quests.find(q => q.id === questId);
    if (quest) {
      quest.status = 'Completed';
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
      ui.notifications.info(`Quest "${quest.title}" completed`);
    }
  }

  async _onAdjustReputation(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const delta = parseInt(event.currentTarget.dataset.delta);
    const settings = game.settings.get('intoterica', 'data');
    
    const faction = settings.factions.find(f => f.id === factionId);
    if (faction) {
      const oldRep = faction.reputation;
      faction.reputation = Math.max(-100, Math.min(100, faction.reputation + delta));
      const actualDelta = faction.reputation - oldRep;

      if (actualDelta !== 0) {
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
        this.selectedFaction = faction;
        this.render();

        ChatMessage.create({
          content: `<div style="text-align: center; border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;"><h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">Faction Update: ${faction.name}</h3><div style="padding: 10px;"><div>Party Reputation: <strong>${faction.reputation}</strong> (${actualDelta > 0 ? '+' : ''}${actualDelta})</div></div></div>`
        });
      }
    }
  }

  async _onAddFaction(event) {
    event.preventDefault();
    
    new Dialog({
      title: "Create Faction",
      content: `
        <form class="intoterica-form" style="min-width: 350px;">
          <div class="form-group">
            <label>Faction Name</label>
            <input type="text" name="name" placeholder="Enter faction name" autofocus />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" placeholder="Faction background and goals" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Icon</label>
            <div style="display: flex; gap: 5px;">
                <input type="text" name="image" value="⚔️" />
                <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
            </div>
          </div>
          <div class="form-group">
            <label>Allow Player Enlistment</label>
            <input type="checkbox" name="allowEnlistment" />
          </div>
          <div class="form-group" style="flex-direction: column; align-items: stretch;">
            <label style="margin-bottom: 5px;">Ranks Configuration</label>
            <div style="display: flex; flex-direction: column;">
                <div class="ranks-header" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: var(--theme-dim); align-items: center;">
                    <div>Rank Name</div>
                    <div style="text-align: center;">XP Req.</div>
                    <div style="text-align: center;">Rep Mod.</div>
                    <div></div>
                </div>
                <div class="ranks-container">
                    <div class="rank-row" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; margin-bottom: 5px; align-items: center;">
                        <input type="text" class="rank-name" value="Initiate" placeholder="Name" style="width: 100%;" />
                        <input type="number" class="rank-xp" value="0" placeholder="XP" style="width: 100%; text-align: center;" />
                        <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="Mod" style="width: 100%; text-align: center;" />
                        <button type="button" class="delete-rank" title="Remove Rank" style="color: #c92a2a; border: 1px solid #c92a2a; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <button type="button" class="add-rank" style="margin-top: 5px; width: 100%; font-size: 11px;"><i class="fas fa-plus"></i> Add Rank</button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            
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

            await this._createFaction(formData);
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
        
        html.find('.add-rank').click(ev => {
            const row = $(`
              <div class="rank-row" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; margin-bottom: 5px; align-items: center;">
                <input type="text" class="rank-name" placeholder="Name" style="width: 100%;" />
                <input type="number" class="rank-xp" value="0" placeholder="XP" style="width: 100%; text-align: center;" />
                <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="Mod" style="width: 100%; text-align: center;" />
                <button type="button" class="delete-rank" title="Remove Rank" style="color: #c92a2a; border: 1px solid #c92a2a; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fas fa-trash"></i></button>
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
    }).render(true);
  }

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
      description: data.description,
      image: data.image || "⚔️",
      reputation: 0,
      autoCalc: false,
      allowEnlistment: data.allowEnlistment || false,
      ranks: ranks,
      members: []
    };
    
    settings.factions.push(newFaction);
    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
    ui.notifications.info(`Faction "${data.name}" created`);
  }

  async _onEditFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (!faction) return;

    const ranksHtml = faction.ranks.map(r => `
      <div class="rank-row" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; margin-bottom: 5px; align-items: center;">
        <input type="text" class="rank-name" value="${r.name}" placeholder="Name" style="width: 100%;" />
        <input type="number" class="rank-xp" value="${r.xp}" placeholder="XP" style="width: 100%; text-align: center;" />
        <input type="number" class="rank-mod" value="${r.modifier}" step="0.1" placeholder="Mod" style="width: 100%; text-align: center;" />
        <button type="button" class="delete-rank" title="Remove Rank" style="color: #c92a2a; border: 1px solid #c92a2a; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    new Dialog({
      title: "Edit Faction",
      content: `
        <form class="intoterica-form" style="min-width: 350px;">
          <div class="form-group">
            <label>Faction Name</label>
            <input type="text" name="name" value="${faction.name}" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="3">${faction.description}</textarea>
          </div>
          <div class="form-group">
            <label>Icon</label>
            <div style="display: flex; gap: 5px;">
                <input type="text" name="image" value="${faction.image}" />
                <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
            </div>
          </div>
          <div class="form-group">
            <label>Allow Player Enlistment</label>
            <input type="checkbox" name="allowEnlistment" ${faction.allowEnlistment ? 'checked' : ''} />
          </div>
          <div class="form-group" style="flex-direction: column; align-items: stretch;">
            <label style="margin-bottom: 5px;">Ranks Configuration</label>
            <div style="display: flex; flex-direction: column;">
                <div class="ranks-header" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: var(--theme-dim); align-items: center;">
                    <div>Rank Name</div>
                    <div style="text-align: center;">XP Req.</div>
                    <div style="text-align: center;">Rep Mod.</div>
                    <div></div>
                </div>
                <div class="ranks-container">
                    ${ranksHtml}
                </div>
                <button type="button" class="add-rank" style="margin-top: 5px; width: 100%; font-size: 11px;"><i class="fas fa-plus"></i> Add Rank</button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;

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
        html.find('.file-picker').click(ev => {
            const input = $(ev.currentTarget).prev('input');
            new FilePicker({
                type: "image",
                callback: (path) => input.val(path)
            }).render(true);
        });

        html.find('.add-rank').click(ev => {
            const row = $(`
              <div class="rank-row" style="display: grid; grid-template-columns: 1fr 70px 50px 24px; gap: 5px; margin-bottom: 5px; align-items: center;">
                <input type="text" class="rank-name" placeholder="Name" style="width: 100%;" />
                <input type="number" class="rank-xp" value="0" placeholder="XP" style="width: 100%; text-align: center;" />
                <input type="number" class="rank-mod" value="1.0" step="0.1" placeholder="Mod" style="width: 100%; text-align: center;" />
                <button type="button" class="delete-rank" title="Remove Rank" style="color: #c92a2a; border: 1px solid #c92a2a; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fas fa-trash"></i></button>
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
    }).render(true);
  }

  async _updateFaction(factionId, data) {
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (!faction) return;

    let ranks = [];
    if (Array.isArray(data.ranks)) {
        ranks = data.ranks;
    } else if (typeof data.ranks === 'string') {
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

    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
  }

  async _deleteFaction(factionId) {
      const settings = game.settings.get('intoterica', 'data');
      settings.factions = settings.factions.filter(f => f.id !== factionId);
      await game.settings.set('intoterica', 'data', settings);
      this.selectedFaction = null;
      this._broadcastUpdate();
      this.render();
  }

  async _onAddMember(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const actors = game.actors.map(a => ({id: a.id, name: a.name})).sort((a, b) => a.name.localeCompare(b.name));
    
    new Dialog({
      title: "Add Faction Member",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Select Character</label>
            <select name="actorId">
              ${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Rank (0 = lowest)</label>
            <input type="number" name="rank" value="0" min="0" />
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-user-plus"></i>',
          label: "Add",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            await this._addFactionMember(factionId, formData);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "add"
    }).render(true);
  }

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
      
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.selectedFaction = faction;
      this.render();
      ui.notifications.info(`${actor.name} added to ${faction.name}`);
    }
  }

  async _onRemoveMember(event) {
      event.preventDefault();
      const factionId = event.currentTarget.dataset.factionId;
      const memberId = event.currentTarget.dataset.memberId;
      
      const settings = game.settings.get('intoterica', 'data');
      const faction = settings.factions.find(f => f.id === factionId);
      
      if (faction) {
          faction.members = faction.members.filter(m => m.id !== memberId);
          await game.settings.set('intoterica', 'data', settings);
          this._broadcastUpdate();
          this.render();
      }
  }

  async _onEnlistFaction(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    const actor = game.user.character;
    
    if (!game.user.isGM) {
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
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
        this.render();
        ui.notifications.info(`Enlisted in ${faction.name}!`);
    }
  }

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
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
    }
  }

  async _onReplyMail(originalMessage) {
    const sender = game.actors.get(originalMessage.fromId); // The original sender
    
    // Determine recipients (Reply All logic: Sender + Original To + Original CC - Self)
    const originalTo = Array.isArray(originalMessage.to) ? originalMessage.to : [originalMessage.to];
    const originalCc = Array.isArray(originalMessage.cc) ? originalMessage.cc : [originalMessage.cc];
    
    // Determine From ID (Reply as the actor who received it if owned)
    const myActorIds = game.actors.filter(a => a.isOwner).map(a => a.id);
    const myRecipientId = [...originalTo, ...originalCc].find(id => myActorIds.includes(id));
    const replyFromId = myRecipientId || game.user.character?.id || game.user.id;

    let recipients = new Set([...originalTo, ...originalCc]);
    if (originalMessage.fromId) recipients.add(originalMessage.fromId);
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
  }

  async _onComposeMail(event) {
    event.preventDefault();
    this.mailComposeData = {};
    this.mailViewSubject = null;
    this.render();
  }

  _onReplyAction(event) {
      event.preventDefault();
      const settings = game.settings.get('intoterica', 'data');
      if (this.mailViewSubject !== null) {
          const normalizedSubject = this.mailViewSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
          const threadMessages = settings.inbox.filter(m => {
              const mSubject = m.subject || "(No Subject)";
              return mSubject.toString().replace(/^(Re:\s*)+/i, '').trim().toLowerCase() === normalizedSubject;
          }).sort((a, b) => new Date(b.date) - new Date(a.date));
          
          if (threadMessages.length > 0) {
              this._onReplyMail(threadMessages[0]);
          }
      }
  }

  async _onSendMailAction(event) {
    event.preventDefault();
    const form = $(this.element).find('.email-compose-form')[0];
    if (!form) return;
    const fd = new FormData(form);
    const formData = Object.fromEntries(fd.entries());
    
    // Parse to/cc from string to array
    formData.to = formData.to ? formData.to.split(',').filter(Boolean) : [];
    formData.cc = formData.cc ? formData.cc.split(',').filter(Boolean) : [];

    await this._sendMail(formData);
    this.mailComposeData = null;
    this.render();
  }

  _onCancelCompose(event) {
      event.preventDefault();
      this.mailComposeData = null;
      this.render();
  }

  _openAddressBook(selectedIds, players, npcs, callback) {
      const content = `
        <form class="intoterica-address-book" style="min-width: 400px; max-height: 500px; overflow: hidden; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow-y: auto; padding: 5px;">
                <div class="section-header" style="border-bottom: 1px solid #ccc; margin-bottom: 5px; font-weight: bold;">Players</div>
                <div class="player-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 15px;">
                    ${players.map(p => `
                        <div style="display: flex; align-items: center; gap: 5px; padding: 3px; background: rgba(0,0,0,0.1); border-radius: 3px;">
                            <input type="checkbox" name="${p.id}" id="ab-${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''} style="margin: 0;">
                            <label for="ab-${p.id}" style="cursor: pointer; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</label>
                        </div>
                    `).join('')}
                </div>

                <div class="section-header" style="border-bottom: 1px solid #ccc; margin-bottom: 5px; font-weight: bold;">NPCs</div>
                <div class="npc-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    ${npcs.map(n => `
                        <div style="display: flex; align-items: center; gap: 5px; padding: 3px; background: rgba(0,0,0,0.1); border-radius: 3px;">
                            <input type="checkbox" name="${n.id}" id="ab-${n.id}" ${selectedIds.includes(n.id) ? 'checked' : ''} style="margin: 0;">
                            <label for="ab-${n.id}" style="cursor: pointer; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.name}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </form>
      `;

      new Dialog({
          title: "Address Book",
          content: content,
          buttons: {
              confirm: {
                  icon: '<i class="fas fa-check"></i>',
                  label: "Confirm",
                  callback: (html) => {
                      const newSelected = [];
                      html.find('input[type="checkbox"]:checked').each((i, el) => {
                          newSelected.push(el.name);
                      });
                      callback(newSelected);
                  }
              }
          },
          default: "confirm"
      }).render(true);
  }

  async _sendMail(data) {
    // Handle disabled select for players
    let fromId = data.fromId;
    if (!fromId) {
        fromId = game.user.character?.id || game.user.id;
    }

    const settings = game.settings.get('intoterica', 'data');
    const sender = game.actors.get(fromId);
    const senderImage = sender ? (sender.prototypeToken?.texture?.src || sender.img) : "👤";

    const newMessage = {
      id: foundry.utils.randomID(),
      from: sender ? sender.name : (game.user.name || "Unknown"),
      fromId: fromId,
      to: data.to,
      cc: data.cc || [],
      image: senderImage,
      subject: data.subject,
      body: data.body,
      date: data.date || new Date().toLocaleString(),
      status: "unread"
    };
    
    if (!game.user.isGM) {
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
            payload: { ...data, fromId }
        });
        ui.notifications.info(`Mail sent!`);
        return;
    }

    settings.inbox.unshift(newMessage);

    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate({ action: 'newMessage' });
    this.render();
    
    // Determine if sender is a player character
    const isPlayerSender = sender && sender.hasPlayerOwner;

    // GM Notification for player messages
    if (isPlayerSender) {
        const senderName = sender.name;
        const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);
        if (gmUsers.length > 0) {
            ChatMessage.create({
                content: `
                    <div style="background: #1a2639; color: #fff; padding: 5px; border: 1px solid #3b6ea5; border-radius: 5px; font-size: 12px;">
                        <strong>${senderName}</strong> has sent a message.
                    </div>
                `,
                whisper: gmUsers
            });
        }
    }

    // Notifications
    const recipients = [...(Array.isArray(data.to) ? data.to : [data.to]), ...(Array.isArray(data.cc) ? data.cc : [data.cc])];
    const recipientUsers = game.users.filter(u => u.character && recipients.includes(u.character.id));
    
    recipientUsers.forEach(u => {
        ChatMessage.create({
            content: `
                <div style="text-align: center; border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;">
                  <h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">You've got mail!</h3>
                  <div style="padding: 10px; background: #1a2639; color: #fff;">
                    <div style="font-size: 48px; margin: 10px 0;">✉️</div>
                    <div style="margin-bottom: 5px;"><strong>${u.character.name}</strong></div>
                    <div style="font-size: 12px;">From: ${newMessage.from}</div>
                    <div style="font-style: italic; margin-top: 5px; color: #ccc;">${newMessage.subject}</div>
                    <button class="intoterica-open-inbox" data-message-id="${newMessage.id}" style="margin-top: 10px; background: #4facfe; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%;">Access Inbox</button>
                  </div>
                </div>
            `,
            whisper: [u.id],
            sound: "modules/intoterica/sounds/VeilMailSound.mp3"
        });
    });

    ui.notifications.info(`Mail sent!`);
  }

  async _onEditClock(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const clock = settings.worldClock || { era: 1, day: 1 };

    new Dialog({
      title: "Edit World Clock",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Era</label>
            <input type="number" name="era" value="${clock.era}" min="1" />
          </div>
          <div class="form-group">
            <label>Day</label>
            <input type="number" name="day" value="${clock.day}" min="1" />
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            settings.worldClock = {
              era: parseInt(formData.era),
              day: parseInt(formData.day)
            };
            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onRemoveProfileQuest(event) {
    event.preventDefault();
    event.stopPropagation();
    const btn = $(event.currentTarget);
    const questItem = btn.closest('.quest-item');
    const questId = questItem.data('questId');
    const isManual = String(questItem.data('isManual')) === "true";
    
    const settings = game.settings.get('intoterica', 'data');
    if (!settings.profileHistory) settings.profileHistory = {};
    if (!settings.profileHistory[this.profileActorId]) settings.profileHistory[this.profileActorId] = { hidden: [], added: [] };
    
    const history = settings.profileHistory[this.profileActorId];
    
    if (isManual) {
        history.added = history.added.filter(q => q.id !== questId);
    } else {
        if (!history.hidden.includes(questId)) history.hidden.push(questId);
    }
    
    await game.settings.set('intoterica', 'data', settings);
    this._broadcastUpdate();
    this.render();
  }

  async _onAddLegacyQuest(event) {
    event.preventDefault();
    new Dialog({
      title: "Add Legacy Quest Entry",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Title</label>
            <input type="text" name="title" placeholder="Quest Title" autofocus />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
          <div class="form-group">
            <label>Image URL</label>
            <div style="display: flex; gap: 5px;">
                <input type="text" name="image" placeholder="path/to/image.webp" />
                <button type="button" class="file-picker" title="Browse"><i class="fas fa-file-import"></i></button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            
            const settings = game.settings.get('intoterica', 'data');
            if (!settings.profileHistory) settings.profileHistory = {};
            if (!settings.profileHistory[this.profileActorId]) settings.profileHistory[this.profileActorId] = { hidden: [], added: [] };
            
            const newQuest = { id: foundry.utils.randomID(), title: formData.title, status: formData.status, image: formData.image, isManual: true };
            settings.profileHistory[this.profileActorId].added.push(newQuest);
            await game.settings.set('intoterica', 'data', settings);
            this._broadcastUpdate();
            this.render();
          }
        }
      },
      render: (html) => { html.find('.file-picker').click(ev => new FilePicker({ type: "image", callback: (path) => html.find('input[name="image"]').val(path) }).render(true)); },
      default: "add"
    }).render(true);
  }

  async _onToggleAutoRep(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const isAuto = event.currentTarget.checked;
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    
    if (faction) {
      faction.autoCalc = isAuto;
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
    }
  }

  async _onFactionRepSliderChange(event) {
    event.preventDefault();
    const factionId = event.currentTarget.dataset.factionId;
    const value = parseInt(event.currentTarget.value);
    const settings = game.settings.get('intoterica', 'data');
    const faction = settings.factions.find(f => f.id === factionId);
    if (faction) {
      const oldRep = faction.reputation;
      faction.reputation = value;
      const delta = value - oldRep;

      if (delta !== 0) {
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
        if (this.selectedFaction && this.selectedFaction.id === factionId) this.selectedFaction.reputation = value;
        setTimeout(() => this.render(), 50);
        ChatMessage.create({
          content: `<div style="text-align: center; border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;"><h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">Faction Update: ${faction.name}</h3><div style="padding: 10px;"><div>Party Reputation: <strong>${faction.reputation}</strong> (${delta > 0 ? '+' : ''}${delta})</div></div></div>`
        });
      }
    }
  }

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
      member.reputation = value;
      const delta = value - oldRep;

      if (delta !== 0) {
        await game.settings.set('intoterica', 'data', settings);
        this._broadcastUpdate();
        setTimeout(() => this.render(), 50);
        ChatMessage.create({
          content: `<div style="text-align: center; border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;"><h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">Faction Member Update: ${faction.name}</h3><div style="padding: 10px;"><div><strong>${member.name}</strong> Reputation: <strong>${member.reputation}</strong> (${delta > 0 ? '+' : ''}${delta})</div></div></div>`
        });
      }
    }
  }

  async _onAwardXP(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const factions = settings.factions || [];
    const players = game.users.filter(u => !u.isGM && u.character).map(u => u.character);

    new Dialog({
      title: "Award Faction XP",
      content: `
        <form class="intoterica-form">
          <div class="form-group">
            <label>Select Faction</label>
            <select name="factionId">
              ${factions.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Base XP Amount</label>
            <input type="number" name="amount" value="100" />
          </div>
          <div class="form-group">
            <label>Select Players</label>
            ${players.map(p => `<div style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="player_${p.id}" checked style="width:auto; margin:0;"> ${p.name}</div>`).join('')}
          </div>
        </form>
      `,
      buttons: {
        award: {
          icon: '<i class="fas fa-star"></i>',
          label: "Award XP",
          callback: async (html) => {
            const form = html[0].querySelector('form');
            const formData = new FormDataExtended(form).object;
            const factionId = formData.factionId;
            const amount = parseInt(formData.amount);
            const playerIds = Object.keys(formData).filter(k => k.startsWith('player_') && formData[k]).map(k => k.replace('player_', ''));
            
            await this._processXPAward(factionId, amount, playerIds);
          }
        }
      },
      default: "award"
    }).render(true);
  }

  async _processXPAward(factionId, baseAmount, playerIds) {
    const settings = game.settings.get('intoterica', 'data');
    const context = await this._prepareContext();
    const faction = settings.factions.find(f => f.id === factionId);
    const processedFaction = context.factions.find(f => f.id === factionId);
    
    if (!faction || !processedFaction) return;

    const modifier = processedFaction.xpMod || 1.0;
    const finalXP = Math.round(baseAmount * modifier);

    let updates = [];

    playerIds.forEach(pid => {
      const member = faction.members.find(m => m.id === pid);
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
      await game.settings.set('intoterica', 'data', settings);
      this._broadcastUpdate();
      this.render();
      
      ChatMessage.create({
        content: `
          <div style="border: 2px solid #3b6ea5; border-radius: 5px; overflow: hidden;">
            <h3 style="background: #3b6ea5; color: #fff; margin: 0; padding: 5px; border-bottom: 1px solid #1a2639;">Faction Update: ${faction.name}</h3>
            <div style="padding: 10px;">
              <div style="font-size: 12px; opacity: 0.8;">XP Modifier: x${modifier} (${processedFaction.statusLabel})</div>
              <ul style="margin: 5px 0; padding-left: 20px;">${updates.map(u => `<li>${u}</li>`).join('')}</ul>
            </div>
          </div>`
      });
      ui.notifications.info(`Awarded ${finalXP} XP to ${updates.length} members.`);
    }
  }

  // Broadcast updates to all connected clients
  _broadcastUpdate(payload = {}) {
    game.socket.emit('module.intoterica', {
      type: 'update',
      ...payload
    });
  }

  // Re-render when receiving updates from other clients
  static handleSocketUpdate() {
    // In V2, check if instance exists and is rendered
    if (IntotericaApp._instance?.rendered) {
      IntotericaApp._instance.render();
    }
  }

  static async handleDispatch(data) {
    if (!game.user.isGM) return;
    
    // Use existing instance if available, otherwise create temporary one for method access
    const instance = IntotericaApp._instance || new IntotericaApp();

    switch (data.action) {
        case 'sendMail':
            await instance._sendMail(data.payload);
            break;
        case 'readMessage':
            await instance._performReadMessage(data.payload.messageId);
            break;
        case 'enlistFaction':
            await instance._performEnlistFaction(data.payload.factionId, data.payload.actorId);
            break;
    }
  }

  static async openInbox(messageId) {
    const app = IntotericaApp._instance || new IntotericaApp();
    if (!app.rendered) await app.render({ force: true });
    
    app.currentView = 'mail';
    
    if (messageId) {
        const settings = game.settings.get('intoterica', 'data');
        const message = settings.inbox.find(m => m.id === messageId);
        if (message) {
            app.mailViewSubject = message.subject || "(No Subject)";
            app.mailComposeData = null;
        }
    }
    app.render({ force: true });
  }
}

// Expose the application class globally so macros and other scripts can access it.
if (typeof window !== 'undefined') window.IntotericaApp = IntotericaApp;

Hooks.on('ready', () => {
  $(document).on('click', '.intoterica-open-inbox', (event) => {
    event.preventDefault();
    const messageId = event.currentTarget.dataset.messageId;
    if (window.IntotericaApp) {
      window.IntotericaApp.openInbox(messageId);
    }
  });
});
