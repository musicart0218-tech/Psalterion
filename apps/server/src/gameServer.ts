import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PlayerState, PlayerClass, Monster, ChatMessage, WorldEvent, ServerStats, MonsterType, VOID_MONARCH_BASE, getVoidMonarchStats, VoidMonarchState } from '@/packages/shared/src/index';

// Game Server State Managers
interface GameServerState {
  players: Record<string, PlayerState>;
  monsters: Record<string, Monster>;
  chatHistory: ChatMessage[];
  activeEvent: WorldEvent;
  gmBroadcastLog: string[];
}

const state: GameServerState = {
  players: {},
  monsters: {},
  chatHistory: [],
  activeEvent: 'NORMAL',
  gmBroadcastLog: []
};

// Initial spawn locations for standard mobs (wild wilderness beyond Psalter Village safe bounds)
const MONSTER_DEFS = [
  { type: 'slime' as const, name: 'Forest Slime', level: 1, maxHp: 30, attack: 3, num: 6, rx: [420, 850], ry: [200, 600] },
  { type: 'goblin' as const, name: 'Bandit Goblin', level: 3, maxHp: 50, attack: 6, num: 4, rx: [700, 1100], ry: [100, 500] },
  { type: 'orc' as const, name: 'Ironhorn Orc', level: 6, maxHp: 90, attack: 12, num: 3, rx: [420, 1000], ry: [550, 950] }
];

let socketIoInstance: SocketIOServer | null = null;
let gameLoopInterval: NodeJS.Timeout | null = null;
let monsterAIInterval: NodeJS.Timeout | null = null;

// Initialize monsters in world
function spawnDefaultMonsters() {
  state.monsters = {};
  let masterIdCounter = 1;

  MONSTER_DEFS.forEach(def => {
    for (let i = 0; i < def.num; i++) {
      const id = `mob_${masterIdCounter++}`;
      const rx = def.rx[0] + Math.random() * (def.rx[1] - def.rx[0]);
      const ry = def.ry[0] + Math.random() * (def.ry[1] - def.ry[0]);
      state.monsters[id] = {
        id,
        type: def.type,
        name: def.name,
        x: rx,
        y: ry,
        hp: def.maxHp,
        maxHp: def.maxHp,
        level: def.level,
        attack: def.attack
      };
    }
  });
}

// Global Event Multipliers
const getXpMultiplier = () => (state.activeEvent === 'DOUBLE_XP' ? 2 : 1);
const getGoldMultiplier = () => (state.activeEvent === 'GOLD_RUSH' ? 2 : 1);

