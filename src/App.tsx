import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerState, PlayerClass, ChatMessage, ServerStats, WorldEvent } from '../packages/shared/src/index';
import { GameContainer } from '../apps/client/src/GameContainer';
import { GMConsole } from '../apps/admin/src/GMConsole';
import { 
  Shield, Users, MessageSquare, ShoppingCart, Sword, Heart, Sparkles, LogOut, Award, 
  RefreshCw, Send, Sparkle, Flame, Compass, Info, ArrowLeft, ArrowRight, CheckCircle2,
  Lock, Mail, User, ShieldAlert, LogIn, UserPlus
} from 'lucide-react';

export default function App() {
  // Socket and connections
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLogged, setIsLogged] = useState(false);

  // Account & Character Registration form states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCharName, setRegCharName] = useState('');
  const [regClass, setRegClass] = useState<'WARRIOR' | 'MAGE' | 'ARCHER'>('WARRIOR');
  const [regGender, setRegGender] = useState<'M' | 'F'>('M');

  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Character selection details
  const [charName, setCharName] = useState('');
  const [charClass, setCharClass] = useState<PlayerClass>('WARRIOR');
  const [charGender, setCharGender] = useState<'M' | 'F'>('M');

  // Guided Tour progress state (maps cleanly to immersive UI popups)
  const [tourStep, setTourStep] = useState<number | null>(0);

  // Multi-tab Layout states
  const [activeTab, setActiveTab] = useState<'play' | 'gm'>('play');

  // Syncing states from Phaser & Socket IO
  const [selfStats, setSelfStats] = useState<PlayerState | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [playersList, setPlayersList] = useState<PlayerState[]>([]);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [activeEvent, setActiveEvent] = useState<WorldEvent>('NORMAL');

  // Layout selection / Mobile triggers
  const [hudTab, setHudTab] = useState<'chat' | 'players' | 'shop'>('chat');
  
  // World messages inputs
  const [chatInputText, setChatInputText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Server event broadcast tickers
  const [latestBroadcast, setLatestBroadcast] = useState<string | null>(null);
  const [tickerActive, setTickerActive] = useState(false);

  // Initialize unified Socket.IO client instance pointing to same origin
  useEffect(() => {
    // Connect to Express + Socket server
    const socketInstance = io(window.location.origin, {
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      setSelfId(socketInstance.id || null);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      setIsLogged(false);
    });

    // Handle full world details sync
    socketInstance.on('initData', (data: {
      selfId: string;
      players: Record<string, PlayerState>;
      monsters: any;
      chatHistory: ChatMessage[];
      activeEvent: WorldEvent;
    }) => {
      setSelfId(data.selfId);
      setPlayersList(Object.values(data.players));
      setChatLog(data.chatHistory);
      setActiveEvent(data.activeEvent);

      const stats = data.players[data.selfId];
      if (stats) {
        setSelfStats(stats);
      }
    });

    socketInstance.on('newPlayer', (newP: PlayerState) => {
      setPlayersList(prev => {
        if (prev.find(p => p.id === newP.id)) return prev;
        return [...prev, newP];
      });
    });

    socketInstance.on('playerDisconnected', (id: string) => {
      setPlayersList(prev => prev.filter(p => p.id !== id));
      if (selectedTargetId === id) {
        setSelectedTargetId(null);
      }
    });

    socketInstance.on('playerStatsUpdated', (update: PlayerState) => {
      setPlayersList(prev => prev.map(p => p.id === update.id ? update : p));
      if (update.id === socketInstance.id) {
        setSelfStats(update);
      }
    });

    socketInstance.on('chatMessage', (msg: ChatMessage) => {
      setChatLog(prev => {
        const next = [...prev, msg];
        return next.slice(-50); // limit logs
      });

      // If it is an admin broadcast, trigger dynamic top ticker alert
      if (msg.type === 'admin' || msg.sender.includes('GM Broadcaster')) {
        setLatestBroadcast(msg.text);
        setTickerActive(true);
        // Hide ticker after 7 seconds
        setTimeout(() => {
          setTickerActive(false);
        }, 7000);
      }
    });

    socketInstance.on('eventChanged', (event: WorldEvent) => {
      setActiveEvent(event);
    });

    socketInstance.on('serverStats', (stats: ServerStats) => {
      setServerStats(stats);
      setActiveEvent(stats.activeEvent);
    });

    // Request metrics logs regularly
    const telemetryInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('requestServerStats');
      }
    }, 3000);

    return () => {
      clearInterval(telemetryInterval);
      socketInstance.disconnect();
    };
  }, []);

  // Scroll chats box to the bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (regPassword !== regConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          characterName: regCharName.trim(),
          className: regClass,
          gender: regGender
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Registration failed.');
      } else {
        setAuthSuccess(data.message || 'Account forged successfully! Please sign in below.');
        setLoginUsername(regUsername); // pre-fill username
        setAuthMode('login');
      }
    } catch (err) {
      setAuthError('Registration connection failed. Please check state.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Incorrect login details.');
      } else {
        if (data.token) {
          localStorage.setItem('psalterion_jwt_token', data.token);
        }

        if (data.user && data.user.character) {
          const char = data.user.character;
          setCharName(char.name);
          setCharClass(char.class);
          setCharGender(char.gender || 'M');

          if (socket && connected) {
            socket.emit('joinGame', {
              name: char.name,
              class: char.class,
              gender: char.gender || 'M'
            });
          }
          setIsLogged(true);
          // Auto-trigger tour step 0
          setTourStep(0);
        } else {
          setAuthError('Account verified, but no character resides on this realm.');
        }
      }
    } catch (err) {
      setAuthError('Connection timed out. Express API is booting.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('psalterion_jwt_token');
    setIsLogged(false);
    setSelfStats(null);
    setSelectedTargetId(null);
    if (socket) {
      socket.disconnect();
      socket.connect(); // reconnect to socket cleanly
    }
  };

  const transmitChatInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !chatInputText.trim()) return;

    socket.emit('sendMessage', chatInputText.trim());
    setChatInputText('');
  };

  const buyRestorativePotion = (itemName: 'potion' | 'elixir') => {
    if (!socket) return;
    socket.emit('buyItem', { itemName });
  };

  const TOUR_STEPS = [
    {
      title: "🌟 Step 1: Explore Psalter Castle safe village",
      desc: "Welcome to Legends of Psalterion! To begin, click anywhere on the ground to move your character or use your WASD / ARROW keys to walk around. Let's walk around the safe zone village!"
    },
    {
      title: "🏰 Step 2: Learn about the Safe Zone [Shielded]",
      desc: "You are inside Psalter Village, which is a designated Safe Zone. Monsters can never enter here and cannot attack you! Take a moment to relax and chill around safely."
    },
    {
      title: "🌲 Step 3: Venture into the Wilderness",
      desc: "Let's find some monsters to fight! Walk out of the village to the east or south (x or y coordinates greater than 390). You will see the level-1 Forest Slimes!"
    },
    {
      title: "⚔️ Step 4: Target a Forest Slime",
      desc: "To pick an enemy, click on a Forest Slime on the map. You will see its Level, Name and Health bar displayed on your active target window."
    },
    {
      title: "🔥 Step 5: Cast standard attacks",
      desc: "Press SPACEBAR or click the Attack skill buttons in your sidebar to cast spells and slay the Slime! Defeating monsters awards Gold coins and Experience points (XP)."
    },
    {
      title: "👑 Step 6: Upgrade your Class or Check GM Panel",
      desc: "You have completed the tour! Ask a Game Master (GM) to promote you to the premium Void Monarch class, customize world events, spawn bosses, or chat with other players!"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans flex flex-col antialiased">
      
      {/* 🗺️ Immersive Walkthrough Guided Tour Overlay */}
      {isLogged && tourStep !== null && (
        <div className="fixed bottom-6 left-6 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 font-sans text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-widest uppercase flex items-center gap-1.5">
              <Compass size={12} className="text-indigo-400 animate-pulse" /> Active realm Tour Guide
            </span>
            <button
              onClick={() => setTourStep(null)}
              className="text-xs text-slate-500 hover:text-slate-300 font-bold transition cursor-pointer"
            >
              ✕ Skip
            </button>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-200">
              {TOUR_STEPS[tourStep]?.title}
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
              {TOUR_STEPS[tourStep]?.desc}
            </p>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800/50 mt-1">
            <span className="text-[10px] font-mono text-slate-400">
              Step {tourStep + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex gap-1.5">
              {tourStep > 0 && (
                <button
                  type="button"
                  onClick={() => setTourStep(tourStep - 1)}
                  className="bg-slate-800 hover:bg-slate-755 text-slate-300 text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 font-bold cursor-pointer"
                >
                  <ArrowLeft size={10} /> Back
                </button>
              )}
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTourStep(tourStep + 1)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-md font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Next <ArrowRight size={10} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTourStep(null)}
                  className="bg-emerald-600 hover:bg-emerald-555 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-md font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Complete <CheckCircle2 size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 🚀 Dynamic GM Broadcaster Banner Announce Ticker */}
      <AnimatePresence>
        {tickerActive && latestBroadcast && (
          <motion.div
            initial={{ opacity: 0, y: -45 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -45 }}
            className="bg-gradient-to-r from-red-600 via-amber-600 to-indigo-600 font-mono text-xs font-bold text-slate-100 py-3 text-center border-b border-white/20 shadow-xl relative z-50 flex items-center justify-center gap-2"
          >
            <Flame className="animate-pulse" size={14} />
            <span>{latestBroadcast}</span>
            <Flame className="animate-pulse" size={14} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sword className="text-white text-xl animate-pulse" size={20} />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              Legends of Psalterion <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">turborepo</span>
            </h1>
            <p className="text-xs text-slate-400">Multiplayer Browser RPG Playground</p>
          </div>
        </div>

        {/* Global Connection Ticker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[10px] font-mono text-slate-400">
              {connected ? 'REALM ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Navigation Tab toggler */}
          {isLogged && (
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
              <button
                onClick={() => setActiveTab('play')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold font-sans transition flex items-center gap-2 ${activeTab === 'play' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                🎮 Play Game
              </button>
              <button
                onClick={() => setActiveTab('gm')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold font-sans transition flex items-center gap-2 ${activeTab === 'gm' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                👑 GM Console
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CORE CONTROLLER ZONE */}
      <main className="flex-1 p-6 flex flex-col justify-center items-center max-w-7xl w-full mx-auto">
        <AnimatePresence mode="wait">
          
          {/* STATE 1: Enter Room Character Selection Forms */}
          {!isLogged ? (
            <motion.div
              key="enter-room"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative top border glow */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

              {/* Login / Register Tab selection header */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className={`flex-1 py-3 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'login' ? 'bg-indigo-600 text-slate-100 shadow-md shadow-indigo-650/15' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <LogIn size={13} className="inline" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className={`flex-1 py-3 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'register' ? 'bg-indigo-600 text-slate-100 shadow-md shadow-indigo-650/15' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <UserPlus size={13} className="inline" /> Forge Account
                </button>
              </div>

              {/* Messages / Alerts */}
              {authError && (
                <div role="alert" className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2 animate-bounce">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* MODE A: LOGIN SCREEN */}
              {authMode === 'login' ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-4 font-sans">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
                      ⚔️ Enter the Realm
                    </h3>
                    <p className="text-xs text-slate-400">
                      Access your persistent character logs to multiplayer sync.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <User size={11} /> Username
                    </label>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Your account username..."
                      className="w-full bg-slate-950 border border-slate-800 py-2.5 px-4 rounded-xl text-slate-250 placeholder-slate-600 focus:outline-none focus:border-indigo-600 font-mono text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Lock size={11} /> Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 py-2.5 px-4 rounded-xl text-slate-250 placeholder-slate-600 focus:outline-none focus:border-indigo-600 font-mono text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading || !connected}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 py-3 rounded-xl font-extrabold text-sm text-slate-100 shadow-xl flex items-center justify-center gap-1.5 transition mt-2 cursor-pointer"
                  >
                    {authLoading ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    Step into Psalter [Log In]
                  </button>
                </form>
              ) : (

                /* MODE B: REGISTRATION / CHARACTER CREATION SCREEN */
                <form onSubmit={handleRegister} className="flex flex-col gap-4 font-sans max-h-[460px] overflow-y-auto pr-1">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
                      🔮 Forge New Hero Identity
                    </h3>
                    <p className="text-xs text-slate-400">
                      Establish username credentials and craft your starter profile class.
                    </p>
                  </div>

                  {/* Account detail fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <User size={10} /> Username
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Choose username..."
                        className="w-full bg-slate-950 border border-slate-800 py-2 px-3 rounded-lg text-slate-250 text-xs font-mono placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Mail size={10} /> Email Addr
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="adventurer@psalter.net"
                        className="w-full bg-slate-950 border border-slate-800 py-2 px-3 rounded-lg text-slate-250 text-xs font-mono placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Lock size={10} /> Password
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Set securely"
                        className="w-full bg-slate-950 border border-slate-800 py-2 px-3 rounded-lg text-slate-250 text-xs font-mono placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Lock size={10} /> Confirm
                      </label>
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Retype password"
                        className="w-full bg-slate-950 border border-slate-800 py-2 px-3 rounded-lg text-slate-250 text-xs font-mono placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Character Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      ✨ Character Identity Display Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      value={regCharName}
                      onChange={(e) => setRegCharName(e.target.value)}
                      placeholder="Pick nickname (Example: Lancelot)"
                      className="w-full bg-slate-950 border border-slate-800 py-2 px-3 rounded-lg text-slate-250 text-xs font-mono placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  {/* Gender Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Select Avatar Gender
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegGender('M')}
                        className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${regGender === 'M' ? 'border-sky-500 bg-sky-950/25 text-sky-200' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        ♂ Male Starter
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegGender('F')}
                        className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${regGender === 'F' ? 'border-pink-500 bg-pink-950/25 text-pink-200' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        ♀ Female Starter
                      </button>
                    </div>
                  </div>

                  {/* Class options selectors (Strictly excludes premium GM Void Monarch) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Select Specialty Class
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'WARRIOR' as const, name: 'Warrior', desc: '⚔️ Defender', color: 'text-amber-100 hover:border-slate-700' },
                        { id: 'MAGE' as const, name: 'Mage', desc: '🔮 Fireballs', color: 'text-purple-100 hover:border-slate-705' },
                        { id: 'ARCHER' as const, name: 'Archer', desc: '🏹 Fast bow', color: 'text-emerald-100 hover:border-slate-705' }
                      ].map(cls => (
                        <button
                          type="button"
                          key={cls.id}
                          onClick={() => setRegClass(cls.id)}
                          className={`border rounded-lg p-2 flex flex-col gap-0.5 text-center transition cursor-pointer relative overflow-hidden ${regClass === cls.id ? 'border-indigo-600 bg-indigo-950/25' : 'border-slate-800 ' + cls.color}`}
                        >
                          <span className="text-[11px] font-bold">{cls.name}</span>
                          <span className="text-[8px] text-slate-500">{cls.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submission CTA */}
                  <button
                    type="submit"
                    disabled={authLoading || !connected}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 py-2.5 rounded-lg font-bold text-xs text-slate-100 shadow-xl flex items-center justify-center gap-1.5 border border-indigo-500 transition cursor-pointer mt-1"
                  >
                    {authLoading ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    Forging Account & Character
                  </button>
                </form>
              )}
            </motion.div>
          ) : (
            
            /* STATE 2: Player enters the dynamic World */
            <motion.div
              key="game-room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col gap-6"
            >
              
              {/* IF CHOSEN PLAY TAB */}
              {activeTab === 'play' ? (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  
                  {/* LEFT: Game Window Canvas Frame */}
                  <div className="xl:col-span-3 flex flex-col gap-3 min-h-[500px]">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300 font-mono">ACTIVE TARGET:</span>
                        {selectedTargetId ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-red-950/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold animate-pulse">
                            <Sparkle size={12} className="animate-spin" />
                            Targeting Mob: {selectedTargetId}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">No Target (Click monsters on-screen to target list)</span>
                        )}
                      </div>
                      
                      {/* Active World Multipliers warning banners */}
                      {activeEvent !== 'NORMAL' && (
                        <div className="text-[10px] font-bold font-mono px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-700/50 text-indigo-300 animate-pulse flex items-center gap-1.5">
                          <Flame size={12} /> GLOBAL ACTIVE: {activeEvent}
                        </div>
                      )}
                    </div>

                    {/* Canvas Frame Insertion */}
                    <div className="flex-1 h-[500px]">
                      <GameContainer
                        socket={socket}
                        selfId={selfId}
                        onTargetSelected={setSelectedTargetId}
                        onStatsUpdated={(u) => setSelfStats(u)}
                      />
                    </div>
                  </div>

                  {/* RIGHT: Responsive React HUD Control Sidebars */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 h-[560px] shadow-lg">
                    {/* Level Profile Badge HUD */}
                    {selfStats && (
                      <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider font-mono">
                              {selfStats.class} PROFILE
                            </div>
                            <div className="text-base font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
                              {selfStats.name}
                              <span className={`text-[10px] font-bold px-1.5 py-0 px-1 rounded font-mono ${selfStats.gender === 'F' ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'}`}>
                                {selfStats.gender === 'F' ? '♀ F' : '♂ M'}
                              </span>
                            </div>
                          </div>
                          <div className="bg-indigo-650 px-2 py-1 rounded font-bold font-mono text-xs shadow-md">
                            Lv.{selfStats.level}
                          </div>
                        </div>

                        {/* HP Bar */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-slate-400 flex items-center gap-1"><Heart size={10} className="text-red-500" /> HP</span>
                            <span className="text-slate-300">{selfStats.hp} / {selfStats.maxHp}</span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-850">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-300"
                              style={{ width: `${(selfStats.hp / selfStats.maxHp) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* XP Bar */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-slate-400 flex items-center gap-1"><Award size={10} className="text-indigo-400" /> XP progress</span>
                            <span className="text-slate-300">{selfStats.xp} / {selfStats.level * 100}</span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-850">
                            <div
                              className="bg-indigo-500 h-full transition-all duration-300"
                              style={{ width: `${(selfStats.xp / (selfStats.level * 100)) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Gold Accumulations */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900 mt-1">
                          <span className="text-slate-400">💰 Wealth Gold:</span>
                          <span className="font-mono font-bold text-amber-400">{selfStats.gold} Gold</span>
                        </div>
                      </div>
                    )}

                    {/* 🌌 Void Monarch Ascension State Dashboard */}
                    {selfStats && selfStats.class === 'VOID_MONARCH' && (
                      <div className="bg-gradient-to-br from-purple-950/40 via-slate-950 to-indigo-950/40 p-4 border border-purple-900/40 rounded-xl flex flex-col gap-3 shadow-lg shadow-purple-950/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1">
                          <Sparkle className="text-purple-400 animate-spin" size={12} />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-fuchsia-400 font-mono tracking-wider uppercase flex items-center gap-1">
                            🌌 Void Tier Ascension
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                            Current: <span className="text-purple-300 font-bold">{selfStats.voidState || 'CORE'}</span>
                          </span>
                        </div>

                        {/* Interactive Grid of Multiplier States */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { name: 'CORE', multi: 'x10', color: 'border-blue-900/30 text-blue-300 hover:border-blue-700/50 bg-blue-950/10' },
                            { name: 'ASCENDED', multi: 'x20', color: 'border-purple-900/30 text-purple-300 hover:border-purple-700/50 bg-purple-950/10' },
                            { name: 'APEX', multi: 'x30', color: 'border-pink-900/30 text-pink-300 hover:border-pink-700/50 bg-pink-950/10' },
                            { name: 'OVERFLOW', multi: 'x50', color: 'border-yellow-900/30 text-yellow-350 hover:border-yellow-700/50 bg-yellow-950/10 font-black animate-pulse' }
                          ].map(state => (
                            <button
                              type="button"
                              key={state.name}
                              onClick={() => {
                                if (socket) {
                                  socket.emit('changeVoidState', { state: state.name });
                                }
                              }}
                              className={`border rounded-lg p-1.5 text-center flex flex-col items-center justify-center transition cursor-pointer relative ${selfStats.voidState === state.name ? 'border-purple-500 bg-purple-900/35 ring-1 ring-purple-500/50 text-white font-bold' : state.color}`}
                            >
                              <span className="text-[10px] font-bold tracking-tight">{state.name}</span>
                              <span className="text-[9px] text-slate-400">{state.multi} Power</span>
                            </button>
                          ))}
                        </div>

                        {/* Stat Multiplier Values Breakdown */}
                        <div className="space-y-1.5 pt-1.5 border-t border-purple-900/25">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>⚔️ Strength (PHY):</span>
                            <span className="text-rose-450 font-bold">{selfStats.strength || 2000}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>🔮 Intellect (MAG):</span>
                            <span className="text-cyan-400 font-bold">{selfStats.intellect || 4000}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>⚡ Agility (SPEED):</span>
                            <span className="text-emerald-400 font-bold">{selfStats.agility || 7000}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>💚 Vitality (SURV):</span>
                            <span className="text-fuchsia-400 font-bold">{selfStats.vitality || 10000}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Navigation HUD panel selector slots */}
                    <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                      <button
                        onClick={() => setHudTab('chat')}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 ${hudTab === 'chat' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <MessageSquare size={12} /> Chat
                      </button>
                      <button
                        onClick={() => setHudTab('players')}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 ${hudTab === 'players' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Users size={12} /> Sockets ({playersList.length})
                      </button>
                      <button
                        onClick={() => setHudTab('shop')}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 ${hudTab === 'shop' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <ShoppingCart size={12} /> merchant
                      </button>
                    </div>

                    {/* PANEL TARGET CONTROLLER */}
                    <div className="flex-1 bg-slate-950/30 rounded-xl p-3 border border-slate-850 overflow-hidden flex flex-col">
                      <AnimatePresence mode="wait">
                        
                        {/* TAB 1: Real-time World Chat */}
                        {hudTab === 'chat' && (
                          <motion.div
                            key="tab-chat"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col overflow-hidden h-full"
                          >
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[170px] custom-scrollbar">
                              {chatLog.map((c, idx) => (
                                <div key={c.id || idx} className="text-[11px] leading-relaxed break-words font-mono">
                                  {c.type === 'system' && (
                                    <span className="text-teal-400">{c.sender}: {c.text}</span>
                                  )}
                                  {c.type === 'world' && (
                                    <span>
                                      <span className="text-indigo-400 font-semibold">{c.sender}:</span>{' '}
                                      <span className="text-slate-300">{c.text}</span>
                                    </span>
                                  )}
                                  {c.type === 'admin' && (
                                    <span className="text-amber-400 font-bold bg-amber-950/20 px-1 py-0.5 rounded border border-amber-900/40 inline-block w-full">
                                      {c.text}
                                    </span>
                                  )}
                                </div>
                              ))}
                              <div ref={chatBottomRef} />
                            </div>

                            {/* Input Form */}
                            <form onSubmit={transmitChatInput} className="mt-2 flex gap-1 pt-2 border-t border-slate-900">
                              <input
                                type="text"
                                maxLength={60}
                                value={chatInputText}
                                onChange={(e) => setChatInputText(e.target.value)}
                                placeholder="Type public chat message..."
                                className="flex-1 bg-slate-950 text-xs text-slate-200 p-2 rounded border border-slate-850 focus:outline-none focus:border-indigo-650"
                              />
                              <button
                                type="submit"
                                disabled={!chatInputText.trim()}
                                className="bg-indigo-600 disabled:bg-indigo-900/40 p-2 rounded text-slate-100 shadow-md hover:bg-indigo-500 cursor-pointer"
                              >
                                <Send size={12} />
                              </button>
                            </form>
                          </motion.div>
                        )}

                        {/* TAB 2: Synced Players Connected */}
                        {hudTab === 'players' && (
                          <motion.div
                            key="tab-players"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 overflow-y-auto space-y-2 max-h-[220px]"
                          >
                            {playersList.map(p => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-850 text-xs font-mono"
                              >
                                <div>
                                  <div className="font-semibold text-slate-200">
                                    {p.name} {p.id === selfId && <span className="text-[10px] text-teal-400 font-normal border border-teal-400/20 px-1 py-0.5 rounded-full ml-1">You</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500 pt-0.5">{p.class} • Level {p.level}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-emerald-400 font-bold">{p.hp}/{p.maxHp} HP</div>
                                  <div className="text-[9px] text-slate-500">Gold: {p.gold}</div>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}

                        {/* TAB 3: Restoratives Shop Merchant */}
                        {hudTab === 'shop' && (
                          <motion.div
                            key="tab-shop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <p className="text-[11px] text-slate-400 leading-normal">
                                Click below to exchange collected gold coins for instant potion restoration!
                              </p>

                              {/* Item Potion card */}
                              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-850 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded bg-red-950/60 flex items-center justify-center text-red-400 font-bold border border-red-900/30">
                                    🧪
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-200">Health Potion</div>
                                    <div className="text-[10px] text-emerald-400">+40 HP Restored</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => buyRestorativePotion('potion')}
                                  className="bg-amber-500 hover:bg-amber-400 text-slate-955 text-[10px] font-bold px-2.5 py-1.5 rounded transition"
                                >
                                  15g Buy
                                </button>
                              </div>
                            </div>

                            <div className="text-[10px] text-center text-slate-500 font-mono pt-4 mt-auto border-t border-slate-900">
                              🛒 Alchemist Shon • Psalter Outskirts
                            </div>
                          </motion.div>
                        )}

                      </AnimatePresence>
                    </div>

                    {/* Exit Game buttons */}
                    <button
                      onClick={() => {
                        socket?.disconnect();
                        setIsLogged(false);
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <LogOut size={12} /> Log Out Game Workspace
                    </button>
                  </div>

                </div>
              ) : (
                
                /* IF CHOSEN GM PANEL ADMIN TAB */
                <motion.div
                  key="admin-room"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <GMConsole
                    socket={socket}
                    serverStats={serverStats}
                    activePlayersList={playersList}
                  />
                </motion.div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER BAR */}
      <footer className="bg-slate-900/40 text-center py-4 border-t border-slate-850 mt-auto">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Created in Sandboxed Cloud Sandbox Environments • Port 3000 Ingress Protected
        </p>
      </footer>
    </div>
  );
}
