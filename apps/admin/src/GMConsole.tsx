import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ServerStats, PlayerState, WorldEvent } from '@/packages/shared/src/index';
import { Shield, Sparkles, AlertTriangle, Users, Heart, Coins, Award, Send, Skull } from 'lucide-react';

interface GMConsoleProps {
  socket: Socket | null;
  serverStats: ServerStats | null;
  activePlayersList: PlayerState[];
}

interface ChartDataPoint {
  time: string;
  players: number;
  memory: number;
}

export const GMConsole: React.FC<GMConsoleProps> = ({
  socket,
  serverStats,
  activePlayersList,
}) => {
  const [broadcastText, setBroadcastText] = useState('');
  const [telemetryHistory, setTelemetryHistory] = useState<ChartDataPoint[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  // Custom editing params for designated characters
  const [editLevel, setEditLevel] = useState<number>(1);
  const [editGold, setEditGold] = useState<number>(100);
  const [editHp, setEditHp] = useState<number>(100);

  // Sync state to form if selected player changes
  useEffect(() => {
    if (selectedPlayerId) {
      const p = activePlayersList.find(player => player.id === selectedPlayerId);
      if (p) {
        setEditLevel(p.level);
        setEditGold(p.gold);
        setEditHp(p.hp);
      }
    }
  }, [selectedPlayerId, activePlayersList]);

  // Aggregate telemetry timestamps
  useEffect(() => {
    if (serverStats) {
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetryHistory(prev => {
        const next = [...prev, {
          time: stamp,
          players: serverStats.playersOnline,
          memory: serverStats.memoryUsage,
        }];
        // Cap at latest 10 markers
        return next.slice(-10);
      });
    }
  }, [serverStats]);

  const dispatchBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !broadcastText.trim()) return;
    socket.emit('gmBroadcastMessage', broadcastText.trim());
    setBroadcastText('');
  };

  const setServerWorldEvent = (event: WorldEvent) => {
    if (!socket) return;
    socket.emit('gmToggleEvent', event);
  };

  const spawnRaidBoss = () => {
    if (!socket) return;
    socket.emit('gmSpawnBoss');
  };

  const wipeAllBeasts = () => {
    if (!socket) return;
    socket.emit('gmKillAllMonsters');
  };

  const applyPlayerAlterations = () => {
    if (!socket || !selectedPlayerId) return;
    socket.emit('gmModifyPlayer', {
      playerId: selectedPlayerId,
      level: Number(editLevel),
      gold: Number(editGold),
      hp: Number(editHp)
    });
  };

  const instantMaxOutPlayer = (playerId: string) => {
    if (!socket) return;
    socket.emit('gmModifyPlayer', {
      playerId,
      level: 10,
      gold: 5000,
      hp: 500
    });
  };

  const instatSlayPlayer = (playerId: string) => {
    if (!socket) return;
    socket.emit('gmModifyPlayer', {
      playerId,
      hp: 0
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-100">
      
      {/* COLUMN 1: Live Server Monitoring & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-lg">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">Server Monitor</h3>
            <p className="text-xs text-slate-400">Real-time GM Telemetry stats</p>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Uptime</div>
            <div className="text-lg font-mono font-semibold text-teal-400">
              {serverStats ? `${serverStats.uptime}s` : 'offline'}
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Active Event</div>
            <div className="text-base font-semibold font-mono text-purple-400">
              {serverStats ? serverStats.activeEvent : 'NORMAL'}
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Memory Load</div>
            <div className="text-lg font-mono font-semibold text-amber-400">
              {serverStats ? `${serverStats.memoryUsage}%` : '0%'}
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400">CPU Usage</div>
            <div className="text-lg font-mono font-semibold text-sky-400">
              {serverStats ? `${serverStats.cpuUsage}%` : '0%'}
            </div>
          </div>
        </div>

        {/* Telemetry Chart */}
        <div className="h-44 w-full bg-slate-950/60 rounded-lg p-2 border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4338ca" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: 9 }} />
              <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: 10 }} />
              <Area type="monotone" dataKey="players" name="Players Connected" stroke="#818cf8" fillOpacity={1} fill="url(#colorPlayers)" />
              <Area type="monotone" dataKey="memory" name="Heap Use (%)" stroke="#fbbf24" fillOpacity={1} fill="url(#colorMem)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* World Events Console */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-400">Trigger Room Events</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setServerWorldEvent('NORMAL')}
              className="bg-slate-800 hover:bg-slate-700 font-medium text-xs py-2 rounded-lg transition"
            >
              ☀️ Clear Skies (Normal)
            </button>
            <button
              onClick={() => setServerWorldEvent('DOUBLE_XP')}
              className="bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/50 font-medium text-xs py-2 rounded-lg text-indigo-200 transition"
            >
              🔥 Double XP Global
            </button>
            <button
              onClick={() => setServerWorldEvent('GOLD_RUSH')}
              className="bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/50 font-medium text-xs py-2 rounded-lg text-amber-200 transition"
            >
              💰 Gold Rush Event
            </button>
            <button
              onClick={() => setServerWorldEvent('MAINTENANCE_WARN')}
              className="bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/50 font-medium text-xs py-2 rounded-lg text-rose-200 transition"
            >
              ⚠️ Warning Broadcast
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 2: Spawn Rooms & Server Broadcasters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-lg">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">GM Interventions</h3>
            <p className="text-xs text-slate-400">Spawn boss and system alerts</p>
          </div>
        </div>

        {/* Boss summoning chamber */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-slate-400">Entity Summoner</span>
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-lg flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-rose-400 font-mono">🌟 Summit Raid Boss</div>
              <p className="text-xs text-slate-400 pt-0.5">Summon Cinderfang the Crimson Dragon (Level 15, HP: 500) into the center of the world.</p>
            </div>
            
            <button
              onClick={spawnRaidBoss}
              className="w-full bg-rose-600 hover:bg-rose-500 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <Skull size={16} /> Summon Flame Dragon
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={wipeAllBeasts}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded-lg font-medium border border-slate-700 transition"
            >
              🧼 Cleanse Beasts
            </button>
          </div>
        </div>

        {/* Global Banner broadcaster */}
        <div className="flex flex-col gap-3 mt-auto">
          <span className="text-xs font-semibold text-slate-400">Global Admin Broadcaster</span>
          <form onSubmit={dispatchBroadcast} className="flex flex-col gap-2">
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="Enter server message to broadcast scrolling banner across all participant screens..."
              className="bg-slate-950 text-slate-200 border border-slate-800 p-3 rounded-lg text-xs font-mono h-20 resize-none focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <button
              type="submit"
              disabled={!broadcastText.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Send size={12} /> Broadcast Server Announcement
            </button>
          </form>
        </div>
      </div>

      {/* COLUMN 3: Active Player Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-lg">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">Player Controller</h3>
            <p className="text-xs text-slate-400">Inspect and coordinate player attributes</p>
          </div>
        </div>

        {/* Dropdown list selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400">Select Character</label>
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-600"
          >
            <option value="">-- Active Sockets -- ({activePlayersList.length} Connected)</option>
            {activePlayersList.map(p => (
              <option key={p.id} value={p.id}>
                Level {p.level} - {p.name} ({p.class})
              </option>
            ))}
          </select>
        </div>

        {selectedPlayerId ? (
          <div className="flex flex-col gap-4 bg-slate-950/40 p-3 border border-slate-850 rounded-lg">
            <div className="text-xs font-mono text-slate-400 flex justify-between">
              <span>Socket ID:</span>
              <span className="text-[10px] text-teal-400">{selectedPlayerId}</span>
            </div>

            {/* Direct Form editing input params */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Award size={10} /> Level
                </span>
                <input
                  type="number"
                  value={editLevel}
                  onChange={(e) => setEditLevel(Math.max(1, Number(e.target.value)))}
                  className="bg-slate-950 border border-slate-850 p-2 rounded text-xs font-mono text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Coins size={10} /> Gold
                </span>
                <input
                  type="number"
                  value={editGold}
                  onChange={(e) => setEditGold(Math.max(0, Number(e.target.value)))}
                  className="bg-slate-950 border border-slate-850 p-2 rounded text-xs font-mono text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Heart size={10} /> HP
                </span>
                <input
                  type="number"
                  value={editHp}
                  onChange={(e) => setEditHp(Math.max(0, Number(e.target.value)))}
                  className="bg-slate-950 border border-slate-850 p-2 rounded text-xs font-mono text-center"
                />
              </div>
            </div>

            <button
              onClick={applyPlayerAlterations}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              🛡️ Commit Overrise Alterations
            </button>

            {/* Presets fast triggers */}
            <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => instantMaxOutPlayer(selectedPlayerId)}
                  className="flex-1 bg-indigo-900/30 text-indigo-400 border border-indigo-905 hover:bg-indigo-900/50 py-1.5 rounded text-[10px] uppercase font-bold transition cursor-pointer"
                >
                  ⚡ Level 10 Demigod
                </button>
                <button
                  type="button"
                  onClick={() => instatSlayPlayer(selectedPlayerId)}
                  className="flex-1 bg-rose-950/30 text-rose-400 border border-rose-955 hover:bg-rose-950/50 py-1.5 rounded text-[10px] uppercase font-bold transition cursor-pointer"
                >
                  💀 Slay Instant
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (socket) {
                    socket.emit('gmModifyPlayer', {
                      playerId: selectedPlayerId,
                      className: 'VOID_MONARCH'
                    });
                  }
                }}
                className="w-full bg-purple-950/40 text-purple-300 border border-purple-800/40 hover:bg-purple-900/40 hover:text-white py-2 rounded text-[10.5px] uppercase font-extrabold tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                🌌 Bestow Void Monarch Class
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center p-6 border border-dashed border-slate-850 rounded-lg bg-slate-950/20">
            <p className="text-xs text-slate-500 font-sans">
              Select an active adventurer above to access server override mechanics.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
