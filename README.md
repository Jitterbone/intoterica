# Intoterica (v1.5.0) 📖
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jitterbone)

A system-agnostic Foundry VTT campaign management suite for tracking quests, substories, factions, achievements, and communications across any game system.

---

## Features

### 🖥️ Sidebar Launcher
- Direct access from Foundry's left-hand scene controls bar
- Individual quick-link icons for each page (Dashboard, Quests, Factions, Inbox, Achievements, NPCs)
- Click any page icon to open Intoterica directly on that tab — no extra clicks

### 📊 Dashboard & Character Profiles
- Live stats: active quests, unread messages, achievements earned
- Faction reputation overview
- Recent messages feed
- Comprehensive player profiles retaining completed quest history, faction rankings/XP, and merit badges

### 📖 Quest Journal, Substories & Reward Distribution
- Standalone quest tracker with zero required external dependencies
- **Substories & Objective Hierarchy**: Convert objectives into nested substories with draggable reordering and sub-tasks
- **Dynamic Difficulty Scales**: Standard RPG tiers (Trivial → Legendary) and customizable metal rankings
- **Automated Reward Distribution**: Directly award currencies (split or full), equipment/items, faction standing, and faction XP on quest completion
- **Quest Giver Folder Hierarchy**: Browse and select quest givers organized neatly by Foundry Actor folders, with automatic registration into Known NPCs
- Primary quest pinning to surface main storylines
- Comprehensive filtering: Search, difficulty, quest givers, and status (Active, Available, Completed, Failed)
- Player assignment with "Whole Party" default and hidden GM-only notes
- One-click chat sharing with formatted quest summary cards

### 🏛️ Factions & Standing System
- Reputation sliders (–100 to +100) with named tiers (Nemesis → Devoted)
- Custom ranks with configurable XP thresholds and reputation modifiers
- **Member-Strict Faction XP Awards**: Faction XP and promotions are strictly granted to enrolled faction members, while reputation applies to everyone/party standing
- Optional player enlistment allowing player-initiated membership requests
- Weighted reputation auto-calculation blending individual member standings with party standing
- Dynamic faction icons, fixed-ratio emblems, and rep-tier status faces

### 🏆 Achievements (Merit Badges)
- Create custom badges with images, descriptions, and rank badges
- GM grant/revoke controls with instant player profile updates
- Automated chat announcements on award

### 📧 Inbox & Communications
- Threaded email-style conversations grouped by subject
- Address book featuring player characters and Known NPCs with folder-based sender selection
- Unknown NPC sender masking for players
- Offline delivery queueing for when GM or recipients are offline
- Interactive chat "Access Inbox" notification cards

### 💾 Data Manager & Character Migration Tool
- Standalone migration utility for seamless transfer of character progress (quests, faction standings, merit badges, mail messages, and profile history) between actors
- Full JSON backup export, import, validation, and in-app editor

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