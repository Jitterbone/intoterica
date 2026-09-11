export const DIFFICULTY_SCALES = {
  "standard": [
    { id: "Easy", label: "Easy", color: "#2b8a3e", tier: 1 },
    { id: "Medium", label: "Medium", color: "#f59f00", tier: 2 },
    { id: "Hard", label: "Hard", color: "#c92a2a", tier: 3 },
    { id: "Epic", label: "Epic", color: "#b026ff", tier: 4 },
    { id: "Legendary", label: "Legendary", color: "#e03131", tier: 5 }
  ],
  "metal": [
    { id: "Copper Tier", label: "Copper Tier", color: "#b87333", tier: 1 },
    { id: "Bronze Tier", label: "Bronze Tier", color: "#cd7f32", tier: 2 },
    { id: "Silver Tier", label: "Silver Tier", color: "#a0aab2", tier: 3 },
    { id: "Gold Tier", label: "Gold Tier", color: "#f59f00", tier: 4 },
    { id: "Platinum Tier", label: "Platinum Tier", color: "#00d2d3", tier: 5 }
  ],
  "rank": [
    { id: "E-Rank", label: "E-Rank", color: "#6c757d", tier: 1 },
    { id: "D-Rank", label: "D-Rank", color: "#2b8a3e", tier: 2 },
    { id: "C-Rank", label: "C-Rank", color: "#1c7ed6", tier: 3 },
    { id: "B-Rank", label: "B-Rank", color: "#f59f00", tier: 4 },
    { id: "A-Rank", label: "A-Rank", color: "#c92a2a", tier: 5 },
    { id: "S-Rank", label: "S-Rank", color: "#b026ff", tier: 6 }
  ],
  "stars": [
    { id: "1-Star", label: "1-Star", color: "#2b8a3e", tier: 1 },
    { id: "2-Star", label: "2-Star", color: "#1c7ed6", tier: 2 },
    { id: "3-Star", label: "3-Star", color: "#f59f00", tier: 3 },
    { id: "4-Star", label: "4-Star", color: "#c92a2a", tier: 4 },
    { id: "5-Star", label: "5-Star", color: "#b026ff", tier: 5 }
  ],
  "numeric": [
    { id: "Tier I", label: "Tier I", color: "#2b8a3e", tier: 1 },
    { id: "Tier II", label: "Tier II", color: "#1c7ed6", tier: 2 },
    { id: "Tier III", label: "Tier III", color: "#f59f00", tier: 3 },
    { id: "Tier IV", label: "Tier IV", color: "#c92a2a", tier: 4 },
    { id: "Tier V", label: "Tier V", color: "#b026ff", tier: 5 }
  ]
};

export const THEMES = {
  "default": {
    label: "Default",
    class: "theme-foundry",
    sounds: {
      idle: null,
      nav: null,
      mail: null
    }
  },
  "access-point": {
    label: "Access Point",
    class: "theme-access-point",
    sounds: {
      idle: "modules/intoterica/sounds/IntotericaIdle.ogg",
      nav: "modules/intoterica/sounds/NavSound.ogg",
      mail: "modules/intoterica/sounds/VeilMailSound.ogg"
    },
    volumeScale: 1.5
  },
  "soviet": {
    label: "Soviet Retro",
    class: "theme-soviet",
    sounds: {
      idle: "modules/intoterica/sounds/VintageRoyaltyFree.ogg",
      nav: "modules/intoterica/sounds/SovietNavSound.ogg",
      mail: "modules/intoterica/sounds/VeilMailSound.ogg"
    },
    volumeScale: 0.5
  },
  "dark-fantasy": {
    label: "Dark Fantasy 80s",
    class: "theme-dark-fantasy",
    sounds: {
      idle: "modules/intoterica/sounds/DarkFantasySynth.ogg",
      nav: "modules/intoterica/sounds/DarkFantasyNav.ogg",
      mail: "modules/intoterica/sounds/VeilMailSound.ogg"
    },
    volumeScale: 1.0
  },
  "vaporwave": {
    label: "Vaporwave",
    class: "theme-vaporwave",
    sounds: {
      idle: "modules/intoterica/sounds/Vaporwave.ogg",
      nav: "modules/intoterica/sounds/VaporwaveNav.ogg",
      mail: "modules/intoterica/sounds/VeilMailSound.ogg"
    },
    volumeScale: 0.5
  },
  "custom": {
    label: "Custom Configuration",
    class: "theme-custom",
    sounds: null // Indicates use settings
  }
};

