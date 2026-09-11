import { THEMES } from './constants.js';

export function getSoundPath(type) {
  const themeKey = game.settings.get('intoterica', 'theme');
  const themeConfig = THEMES[themeKey] || THEMES['default'];
  
  if (themeConfig?.sounds) {
    return themeConfig.sounds[type];
  }
  
  // Fallback to settings for custom/undefined
  switch (type) {
    case 'idle': return game.settings.get('intoterica', 'soundIdle');
    case 'nav': return game.settings.get('intoterica', 'soundNav');
    case 'mail': return game.settings.get('intoterica', 'soundMail');
  }
  return null;
}

