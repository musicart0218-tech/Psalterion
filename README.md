# 🌌 Legends of Psalterion

An immersive, real-time multiplayer browser fantasy RPG built with **Phaser 3 Game Client**, an **Express + Socket.IO Server**, and a **GM Dashboard Admin Panel**.

This workspace is structured as a **Turborepo** monorepo workspace for optimized scaling, code reuse, and seamless development.

## 📁 Workspace Layout

```bash
legends-of-psalterion/
├── apps/
│   ├── client/          # Phaser 3 Game Client (TypeScript)
│   ├── server/          # Node.js + Express + Socket.IO Server
│   └── admin/           # GM Dashboard Admin Panel (React)
├── packages/
│   ├── config/          # Shared TSConfig, ESLint, and Prettier configurations
│   └── shared/          # Shared Types, Interfaces, and Constants (TypeScript)
├── prisma/
│   └── schema.prisma    # Prisma Database Schema (PostgreSQL/Cloud SQL mapping)
├── package.json         # Root monorepo configuration & scripts
├── turbo.json           # Turborepo task pipeline configuration
└── README.md            # You are here!
```

---

## 🚀 Game Features

### 1. Phaser 3 Client (`apps/client`)
- **Retro Fantasy RPG Aesthetics**: Generates a rich, interactive fantasy grid-map complete with collision layers, stone boundaries, portals, and safe zones.
- **Dynamic Character Control**: Select between three signature character classes:
  - **Warrior**: High defense, powerful melee smash skill.
  - **Mage**: High mana, ranged Fireball casting, and glowing projectile animations.
  - **Archer**: Fast movement speed, rapid arrow attacks.
- **Rich Client HUD Overlay**: Integrated real-time inventory sheet, dynamic experience bars, quest logs, and an active local/global multiplayer quest panel.

### 2. Live Socket Server (`apps/server`)
- Coordinate client connection cycles, player movement synchronizations, monster attack/respawn registers, loot allocations, and general world chat routing.
- Scaled for real-time multiplayer synchronization running standard 30Hz grid packets over WebSockets.

### 3. GM Dashboard Admin (`apps/admin`)
- Real-time diagnostics including player rosters, connection pools, machine resource telemetry, and active logs.
- Trigger global server-side events dynamically (e.g., *Double XP*, *Gold Rush*, or system warnings).
- Live control buttons to spawn boss mobs (e.g., Goblins, Orcs, or the legendary Dragon) and teleport players.

---

## 🛠️ Instructions to Start

The platform triggers the system via standard server operations. All features are cohesive, running a combined stack server on port `3000`.

### Dev Mode
To compile the stack and boot the server in local development:
```bash
npm run dev
```

### Production Build
To bundle the assets and run the standalone server:
```bash
npm run build
npm start
```
