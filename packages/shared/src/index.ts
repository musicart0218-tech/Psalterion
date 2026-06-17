// Existing Player and Game Types (Backward Compatibility)
export type PlayerClass = 'WARRIOR' | 'MAGE' | 'ARCHER' | 'VOID_MONARCH';

export interface Position {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  name: string;
  class: PlayerClass;
  pos: Position;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  gold: number;
  speed: number;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: number;
  gender?: 'M' | 'F';
  
  // Void Monarch properties
  voidState?: VoidMonarchState;
  strength?: number;
  intellect?: number;
  agility?: number;
  vitality?: number;
}

export type MonsterType = 'slime' | 'goblin' | 'orc' | 'dragon';

export interface Monster {
  id: string;
  type: MonsterType;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  attack: number;
}

export type MessageType = 'world' | 'local' | 'system' | 'admin';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  type: MessageType;
}

export type WorldEvent = 'NORMAL' | 'DOUBLE_XP' | 'GOLD_RUSH' | 'MAINTENANCE_WARN';

export interface ServerStats {
  playersOnline: number;
  monstersAlive: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number; // in seconds
  activeEvent: WorldEvent;
}

// ==========================================
// New Shared Game Constants & Protocol Types
// ==========================================

// Shared Game Map Configuration
export const MAP_CONFIG = {
  ASTERHAVEN: {
    id: "asterhaven",
    name: "Asterhaven Hub",
    spawnX: 400,
    spawnY: 300,
  },
  WHISPERWOOD: {
    id: "whisperwood",
    name: "Whisperwood Forest",
    spawnX: 100,
    spawnY: 450,
  }
};

// Player Character Enums & Interfaces
export type CharacterClass = 'GUARDIAN' | 'ARCANIST' | 'SHADOWBLADE' | 'RANGER' | 'SPIRITCALLER' | 'CHRONOMANCER' | 'VOID_MONARCH';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC' | 'PSALTERFORGED';

export interface Vector2D {
  x: number;
  y: number;
}

export interface PlayerNetworkState {
  id: string;
  username: string;
  characterName: string;
  className: CharacterClass;
  mapId: string;
  position: Vector2D;
  heading: 'left' | 'right';
  currentHp: number;
  maxHp: number;
}

// Socket.IO Protocol Network Action Network Identifiers
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTH_REQUEST: 'auth:request',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILURE: 'auth:failure',
  
  // World Synchronizers
  PLAYER_JOIN: 'world:player_join',
  PLAYER_LEAVE: 'world:player_leave',
  PLAYER_MOVE: 'world:player_move',
  
  // Communication
  CHAT_MESSAGE: 'chat:message',
  
  // GM Commands
  GM_COMMAND: 'gm:command',
  GM_ANNOUNCEMENT: 'gm:announcement'
};

export interface ChatMessagePayload {
  sender: string;
  text: string;
  channel: 'global' | 'local' | 'party' | 'system' | 'gm';
  timestamp: number;
}

// ==========================================
// Void Monarch End Game Class Multipliers
// ==========================================

export interface BaseAttributes {
  strength: number;
  intellect: number;
  agility: number;
  vitality: number;
}

export const VOID_MONARCH_BASE: BaseAttributes = {
  strength: 200,
  intellect: 400,
  agility: 700,
  vitality: 1000
};

export const TIER_MULTIPLIERS = {
  BASIC: 1,
  ELITE: 1.5,
  LEGENDARY: 2.5,
  MYTHIC: 3.5,
  VOID_MONARCH_CORE: 10,      // already absurd
  VOID_MONARCH_ASCENDED: 20,  // your “x20 state”
  VOID_MONARCH_APEX: 30,       // your “x30 state”
  VOID_MONARCH_OVERFLOW: 50    // final boss / sandbox god mode
};

export type VoidMonarchState = "CORE" | "ASCENDED" | "APEX" | "OVERFLOW";

export function getVoidMonarchStats(
  base: BaseAttributes,
  state: VoidMonarchState
): BaseAttributes {
  const multiplier =
    state === "CORE" ? 10 :
    state === "ASCENDED" ? 20 :
    state === "APEX" ? 30 :
    50;

  return {
    strength: Math.floor(base.strength * multiplier),
    intellect: Math.floor(base.intellect * multiplier),
    agility: Math.floor(base.agility * multiplier),
    vitality: Math.floor(base.vitality * multiplier)
  };
}
