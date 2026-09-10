# Intoterica (v1.1.0) 📖
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jitterbone)

A system-agnostic Foundry VTT campaign management suite for tracking quests, factions, achievements, and communications across any game system.

---

## Features

### 🖥️ Sidebar Launcher
- Direct access from Foundry's left-hand scene controls bar
- Individual quick-link icons for each page (Dashboard, Quests, Factions, Inbox, Achievements, NPCs)
- Click any page icon to open Intoterica directly on that tab — no extra clicks

### 📊 Dashboard
- Live stats: active quests, unread messages, achievements earned
- Faction reputation overview
- Recent messages feed
- Player profiles with badge, faction, and quest summaries

### 📖 Quest Journal & Tracker
- Standalone quest tracker with no external dependencies
- Objective checklists with real-time task completion
- Difficulty tiers (Trivial → Legendary) and reward descriptions
- Primary quest pinning to surface main storyline quests
- Status filtering: All, Active, Available, Completed, Failed
- Player assignment and hidden GM-only notes
- Chat sharing with formatted quest summary cards

### 🏛️ Factions
- Reputation sliders (–100 to +100) with named tiers (Nemesis → Devoted)
- Custom ranks with XP thresholds and reputation modifiers
- XP award system with auto-promotion
- Optional player enlistment
- Weighted reputation auto-calculation from member standings and party rep
- Dynamic faction icons and rep-tier faces

### 🏆 Achievements (Merit Badges)
- Create custom badges with images and descriptions
- GM grant/revoke controls
- Chat notifications on award

### 📧 Inbox (Communications)
- Threaded email-style conversations grouped by subject
- Address book with players and Known NPCs
- Unknown NPC sender masking for players
- Offline delivery — messages queued when GM is offline
- Chat "Access Inbox" notification buttons

---

## Settings

### 🎨 Appearance
- **Interface Theme** — Default / Access Point / Soviet Retro / Dark Fantasy 80s / Vaporwave / Custom
- **Sidebar Launcher Icon** — Choose from Book, Monitor, Scroll, Map, Compass, and more (world-scoped)
- **Default Start View** — Dashboard / Quest Journal / Factions / Inbox / Known NPCs

### ⏰ World Clock
- **Sync with World Clock** — Use Foundry world time or Simple Calendar instead of manual Era/Day

### 🏛️ Factions
- **Enable Faction XP** — Toggle XP-based auto-promotion vs. manual GM rank control

### 🔔 Notifications
- **Chat: Mail Notifications** — Post "You've got mail" cards to chat
- **Chat: Faction Updates** — Post reputation changes and XP awards to chat
- **Chat: Badge Awards** — Post merit badge awards to chat
- **Chat: Quest Updates** — Post quest status changes to chat

### 🔒 Permissions *(minimum role required)*
- **Manage Factions** — Create, edit, delete factions
- **Manage Quests** — Create, edit, complete quests
- **Manage Badges** — Create and award merit badges
- **Manage Mail & NPCs** — View all mail, moderate threads, manage Known NPCs
- **Edit Clock** — Modify the world clock
- **View Full Profiles** — See other players' full profiles

### 🔊 Sound
- **Enable Sounds** — Toggle interface sounds and background ambience
- **Volume Controls** *(Custom Configuration theme only)*
  - Ambience Volume
  - Interface Volume
  - Notification Volume
- **Sound Files** *(Custom Configuration theme only)*
  - Background Ambience File
  - Navigation Click Sound File
  - New Message Sound File

### ⚙️ Advanced *(Custom Configuration theme only)*
- **Custom CSS** — Inject custom CSS to fully override the interface style

---

## Compatibility

| | |
|---|---|
| **Game System** | System Agnostic (works with any system) |
| **Foundry VTT** | v13+ / v14 (Verified) |
| **Simple Calendar** | Supported (world clock integration) |
| **Calendaria** | Supported (world clock integration) |

---

## Installation

**Manifest URL:**
```
https://github.com/Jitterbone/intoterica/releases/latest/download/module.json
```

1. Copy the URL above.
2. In Foundry VTT go to **Add-on Modules → Install Module**.
3. Paste the URL into the **Manifest URL** field and click **Install**.

---

## Usage

**Opening the App:**
- Click any page icon in Foundry's left-hand sidebar controls to jump directly to that page.
- Or run in the console: `IntotericaApp.toggle()` / `IntotericaApp.openTo('quests')`

**Quests:**
- GMs create quests in the Quests tab — define checklists, difficulty, rewards, and splash art.
- Pin primary quests to keep them at the top of the tracker.
- Click the chat bubble icon on any quest card to share a progress summary to chat.

**Factions:**
- GMs create factions in the Factions tab.
- Toggle **Auto-Calculate** to derive faction standing from member standings.
- Use **Award XP** to distribute faction experience and trigger auto-promotions.

**Mail:**
- GMs drag-and-drop Actors into the **Known NPCs** tab to make them contactable.
- Players use **Compose** in the Inbox to send threaded messages.

**Theming:**
- Switch visual themes in Module Settings under **Appearance**.
- The **Custom Configuration** theme unlocks full volume controls, custom sound file pickers, and a CSS override field.

---

## License

MIT License — Free to use and modify