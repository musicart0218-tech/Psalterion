import Phaser from 'phaser';
import { Network } from '../network/socket';
import { SOCKET_EVENTS, PlayerNetworkState } from '@psalter/shared';
import { VitalsHUD } from '../components/VitalsHUD';
import { ChatHUD } from '../components/ChatHUD';

export class WorldScene extends Phaser.Scene {
  private localPlayer!: Phaser.GameObjects.Container;
  private localPlayerId!: string;
  private remotePlayers: Map<string, Phaser.GameObjects.Container> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private movementSpeed: number = 200;

  // UI Framework Instances
  private vitalsHUD!: VitalsHUD;
  private chatHUD!: ChatHUD;

  constructor() {
    super('WorldScene');
  }

  create() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    // Initialize HTML floating layouts
    this.vitalsHUD = new VitalsHUD();
    this.chatHUD = new ChatHUD();

    Network.connect();
    const characterId = sessionStorage.getItem('characterId');
    Network.socket.emit(SOCKET_EVENTS.AUTH_REQUEST, { characterId });

    Network.socket.on(SOCKET_EVENTS.AUTH_SUCCESS, (data: PlayerNetworkState) => {
      this.localPlayerId = data.id;
      this.createPlayerInstance(data, true);
      
      // Seed details straight into top bar tracker overlay
      this.vitalsHUD.updateVitals(data.characterName, data.className, data.currentHp, data.maxHp);
      this.chatHUD.pushMessage("SYSTEM", "Welcome to Legends of Astra Alpha. Use arrow keys to explore!", "#00ffcc");
    });

    Network.socket.on(SOCKET_EVENTS.PLAYER_JOIN, (data: PlayerNetworkState) => {
      if (!this.remotePlayers.has(data.id)) {
        this.createPlayerInstance(data, false);
        this.chatHUD.pushMessage("SYSTEM", `${data.characterName} connected to your phase.`, "#8b949e");
      }
    });

    Network.socket.on(SOCKET_EVENTS.PLAYER_MOVE, (playerList: PlayerNetworkState[]) => {
      playerList.forEach((player) => {
        if (player.id === this.localPlayerId) return;
        const remoteEntity = this.remotePlayers.get(player.id);
        if (remoteEntity) {
          remoteEntity.setPosition(player.position.x, player.position.y);
        }
      });
    });

    Network.socket.on(SOCKET_EVENTS.PLAYER_LEAVE, (data: { id: string }) => {
      const entity = this.remotePlayers.get(data.id);
      if (entity) {
        entity.destroy();
        this.remotePlayers.delete(data.id);
      }
    });
  }

  update() {
    if (!this.localPlayer) return;

    // Quick focus chat input toggle with Enter key
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      const inputEl = document.getElementById('chat-input') as HTMLInputElement;
      if (inputEl && document.activeElement !== inputEl) {
        inputEl.focus();
        return;
      }
    }

    // Completely lock character movement calculations if user is actively writing a message
    if (this.chatHUD.isTyping) return;

    let vx = 0;
    let vy = 0;
    let heading: 'left' | 'right' = 'right';

    if (this.cursors.left?.isDown) { vx = -this.movementSpeed; heading = 'left'; }
    else if (this.cursors.right?.isDown) { vx = this.movementSpeed; heading = 'right'; }

    if (this.cursors.up?.isDown) { vy = -this.movementSpeed; }
    else if (this.cursors.down?.isDown) { vy = this.movementSpeed; }

    if (vx !== 0 || vy !== 0) {
      const dt = this.game.loop.delta / 1000;
      this.localPlayer.x += vx * dt;
      this.localPlayer.y += vy * dt;

      Network.socket.emit(SOCKET_EVENTS.PLAYER_MOVE, {
        position: { x: this.localPlayer.x, y: this.localPlayer.y },
        heading: heading
      });
    }
  }

  private createPlayerInstance(data: PlayerNetworkState, isLocal: boolean) {
    const container = this.add.container(data.position.x, data.position.y);
    const sprite = this.add.image(0, 0, 'player_fallback');
    const nameTag = this.add.text(-16, -24, data.characterName, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: isLocal ? '#00ffcc' : '#ffffff'
    });

    container.add([sprite, nameTag]);

    if (isLocal) {
      this.localPlayer = container;
      this.cameras.main.startFollow(this.localPlayer, true, 0.1, 0.1);
    } else {
      this.remotePlayers.set(data.id, container);
    }
  }
}
