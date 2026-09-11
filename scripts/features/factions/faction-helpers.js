/**
 * Intoterica Faction Helpers
 * Pure calculation and data preparation helpers for factions
 */

/**
 * Returns label, styling class, emoji, XP modifier, and color for a reputation value (-100 to 100).
 * @param {number} rep 
 * @returns {{label: string, class: string, face: string, xpMod: number, color: string}}
 */
export function getRepStatus(rep) {
  if (rep <= -80) return { label: "Nemesis", class: "rep-tier-nemesis", face: "👿", xpMod: 0.5, color: "#8b0000" };
  if (rep <= -50) return { label: "Hostile", class: "rep-tier-hostile", face: "😠", xpMod: 0.75, color: "#ff4500" };
  if (rep <= -30) return { label: "Unfriendly", class: "rep-tier-unfriendly", face: "😒", xpMod: 0.9, color: "#ffd700" };
  if (rep <= -10) return { label: "Wary", class: "rep-tier-wary", face: "😕", xpMod: 1.0, color: "#f5f5dc" };
  if (rep < 10) return { label: "Neutral", class: "rep-tier-neutral", face: "😐", xpMod: 1.0, color: "#ffffff" };
  if (rep < 30) return { label: "Friendly", class: "rep-tier-friendly", face: "🙂", xpMod: 1.1, color: "#98fb98" };
  if (rep < 50) return { label: "Allied", class: "rep-tier-allied", face: "😃", xpMod: 1.25, color: "#00ff00" };
  if (rep < 80) return { label: "Devoted", class: "rep-tier-devoted", face: "😇", xpMod: 1.5, color: "#00bfff" };
  return { label: "Devoted", class: "rep-tier-devoted", face: "🧞", xpMod: 1.5, color: "#00bfff" };
}

/**
 * Calculates weighted faction reputation based on members and party rep.
 * @param {Object} faction 
 * @returns {number}
 */
export function calculateFactionRep(faction) {
  let ranks = faction.ranks || [];
  // Normalize Ranks (Handle legacy string arrays vs new object arrays)
  if (ranks.length > 0 && typeof ranks[0] === 'string') {
    ranks = ranks.map(r => ({ name: r, xp: 0, modifier: 1.0 }));
  }

  let totalWeightedRep = 0;
  let totalWeights = 0;
  
  // 1. Weighted Members (Players Only)
  const playerMembers = (faction.members || []).filter(m => m.type === 'Player');
  
  playerMembers.forEach(m => {
    const rankData = ranks[m.rank] || { modifier: 1.0 };
    const rankMod = rankData.modifier !== undefined ? rankData.modifier : 1.0;
    const weight = 1.0 + rankMod;
    totalWeightedRep += (m.reputation || 0) * weight;
    totalWeights += weight;
  });
  
  // 2. Party Reputation
  let partyRep = faction.partyReputation;
  if (faction.autoCalc === false) {
      partyRep = faction.reputation;
  }
  if (partyRep === undefined) partyRep = 0;

  const totalPCs = game.users.filter(u => !u.isGM && u.character).length;
  const enlistedCount = playerMembers.length;
  let partyWeight = Math.max(0, totalPCs - enlistedCount);
  if (totalPCs === 0 && enlistedCount === 0) partyWeight = 1.0; // Fallback for setup

  if (partyWeight > 0) {
      totalWeightedRep += partyRep * partyWeight;
      totalWeights += partyWeight;
  }

  let currentRep = totalWeights > 0 ? Math.round(totalWeightedRep / totalWeights) : 0;
  return Math.max(-100, Math.min(100, currentRep));
}

/**
 * Prepares the factions list for rendering context.
 * @param {Object} settings - Module settings data object
 * @param {Object} appInstance - IntotericaApp instance
 * @param {boolean} canManageMail - Permission check result
 * @returns {Array<Object>} Processed factions
 */
export function prepareFactionsContext(settings, appInstance, canManageMail) {
  const userActorId = game.user.character?.id;

  const processedFactions = (settings.factions || []).map(f => {
    let ranks = f.ranks || [];
    // Normalize Ranks (Handle legacy string arrays vs new object arrays)
    if (ranks.length > 0 && typeof ranks[0] === 'string') {
      ranks = ranks.map(r => ({ name: r, xp: 0, modifier: 1.0 }));
    }

    // Auto-Calculate Reputation (Always Active)
    let partyRep = f.partyReputation;
    if (f.autoCalc === false) {
        partyRep = f.reputation;
    }
    if (partyRep === undefined) partyRep = 0;

    let totalWeightedRep = 0;
    let totalWeights = 0;
    
    // 1. Weighted Members (Players Only)
    const playerMembers = (f.members || []).filter(m => m.type === 'Player');
    const npcMembers = (f.members || []).filter(m => m.type !== 'Player');

    playerMembers.forEach(m => {
      const rankData = ranks[m.rank] || { modifier: 1.0 };
      const rankMod = rankData.modifier !== undefined ? rankData.modifier : 1.0;
      const weight = 1.0 + rankMod;
      totalWeightedRep += (m.reputation || 0) * weight;
      totalWeights += weight;
    });
    
    // 2. Party Reputation
    const totalPCs = game.users.filter(u => !u.isGM && u.character).length;
    const enlistedCount = playerMembers.length;
    let partyWeight = Math.max(0, totalPCs - enlistedCount);
    if (totalPCs === 0 && enlistedCount === 0) partyWeight = 1.0; // Fallback for setup

    if (partyWeight > 0) {
        totalWeightedRep += partyRep * partyWeight;
        totalWeights += partyWeight;
    }

    let currentRep = totalWeights > 0 ? Math.round(totalWeightedRep / totalWeights) : 0;
    currentRep = Math.max(-100, Math.min(100, currentRep));

    // Check enlistment eligibility
    const isMember = (f.members || []).some(m => m.id === userActorId);
    const canEnlist = !canManageMail && f.allowEnlistment && userActorId && !isMember;

    const status = getRepStatus(currentRep);
    const isImage = f.image && (f.image.includes('/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.image));
    
    return { 
        ...f, ranks, reputation: currentRep, 
        partyReputation: f.partyReputation || 0,
        statusLabel: status.label, statusClass: status.class, face: status.face, xpMod: status.xpMod, statusColor: status.color, 
        canEnlist, isImage, playerMembers, npcMembers 
    };
  });

  // Sync selected faction with latest data
  if (appInstance && appInstance.selectedFaction) {
    appInstance.selectedFaction = processedFactions.find(f => f.id === appInstance.selectedFaction.id) || null;
  }

  return processedFactions;
}