export function initializeGameServer(httpServer: HTTPServer) {
  // Spawn initial mobs
  spawnDefaultMonsters();

  // Initialize Socket.IO with broad origins for sandbox iframe rendering
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  socketIoInstance = io;

  io.on('connection', (socket) => {
    console.log(`🎮 Player joined: ${socket.id}`);

    // Receive request for a full data sync (useful when scene is loaded/ready)
    socket.on('requestFullSync', () => {
      socket.emit('initData', {
        selfId: socket.id,
        players: state.players,
        monsters: state.monsters,
        chatHistory: state.chatHistory,
        activeEvent: state.activeEvent
      });
    });

    // Receive login details
    socket.on('joinGame', (data: { name: string; class: PlayerClass; gender?: 'M' | 'F' }) => {
      const name = data.name.trim() || `Adventurer_${Math.floor(100+Math.random()*900)}`;
      const selectedClass = data.class || 'WARRIOR';
      const gender = data.gender === 'F' ? 'F' : 'M';

      // Default stats based on class choice
      let maxHp = 100;
      let maxMp = 50;
      let speed = 150;

      if (selectedClass === 'WARRIOR') {
        maxHp = 140;
        maxMp = 30;
        speed = 130;
      } else if (selectedClass === 'MAGE') {
        maxHp = 80;
        maxMp = 100;
        speed = 140;
      } else if (selectedClass === 'ARCHER') {
        maxHp = 95;
        maxMp = 45;
        speed = 170;
      } else if (selectedClass === 'VOID_MONARCH') {
        const scaled = getVoidMonarchStats(VOID_MONARCH_BASE, 'CORE');
        maxHp = scaled.vitality * 10; // 10000 HP
        maxMp = scaled.intellect * 10; // 4000 MP
        speed = 220; // Celestial god speed
      }

      const newPlayer: PlayerState = {
        id: socket.id,
        name,
        class: selectedClass,
        gender,
        pos: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
        hp: maxHp,
        maxHp,
        mp: maxMp,
        maxMp,
        level: 1,
        xp: 0,
        gold: 10 * getGoldMultiplier(),
        speed,
        status: 'ONLINE',
        lastSeen: Date.now(),
        ...(selectedClass === 'VOID_MONARCH' ? {
          voidState: 'CORE' as const,
          strength: VOID_MONARCH_BASE.strength * 10,
          intellect: VOID_MONARCH_BASE.intellect * 10,
          agility: VOID_MONARCH_BASE.agility * 10,
          vitality: VOID_MONARCH_BASE.vitality * 10
        } : {})
      };

      state.players[socket.id] = newPlayer;

      // Broadcast new player log
      const systemMessage: ChatMessage = {
        id: `sys_${Date.now()}`,
        sender: '🍁 System',
        text: `Player ${name} (${selectedClass}) has stepped into Psalter!`,
        timestamp: Date.now(),
        type: 'system'
      };
      state.chatHistory.push(systemMessage);
      if (state.chatHistory.length > 50) state.chatHistory.shift();

      // Welcome player and sync state
      socket.emit('initData', {
        selfId: socket.id,
        players: state.players,
        monsters: state.monsters,
        chatHistory: state.chatHistory,
        activeEvent: state.activeEvent
      });

      // Notify others
      socket.broadcast.emit('newPlayer', newPlayer);
      io.emit('chatMessage', systemMessage);
      broadcastServerStats();
    });

    // Handle player coordination packet
    socket.on('playerMove', (data: { x: number; y: number }) => {
      const player = state.players[socket.id];
      if (player && player.hp > 0) {
        player.pos.x = data.x;
        player.pos.y = data.y;
        player.lastSeen = Date.now();

        // Broadcast coordinates to all peers
        socket.broadcast.emit('playerMoved', {
          id: socket.id,
          x: player.pos.x,
          y: player.pos.y
        });
      }
    });

    // Handle user skill/combat activation triggers
    socket.on('playerAttack', (data: { targetMobId?: string; skillType?: string }) => {
      const player = state.players[socket.id];
      if (!player || player.hp <= 0) return;

      // Visual attack pulse to peer clients
      io.emit('playerEffect', {
        playerId: socket.id,
        action: 'attack',
        class: player.class,
        x: player.pos.x,
        y: player.pos.y
      });

      // Resolve targets on sever side
      if (data.targetMobId) {
        const mob = state.monsters[data.targetMobId];
        if (mob && mob.hp > 0) {
          // Calculate attack damage based on player stats
          let damage = 5 + Math.floor(Math.random() * 8); // base level dmg
          if (player.class === 'WARRIOR') damage += 8;
          if (player.class === 'MAGE') damage += 11;
          if (player.class === 'ARCHER') damage += 7;
          if (player.class === 'VOID_MONARCH') {
            const scaled = getVoidMonarchStats(VOID_MONARCH_BASE, player.voidState || 'CORE');
            damage += Math.floor(scaled.strength * 0.5 + scaled.intellect * 0.5); // absolutely insane end-game god mode damage
          }

          // Event bonus damage or critical
          if (Math.random() > 0.8) {
            damage = Math.floor(damage * 1.5);
          }

          mob.hp -= damage;
          
          // Notify peer damage pops
          io.emit('combatFeedback', {
            targetType: 'mob',
            targetId: mob.id,
            damage,
            hp: mob.hp,
            maxHp: mob.maxHp,
            attackerId: player.id
          });

          // Check if mob has fallen
          if (mob.hp <= 0) {
            // Reward Calculations
            const xpGain = (mob.level * 10) * getXpMultiplier();
            const goldGain = (mob.level * 4 + Math.floor(Math.random() * 5)) * getGoldMultiplier();

            player.xp += xpGain;
            player.gold += goldGain;

            // Log mob kill
            const combatAlert: ChatMessage = {
              id: `combat_${Date.now()}`,
              sender: '⚔️ Battle',
              text: `${player.name} defeated ${mob.name}! (+${xpGain} XP, +${goldGain} Gold)`,
              timestamp: Date.now(),
              type: 'system'
            };
            state.chatHistory.push(combatAlert);
            io.emit('chatMessage', combatAlert);

            // Handle level progression
            const reqXp = player.level * 100;
            if (player.xp >= reqXp) {
              player.level += 1;
              player.xp -= reqXp;
              player.maxHp = Math.floor(player.maxHp * 1.15);
              player.maxMp = Math.floor(player.maxMp * 1.15);
              player.hp = player.maxHp;
              player.mp = player.maxMp;

              // Level up effect
              io.emit('playerEffect', {
                playerId: player.id,
                action: 'levelup',
                level: player.level,
                hp: player.hp,
                maxHp: player.maxHp
              });

              io.emit('chatMessage', {
                id: `lvl_${Date.now()}`,
                sender: '🎉 Success',
                text: `🌟 ${player.name} leveled up to Level ${player.level}! 🌟`,
                timestamp: Date.now(),
                type: 'world'
              });
            }

            // Sync updated player stats
            io.emit('playerStatsUpdated', player);

            // Trigger respawn mechanism for that mob
            const type = mob.type;
            const name = mob.name;
            const maxHp = mob.maxHp;
            const level = mob.level;
            const attack = mob.attack;
            const id = mob.id;

            delete state.monsters[id];
            io.emit('monsterDefeated', id);

            setTimeout(() => {
              // Find def
              const def = MONSTER_DEFS.find(d => d.type === type) || { rx: [100, 500], ry: [100, 500] };
              const spawnX = def.rx[0] + Math.random() * (def.rx[1] - def.rx[0]);
              const spawnY = def.ry[0] + Math.random() * (def.ry[1] - def.ry[0]);

              const newMob: Monster = {
                id,
                type,
                name,
                x: spawnX,
                y: spawnY,
                hp: maxHp,
                maxHp,
                level,
                attack
              };
              state.monsters[id] = newMob;
              io.emit('newMonster', newMob);
              broadcastServerStats();
            }, 6000); // 6 seconds respawn interval

            broadcastServerStats();
          }
        }
      }
    });

    // Receive message
    socket.on('sendMessage', (text: string) => {
      const player = state.players[socket.id];
      if (!player) return;

      const chatMsg: ChatMessage = {
        id: `chat_${Date.now()}`,
        sender: player.name,
        text,
        timestamp: Date.now(),
        type: 'world'
      };

      state.chatHistory.push(chatMsg);
      if (state.chatHistory.length > 50) state.chatHistory.shift();

      io.emit('chatMessage', chatMsg);
    });

    // Player requests item purchase (healing potion)
    socket.on('buyItem', (data: { itemName: 'potion' | 'elixir' }) => {
      const player = state.players[socket.id];
      if (!player || player.hp <= 0) return;

      const COST = 15;
      if (player.gold >= COST) {
        player.gold -= COST;
        if (data.itemName === 'potion') {
          player.hp = Math.min(player.maxHp, player.hp + 40);
        } else {
          player.mp = Math.min(player.maxMp, player.mp + 25);
        }
        
        io.emit('playerStatsUpdated', player);
        socket.emit('chatMessage', {
          id: `item_${Date.now()}`,
          sender: '🛒 Merchant',
          text: `Purchased potion for ${COST} Gold. Current HP restored.`,
          timestamp: Date.now(),
          type: 'system'
        });
      } else {
        socket.emit('chatMessage', {
          id: `item_err_${Date.now()}`,
          sender: '🛒 Merchant',
          text: `Not enough Gold! Potion costs ${COST} Gold.`,
          timestamp: Date.now(),
          type: 'system'
        });
      }
    });

    // Void Monarch Ascension transition triggers
    socket.on('changeVoidState', (data: { state: VoidMonarchState }) => {
      const player = state.players[socket.id];
      if (player && player.class === 'VOID_MONARCH' && data.state) {
        player.voidState = data.state;
        const scaled = getVoidMonarchStats(VOID_MONARCH_BASE, data.state);
        player.strength = scaled.strength;
        player.intellect = scaled.intellect;
        player.agility = scaled.agility;
        player.vitality = scaled.vitality;

        // Scale player's hp based on vitality scale
        const newMaxHp = scaled.vitality * 10;
        player.maxHp = newMaxHp;
        // Keep HP visual proportion similar on transition
        player.hp = Math.min(player.hp, newMaxHp);
        if (player.hp < Math.floor(newMaxHp * 0.2)) {
          player.hp = Math.floor(newMaxHp * 0.5); // restore some HP if too low on ascension
        }

        // Notify client world synchronization
        io.emit('playerStatsUpdated', player);
        io.emit('playerEffect', {
          playerId: player.id,
          action: 'levelup', // trigger glowing level flash
        });

        // Push global system announcement
        const upgradeMsg: ChatMessage = {
          id: `void_${Date.now()}`,
          sender: '🌌 Void Core',
          text: `⚡ ${player.name} ASCENDED into VOID MONARCH [${data.state}] state! ⚡`,
          timestamp: Date.now(),
          type: 'system' as const
        };
        state.chatHistory.push(upgradeMsg);
        io.emit('chatMessage', upgradeMsg);
      }
    });

    // Connection termination
    socket.on('disconnect', () => {
      const player = state.players[socket.id];
      if (player) {
         io.emit('chatMessage', {
           id: `dc_${Date.now()}`,
           sender: '🍁 System',
           text: `${player.name} disconnected.`,
           timestamp: Date.now(),
           type: 'system'
         });
         delete state.players[socket.id];
         io.emit('playerDisconnected', socket.id);
         broadcastServerStats();
      }
    });

    // --- GM Panel Event Channels ---
    socket.on('gmToggleEvent', (event: WorldEvent) => {
      state.activeEvent = event;
      io.emit('eventChanged', event);

      let text = 'The skies cleared and the world returned to NORMAL.';
      if (event === 'DOUBLE_XP') text = '🔥 DOUBLE EXPERIENCE multiplier activated globally!';
      if (event === 'GOLD_RUSH') text = '💰 GOLD RUSH activated! Enemies yield 2x normal values!';
      if (event === 'MAINTENANCE_WARN') text = '⚠️ SERVER WARNING: Maintenance incoming... Save inventories!';

      const broadcastMsg: ChatMessage = {
        id: `gm_event_${Date.now()}`,
        sender: '👑 GM Announcement',
        text,
        timestamp: Date.now(),
        type: 'admin'
      };
      state.chatHistory.push(broadcastMsg);
      io.emit('chatMessage', broadcastMsg);
      broadcastServerStats();
    });

    socket.on('gmBroadcastMessage', (text: string) => {
      const bMsg: ChatMessage = {
        id: `gmb_${Date.now()}`,
        sender: '👑 GM Broadcaster',
        text: `🔈 [BROADCAST]: ${text}`,
        timestamp: Date.now(),
        type: 'admin'
      };
      state.chatHistory.push(bMsg);
      io.emit('chatMessage', bMsg);
    });

    socket.on('gmModifyPlayer', (data: { playerId: string; level?: number; gold?: number; hp?: number; className?: PlayerClass }) => {
      const target = state.players[data.playerId];
      if (target) {
        if (data.level !== undefined) target.level = data.level;
        if (data.gold !== undefined) target.gold = data.gold;

        if (data.className !== undefined) {
          target.class = data.className;
          if (data.className === 'VOID_MONARCH') {
            target.voidState = 'CORE';
            const scaled = getVoidMonarchStats(VOID_MONARCH_BASE, 'CORE');
            target.strength = scaled.strength;
            target.intellect = scaled.intellect;
            target.agility = scaled.agility;
            target.vitality = scaled.vitality;
            target.maxHp = scaled.vitality * 10;
            target.maxMp = scaled.intellect * 10;
            target.hp = target.maxHp;
            target.mp = target.maxMp;
            target.speed = 220;

            const upgradeMsg: ChatMessage = {
              id: `void_bestowed_${Date.now()}`,
              sender: '🌌 Void Core',
              text: `⚡ ${target.name} WAS BESTOWED CELESTIAL VOID MONARCH STATUS BY DECREE OF CODES! ⚡`,
              timestamp: Date.now(),
              type: 'system' as const
            };
            state.chatHistory.push(upgradeMsg);
            io.emit('chatMessage', upgradeMsg);
          } else {
            // Restore normal stats for standard classes
            if (data.className === 'WARRIOR') {
              target.maxHp = 140;
              target.maxMp = 30;
              target.speed = 130;
            } else if (data.className === 'MAGE') {
              target.maxHp = 80;
              target.maxMp = 100;
              target.speed = 140;
            } else if (data.className === 'ARCHER') {
              target.maxHp = 95;
              target.maxMp = 45;
              target.speed = 170;
            }
            target.hp = target.maxHp;
            target.mp = target.maxMp;
            delete target.voidState;
            delete target.strength;
            delete target.intellect;
            delete target.agility;
            delete target.vitality;
          }
        }

        if (data.hp !== undefined) target.hp = Math.min(target.maxHp, data.hp);

        io.emit('playerStatsUpdated', target);
        io.emit('chatMessage', {
          id: `gm_mod_${Date.now()}`,
          sender: '🛡️ Server Logs',
          text: `Player ${target.name} altered by GM actions.`,
          timestamp: Date.now(),
          type: 'system'
        });
      }
    });

    socket.on('gmSpawnBoss', () => {
      const id = `boss_${Date.now()}`;
      const newBoss: Monster = {
        id,
        type: 'dragon',
        name: '🔥 Cinderfang the Flame dragon [RAID BOSS]',
        x: 400 + Math.random() * 100,
        y: 350 + Math.random() * 100,
        hp: 500,
        maxHp: 500,
        level: 15,
        attack: 25
      };

      state.monsters[id] = newBoss;
      io.emit('newMonster', newBoss);

      const alertMsg: ChatMessage = {
        id: `boss_spawn_${Date.now()}`,
        sender: '🚨 World Portal',
        text: `⚡ BEWARE! 🔥 CINDERFANG THE FLAME DRAGON level 15 has awakened in the center of Psalter! ⚡`,
        timestamp: Date.now(),
        type: 'admin'
      };
      state.chatHistory.push(alertMsg);
      io.emit('chatMessage', alertMsg);
      broadcastServerStats();
    });

    socket.on('gmKillAllMonsters', () => {
      // Clear monsters (respawning will launch standard mobs, but wipes anything instantly)
      state.monsters = {};
      io.emit('killAllMonstersFeedback');
      io.emit('chatMessage', {
        id: `gm_wipe_${Date.now()}`,
        sender: '🛡️ Server Logs',
        text: 'GM has cleansed the realm of all wild beasts!',
        timestamp: Date.now(),
        type: 'system'
      });
      
      // Spawn standard back in 3 seconds
      setTimeout(() => {
        spawnDefaultMonsters();
        Object.values(state.monsters).forEach(mob => {
          io.emit('newMonster', mob);
        });
        broadcastServerStats();
      }, 3000);
    });

    // Provide immediate telemetry of servers for active GMs
    socket.on('requestServerStats', () => {
      broadcastServerStats(socket.id);
    });
  });

  // Safe zone bounds detection helper (Psalter Village is protected)
  const isInSafeZone = (x: number, y: number) => x < 390 && y < 390;

  // Cycle monster path wandering and aggressive tracking
  monsterAIInterval = setInterval(() => {
    Object.values(state.monsters).forEach(mob => {
      // Check if aggressive proximity targets exist
      let chasedPlayer: PlayerState | null = null;
      let minDist = 180; // detection zone radius

      Object.values(state.players).forEach(p => {
        // Monsters will strictly ignore players currently resting inside the Psalter Village Safe Zone
        if (p.hp > 0 && !isInSafeZone(p.pos.x, p.pos.y)) {
          const dx = p.pos.x - mob.x;
          const dy = p.pos.y - mob.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            chasedPlayer = p;
          }
        }
      });

      if (chasedPlayer) {
        const player = chasedPlayer as PlayerState;
        // Move towards player
        const dx = player.pos.x - mob.x;
        const dy = player.pos.y - mob.y;
        const angle = Math.atan2(dy, dx);
        
        // standard mob speed is slow
        const chaseSpeed = mob.type === 'dragon' ? 2.5 : 1.5;
        mob.x += Math.cos(angle) * chaseSpeed;
        mob.y += Math.sin(angle) * chaseSpeed;

        // If very close, damage-dealing attack loops (rate limit attack frequency via random chance/tickers)
        if (minDist < 40 && Math.random() > 0.85) {
          player.hp = Math.max(0, player.hp - mob.attack);
          io.emit('combatFeedback', {
            targetType: 'player',
            targetId: player.id,
            damage: mob.attack,
            hp: player.hp,
            maxHp: player.maxHp,
            attackerId: mob.id
          });

          io.emit('playerStatsUpdated', player);

          if (player.hp <= 0) {
            io.emit('chatMessage', {
              id: `dead_${Date.now()}`,
              sender: '💀 Defeat',
              text: `${player.name} was slain by ${mob.name}!`,
              timestamp: Date.now(),
              type: 'system'
            });

            // Auto respawn player to starting coordinates
            setTimeout(() => {
              const respPlayer = state.players[player.id];
              if (respPlayer) {
                respPlayer.hp = Math.floor(respPlayer.maxHp * 0.5); // respawn with 50% HP
                respPlayer.pos.x = 220;
                respPlayer.pos.y = 220;
                io.emit('playerStatsUpdated', respPlayer);
                io.emit('playerEffect', {
                  playerId: respPlayer.id,
                  action: 'levelup', // reuse animations for flash spawning
                  level: respPlayer.level,
                  hp: respPlayer.hp,
                  maxHp: respPlayer.maxHp
                });
              }
            }, 5000);
          }
        }
      } else {
        // IDLE wander randomly
        if (Math.random() > 0.95) {
          const wanderDistance = 30;
          mob.x += (Math.random() - 0.5) * wanderDistance;
          mob.y += (Math.random() - 0.5) * wanderDistance;
        }
      }

      // Sync position to client systems
      io.emit('monsterMoved', {
        id: mob.id,
        x: mob.x,
        y: mob.y
      });
    });
  }, 100); // 10Hz AI ticking

  // Clean-up loop to check idle player timestamps (prevents stale ghosts)
  gameLoopInterval = setInterval(() => {
    const idleTimeout = 40000; // 40 seconds absence
    const now = Date.now();
    Object.keys(state.players).forEach(id => {
      if (now - state.players[id].lastSeen > idleTimeout) {
        console.log(`Ghost cleaner kicking idle client: ${id}`);
        delete state.players[id];
        io.emit('playerDisconnected', id);
        broadcastServerStats();
      }
    });
  }, 10000);
}

// Broadcast system performance stats
function broadcastServerStats(targetSocketId?: string) {
  if (!socketIoInstance) return;

  const onlineCount = Object.keys(state.players).length;
  const monstersCount = Object.keys(state.monsters).length;

  const mem = process.memoryUsage();
  const memoryPercent = Math.min(95, Math.floor((mem.heapUsed / mem.heapTotal) * 100));

  const stats: ServerStats = {
    playersOnline: onlineCount,
    monstersAlive: monstersCount,
    cpuUsage: Math.floor(5 + Math.random() * 15), // Mock cpu load
    memoryUsage: memoryPercent,
    uptime: Math.floor(process.uptime()),
    activeEvent: state.activeEvent
  };

  if (targetSocketId) {
    socketIoInstance.to(targetSocketId).emit('serverStats', stats);
  } else {
    socketIoInstance.emit('serverStats', stats);
  }
}
