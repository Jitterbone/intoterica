# Intoterica

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jitterbone)

A native Foundry VTT campaign management system for tracking quests, factions, achievements, and communications.

## Features

### 📊 Dashboard
- Quick stats: Active quests, unread messages, achievements earned
- Faction reputation overview
- Recent messages feed

### 📖 Quest Journal
- **Native System:** Create, track, and complete quests with difficulty ratings
- **Integration:** Automatically syncs with **Forien's Quest Log** if installed
- **Mission Report:** Tracks completed and failed quests in player profiles

### 🏛️ Factions
- **Reputation System:** Dynamic slider (-100 to +100) with tiers (Nemesis to Devoted)
- **Ranks & XP:** Define custom ranks with XP requirements and reputation modifiers
- **Progression:** Award XP to faction members; auto-promotions based on XP
- **Enlistment:** Players can enlist in factions (if allowed)
- **Auto-Calculation:** Option to calculate faction standing based on member ranks
- **Visuals:** Dynamic icons and reputation faces

### 🏆 Achievements (Merit Badges)
- Create custom badges with images and descriptions
- Grant/Revoke functionality for GMs
- Chat notifications when badges are awarded

### 📧 Inbox (Comms)
- **Threaded Messaging:** Email-style conversation threads
- **Address Book:** Select recipients (Players and Known NPCs)
- **Known NPCs:** GM-managed list of NPCs players can contact
- **Unknown Senders:** Messages from unknown NPCs are masked
- **Offline Delivery:** Players can send messages even if the GM is offline (queued for next GM login)
- **Chat Integration:** "Access Inbox" buttons in chat notifications

## Permissions

**Game Masters:**
- Full control over all data
- Manage Factions, Quests, Badges, and NPCs
- Moderate communications (delete threads/messages)

**Players:**
- View Dashboard and Profiles
- Read and Reply to Messages
- Enlist in Factions (where applicable)
- View Quest Log

## Installation

**Manifest URL:**
`https://github.com/Jitterbone/intoterica/releases/latest/download/module.json`

1. Copy the URL above.
2. In Foundry VTT (or The Forge), go to **Add-on Modules** -> **Install Module**.
3. Paste the URL into the **Manifest URL** field and click Install.

## Usage

**Opening the App:**
- Click the 📖 book icon in the Token Controls (left sidebar).
- Or use the macro: `new IntotericaApp().render(true);`

**Factions:**
- GMs can create factions in the Factions tab.
- Toggle "Auto-Calculate" to derive reputation from member standings.
- Use the "Award XP" button to distribute faction experience.

**Mail:**
- GMs can drag-and-drop Actors onto the "Known NPCs" tab to make them contactable by players.
- Players use the "Compose" button in the Inbox to send messages.

**Theming:**
- Toggle visual themes in Module Settings.
- Enable/Disable interface sounds.

## License

MIT License - Free to use and modify