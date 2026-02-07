# Intoterica - Installation Guide

## Quick Install

### Step 1: Locate Foundry Data Folder

Find your Foundry VTT data directory:

- **Windows**: `%localappdata%\FoundryVTT\Data`
- **macOS**: `~/Library/Application Support/FoundryVTT/Data`
- **Linux**: `~/.local/share/FoundryVTT/Data`

Or in Foundry: **Configuration** → **User Data Path**

### Step 2: Install Module

1. Navigate to `Data/modules/`
2. Create a folder named `intoterica`
3. Inside `intoterica`, create 4 subfolders:
   - `scripts`
   - `styles`
   - `templates`
   - `lang`
4. Move your files into the correct folders:
```
Data/modules/intoterica/
├── module.json
├── scripts/
│   └── intoterica.js
├── styles/
│   └── intoterica.css
├── templates/
│   └── intoterica.hbs
└── lang/
    └── en.json
```

### Step 3: Enable in Foundry

1. Launch Foundry VTT
2. Enter your world
3. Go to **Settings** → **Manage Modules**
4. Find "Intoterica"
5. Check the box to enable
6. Click "Save Module Settings"
7. **Refresh browser (F5)**

### Step 4: Open Intoterica

**For Everyone:**
- Click the book icon 📖 in the token controls (left sidebar)

**Alternative (Macro):**
```javascript
new IntotericaApp().render(true);
```

## Verification

Module is correctly installed if:
- ✅ "Intoterica" appears in Module Management
- ✅ Book icon appears in scene controls
- ✅ No errors in console (F12)
- ✅ Clicking icon opens the application

## Permissions

### Game Master (GM)
- Full access to create, edit, delete all content
- Manage factions, quests, achievements, messages
- Adjust reputation values
- Edit world clock

### Players
- **View only** - can see all content
- Cannot create or modify entries
- Cannot adjust values
- Can read messages (cannot mark as read)

## First Steps

### As GM:

1. **Open Intoterica** via the book icon
2. **Create your first faction:**
   - Go to "Factions" tab
   - Click "New Faction"
   - Fill in details
3. **Add a quest:**
   - Go to "Quest Journal"
   - Click "New Quest"
   - Set difficulty and description
4. **Post a message:**
   - Go to "Messages"
   - Click "New Message"
   - Create an in-character communication

### As Player:

1. **Open Intoterica** via the book icon or macro
2. **View Dashboard** for campaign overview
3. **Check Quests** to see active objectives
4. **View Factions** to see standings
5. **Read Messages** for campaign intel

## Troubleshooting

### Module Not Showing
**Problem**: Module doesn't appear in list

**Solutions:**
- Verify files are in `Data/modules/intoterica/`
- Check `module.json` exists in root folder
- Restart Foundry completely
- Check file permissions (must be readable)

### Icon Not Appearing
**Problem**: Book icon not in scene controls

**Solutions:**
- Refresh browser (F5 or Ctrl+F5)
- Verify module is enabled in Module Management
- Check console (F12) for JavaScript errors
- Try using the macro method instead

### Players Can Edit
**Problem**: Players have GM permissions

**Solutions:**
- This should never happen with correct install
- Verify Foundry user roles are set correctly
- Check console for errors
- Reinstall module fresh

### Data Not Syncing
**Problem**: Changes not appearing for other users

**Solutions:**
- Have all users refresh browser
- Verify all users have module enabled
- Check console for socket errors
- Try closing and reopening Intoterica

### Performance Issues
**Problem**: Application is slow

**Solutions:**
- Reduce number of entries (archive old content)
- Check for console errors
- Disable conflicting modules temporarily
- Clear browser cache

## Uninstallation

To remove Intoterica:

1. **Backup data first:**
   ```javascript
   // In console (F12)
   const data = game.settings.get('intoterica', 'data');
   console.log(JSON.stringify(data, null, 2));
   // Copy output to safe location
   ```

2. **Disable in Module Management**

3. **Delete folder:**
   - Remove `Data/modules/intoterica/` directory

4. **Refresh Foundry**

**Note:** Data is stored in world settings and will persist even after removing the module files. To completely remove data:

```javascript
await game.settings.set('intoterica', 'data', {
  meritBadges: [],
  quests: [],
  factions: [],
  inbox: [],
  worldClock: { era: 1, day: 1 }
});
```

## Updating

When a new version is released:

1. **Backup current data** (see above)
2. Delete old `intoterica` folder
3. Install new version
4. Enable in Module Management
5. Refresh browser
6. Verify data is intact

## Getting Help

1. **Check README.md** for detailed documentation
2. **Press F12** to open console and check for errors
3. **Foundry Discord**: Visit #modules-troubleshooting
4. **Foundry Reddit**: r/FoundryVTT

## Tips

- **Create a macro** for quick access
- **Backup regularly** using console export
- **Test with players** before big sessions
- **Use world clock** to track campaign time
- **Organize factions** with clear hierarchies

---

**Installation complete!** Open Intoterica and start managing your campaign! 🎲