import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, PlayerNetworkState, ChatMessagePayload, CharacterClass } from '@psalter/shared';
import { GameEngine } from './gameEngine';
import { prisma, isDbAvailable, memoryCharacters } from '../config/prisma';

export class SocketService {
  private io: Server;
  private gameEngine: GameEngine;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // For alpha local development pipelines
        methods: ['GET', 'POST']
      }
    });

    // Initialize GameEngine with continuous broadcast loop
    this.gameEngine = new GameEngine((syncedPlayers) => {
      this.io.emit(SOCKET_EVENTS.PLAYER_MOVE, syncedPlayers);
    });

    this.initializeEvents();
  }

  private initializeEvents() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`📡 Network node connected: ${socket.id}`);

      // Handle Character Handshake / Selection
      socket.on(SOCKET_EVENTS.AUTH_REQUEST, async (data: { characterId: string }) => {
        try {
          let characterName = '';
          let className: CharacterClass = 'GUARDIAN';
          let initialMap = 'asterhaven';
          let posX = 400.0;
          let posY = 300.0;
          let hpValue = 140;
          let maxHpValue = 140;
          let usernameVal = 'Adventurer';
          let characterIdStr = data.characterId;
          let isUserGm = false;

          if (isDbAvailable) {
            const dbCharacter = await prisma.character.findUnique({
              where: { id: data.characterId },
              include: { user: true }
            });
            if (dbCharacter) {
              characterName = dbCharacter.name;
              className = dbCharacter.class as CharacterClass;
              initialMap = dbCharacter.currentMap;
              posX = dbCharacter.positionX;
              posY = dbCharacter.positionY;
              hpValue = dbCharacter.currentHp;
              maxHpValue = dbCharacter.maxHp;
              usernameVal = dbCharacter.user.username;
              isUserGm = dbCharacter.user.isGm;
            }
          }

          // Fallback to shared in-memory records
          if (!characterName) {
            const memChar = memoryCharacters.get(data.characterId);
            if (memChar) {
              characterName = memChar.name;
              className = memChar.class as CharacterClass;
              initialMap = memChar.currentMap;
              posX = memChar.positionX;
              posY = memChar.positionY;
              hpValue = memChar.currentHp;
              maxHpValue = memChar.maxHp;
              usernameVal = memChar.name;
              characterIdStr = memChar.id;
              isUserGm = characterName.toLowerCase().includes('gm_') || characterName === 'admin';
            } else {
              // Alternate lookup by name
              const foundChar = Array.from(memoryCharacters.values()).find(
                (c: any) => c.name === data.characterId || c.id === data.characterId
              );
              if (foundChar) {
                characterName = foundChar.name;
                className = foundChar.class as CharacterClass;
                initialMap = foundChar.currentMap;
                posX = foundChar.positionX;
                posY = foundChar.positionY;
                hpValue = foundChar.currentHp;
                maxHpValue = foundChar.maxHp;
                usernameVal = foundChar.name;
                characterIdStr = foundChar.id;
                isUserGm = characterName.toLowerCase().includes('gm_') || characterName === 'admin';
              }
            }
          }

          if (!characterName) {
            socket.emit(SOCKET_EVENTS.AUTH_FAILURE, { message: "Character entity not found." });
            return;
          }

          // Create runtime standard object mapping
          const initialNetworkState: PlayerNetworkState = {
            id: characterIdStr,
            username: usernameVal,
            characterName: characterName,
            className: className,
            mapId: initialMap,
            position: { x: posX, y: posY },
            heading: 'right',
            currentHp: hpValue,
            maxHp: maxHpValue
          };

          // Cache in Engine and join localized socket channels
          this.gameEngine.registerPlayer(socket.id, initialNetworkState);
          socket.join(initialNetworkState.mapId);
          if (isUserGm) {
            socket.join('gm_moderators');
          }

          // Acknowledge target client entry
          socket.emit(SOCKET_EVENTS.AUTH_SUCCESS, initialNetworkState);

          // Alert other regional players in map
          socket.to(initialNetworkState.mapId).emit(SOCKET_EVENTS.PLAYER_JOIN, initialNetworkState);
          console.log(`🎮 Player registered: ${characterName} entered ${initialMap}`);

        } catch (error) {
          console.error("Critical handshake error:", error);
          socket.emit(SOCKET_EVENTS.AUTH_FAILURE, { message: "Database handshake exception encountered." });
        }
      });

      // Handle Movement Deltas
      socket.on(SOCKET_EVENTS.PLAYER_MOVE, (data: { position: { x: number; y: number }; heading: 'left' | 'right' }) => {
        this.gameEngine.updatePlayerMovement(socket.id, data.position, data.heading);
      });

      // Handle Chat Distribution System
      socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data: { text: string; channel: ChatMessagePayload['channel'] }) => {
        const player = this.gameEngine.getPlayerBySocketId(socket.id);
        if (!player) return;

        const payload: ChatMessagePayload = {
          sender: player.characterName,
          text: data.text,
          channel: data.channel,
          timestamp: Date.now()
        };

        if (data.channel === 'local') {
          this.io.to(player.mapId).emit(SOCKET_EVENTS.CHAT_MESSAGE, payload);
        } else {
          // Global broadcast pipelines
          this.io.emit(SOCKET_EVENTS.CHAT_MESSAGE, payload);
        }
      });

      // Handle Admin GM Commands Execution
      socket.on(SOCKET_EVENTS.GM_COMMAND, async (data: { command: string; args: string[] }) => {
        const player = this.gameEngine.getPlayerBySocketId(socket.id);
        if (!player) return;

        // Verify GM privilege via DB lookup or fallback name checks
        let userIsGm = player.characterName.toLowerCase().includes('gm_') || player.characterName === 'admin';
        
        if (isDbAvailable) {
          const checkUser = await prisma.character.findUnique({
            where: { id: player.id },
            select: { user: { select: { isGm: true } } }
          });
          if (checkUser && checkUser.user) {
            userIsGm = checkUser.user.isGm;
          }
        }

        if (!userIsGm) {
          socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
            sender: "SYSTEM",
            text: "Access Denied: Administrative Clearance Missing.",
            channel: "system",
            timestamp: Date.now()
          } as ChatMessagePayload);
          return;
        }

        // Process Command Arguments
        if (data.command === 'announce') {
          const notice = data.args.join(' ');
          this.io.emit(SOCKET_EVENTS.GM_ANNOUNCEMENT, { text: notice });
        }
      });

      // Handle Disconnection Synchronization
      socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
        const removedPlayer = this.gameEngine.removePlayer(socket.id);
        if (removedPlayer) {
          // Alert adjacent instances immediately
          this.io.to(removedPlayer.mapId).emit(SOCKET_EVENTS.PLAYER_LEAVE, { id: removedPlayer.id });

          // Persist coordinates smoothly to Postgres or Local Memory on quit
          try {
            if (isDbAvailable) {
              await prisma.character.update({
                where: { id: removedPlayer.id },
                data: {
                  positionX: removedPlayer.position.x,
                  positionY: removedPlayer.position.y,
                  currentMap: removedPlayer.mapId
                }
              });
              console.log(`💾 State safely backed up for character: ${removedPlayer.characterName}`);
            } else {
              const memChar = memoryCharacters.get(removedPlayer.id);
              if (memChar) {
                memChar.positionX = removedPlayer.position.x;
                memChar.positionY = removedPlayer.position.y;
                memChar.currentMap = removedPlayer.mapId;
                console.log(`💾 State safely backed up in local-memory for character: ${removedPlayer.characterName}`);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to write back data out for character ${removedPlayer.id}:`, error);
          }
        }
        console.log(`🔌 Client disconnected from network node: ${socket.id}`);
      });
    });
  }
}
