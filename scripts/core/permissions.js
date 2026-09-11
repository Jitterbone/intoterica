/**
 * Intoterica Permission System
 */

export const PERMISSIONS = {
  FACTIONS: 'permFactions',
  QUESTS: 'permQuests',
  BADGES: 'permBadges',
  MAIL: 'permMail',
  CLOCK: 'permClock',
  PROFILES: 'permProfiles'
};

/**
 * Checks if the current user has permission based on a module setting role threshold.
 * @param {string} settingKey - Setting key (e.g. 'permFactions')
 * @returns {boolean}
 */
export function hasPermission(settingKey) {
  const requiredRole = game.settings.get('intoterica', settingKey);
  return game.user.role >= requiredRole;
}
