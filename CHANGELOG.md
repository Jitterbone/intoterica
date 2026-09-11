# Changelog

All notable changes to **Intoterica** will be documented in this file.

---

## [1.5.1] - 2026-09-10

### 🏗️ Architecture & Performance
- **Modular Domain Architecture**: Refactored monolithic codebase into maintainable, modular domain components under `scripts/core/` and `scripts/features/` with prototype mixin composition and zero breaking API changes.

### 🐛 Bug Fixes & UI Improvements
- **Mail Chat Notifications**: Restored whispered "You've got mail!" chat cards with the interactive "Access Inbox" button for recipients, as well as GM alerts for player messages.
- **Header Clock & Date Display**: Restored the in-game date / world clock display in the application header with click-to-edit integration.
- **Character Profile Messages**: Profile messages now strictly show unread messages, and clicking a message opens the conversation thread directly and marks it as read.
- **Quest Journal Tabs & Controls**: Fixed event listener binding for Quest Journal filter tabs (Active, Available, Completed, Failed), search, and toolbar controls.
- **Player Quest Visibility**: Improved player assignment and whole-party matching so active and party quests are consistently visible to players in both the Quest Journal and Character Profiles.
- **Profile Layout Clean-up**: Eliminated duplicate completed quest cards from character profiles while maintaining full Mission Report logs.

---

## [1.5.0] - 2026-09-10

### 🚀 New Features & Enhancements

#### 📖 Substories & Quest Objective Hierarchy
- **Substories Conversion**: Convert quest objectives directly into nested Substories within the Quest Editor.
- **Hierarchical Objectives**: Add, manage, toggle, and delete nested sub-tasks beneath substories.
- **Drag-and-Drop Organization**: Reorder objectives and substories with intuitive handle-based drag-and-drop.
- **Access Point & Dark Theme Visuals**: Improved contrast and styling for substory cards and folders across all themes.

#### 🎁 Automated Quest Reward Distribution
- **Currencies Distribution**: Split currencies evenly across recipients or grant the full amount to each recipient.
- **Item Documents Creation**: Automatically grant and instantiate item documents onto recipient actor sheets upon quest completion.
- **Faction XP & Standing Integration**: Automatically calculate and apply faction standing and XP upon quest completion with proration support.
- **Strict Faction Membership for XP**: Faction XP is strictly awarded only to enrolled members of that faction (action.members), while Reputation is granted to all target players/party standing.

#### 🏛️ Factions & Reputation Enhancements
- **Dynamic Faction XP Dialog**: The "Award XP" modal now validates enrolled members in real time, displays member ranks/XP, and disables non-members to prevent accidental awards.
- **Known Factions Display**: Fixed-size icon containers (object-fit: contain) for crisp faction emblems, themed scrollbars, and improved bottom spacing.
- **Theme-Matched Window Headers**: Window title bars now dynamically adapt to match each interface theme (Foundry/Default, Access Point, Soviet Retro, Dark Fantasy 80s, Vaporwave, and Custom).

#### 👥 Actor & NPC Directory Integration
- **Folder-Structured Dropdowns**: Quest Giver and Mail From: selection now mirror the Foundry Actor directory's folder hierarchy.
- **Auto-Assign Quest Givers**: Quest Givers assigned from the Actor directory are automatically registered into the Known NPCs directory.

#### 💾 Data Manager & Character Migration
- **Progress Migration Utility**: Easily migrate quests, faction standings/XP, merit badges, mail messages, and profile history between character actors.
- **Raw JSON Backup & Tools**: Built-in JSON formatting, syntax validation, file export, and file import for complete database management.

#### 👤 Player Profiles & History Retention
- **Completed Quest Retention**: Retain assigned player history and completed quest records in character profiles even after completion.
- **Inline Rich Text / Description Toggles**: Card and modal descriptions now default to a clean view mode with a one-click edit toggle.

### 🐛 Bug Fixes
- Fixed canEditQuests is not defined reference error when expanding/editing quests.
- Fixed faction XP rows running off-page in the Faction configuration menu.
- Fixed dynamic version number display in application header.
- Fixed objective card spacing and layout in quest details.

---

## [1.1.0] - 2026-09-10

### 🚀 Added
- Configurable quest difficulty scales (Standard RPG & Metal rankings).
- Quest filter and sorting toolbar with instant search.
- Commissioned By section with Actor directory integration.
- Custom volume controls and sound file pickers for Custom Configuration theme.

---

## [1.0.0] - Initial Release
- Core campaign management dashboard.
- Quest journal with checklists and difficulty tiers.
- Factions system with reputation sliders and customizable ranks.
- Merit badges and achievement tracking.
- Threaded in-game inbox communication system with Known NPCs.
- Multi-theme visual interface support.
