import { PlayerNetworkState, Vector2D } from '@psalter/shared';

export class GameEngine {
  // Key: Socket ID, Value: Player Network State
  private activePlayers: Map<string, PlayerNetworkState> = new Map();
  private broadcastCallback: (players: PlayerNetworkState[]) => void;
  private loopInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 50; // 20 updates per second (20Hz)

  constructor(onTickBroadcast: (players: PlayerNetworkState[]) => void) {
    this.broadcastCallback = onTickBroadcast;
    this.startLoop();
  }

  private startLoop() {
    this.loopInterval = setInterval(() => {
      if (this.activePlayers.size > 0) {
        this.broadcastCallback(Array.from(this.activePlayers.values()));
      }
    }, this.TICK_RATE);
  }

  public registerPlayer(socketId: string, playerState: PlayerNetworkState): void {
    this.activePlayers.set(socketId, playerState);
  }

  public updatePlayerMovement(socketId: string, position: Vector2D, heading: 'left' | 'right'): void {
    const player = this.activePlayers.get(socketId);
    if (player) {
      player.position = position;
      player.heading = heading;
    }
  }

  public removePlayer(socketId: string): PlayerNetworkState | null {
    const player = this.activePlayers.get(socketId);
    if (player) {
      this.activePlayers.delete(socketId);
      return player;
    }
    return null;
  }

  public getPlayerBySocketId(socketId: string): PlayerNetworkState | undefined {
    return this.activePlayers.get(socketId);
  }

  public shutdown() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
  }
}
