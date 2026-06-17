import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { PlayerState, Monster, Position } from '@/packages/shared/src/index';

// @ts-ignore
import imgMapBg from '@/src/assets/images/aqw_map_bg_1781664891977.jpg';
// @ts-ignore
import imgWarrior from '@/src/assets/images/aqw_warrior_1781664905365.jpg';
// @ts-ignore
import imgMage from '@/src/assets/images/aqw_mage_1781664926946.jpg';
// @ts-ignore
import imgArcher from '@/src/assets/images/aqw_archer_1781664939430.jpg';
// @ts-ignore
import imgSlime from '@/src/assets/images/aqw_slime_1781664951408.jpg';
// @ts-ignore
import imgDragon from '@/src/assets/images/aqw_dragon_1781664965342.jpg';

// Event bus to sync details back to React HUD
export const PhaserEventBus = new Phaser.Events.EventEmitter();

export class LegendsScene extends Phaser.Scene {
  public socket!: Socket;
  public selfPlayerId: string | null = null;
  private hasSocketLoaded = false;
  private targetMovePos: { x: number; y: number } | null = null;
  
  public getHasSocketLoaded(): boolean {
    return this.hasSocketLoaded;
  }
  
  // Game Sprites mapping
  private players: Map<string, Phaser.GameObjects.Container> = new Map();
  private monsters: Map<string, Phaser.GameObjects.Container> = new Map();
  
  // Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private attackKey!: Phaser.Input.Keyboard.Key;
  
  // Combat Target selection
  private selectedMobId: string | null = null;
  private selectionRing?: Phaser.GameObjects.Graphics;

  // Grid background
  private mapGrid!: Phaser.GameObjects.Grid;
  
  // Map dimensions
  private mapWidth = 1200;
  private mapHeight = 1000;

  constructor() {
    super({ key: 'LegendsScene' });
  }

  init(data: { socket: Socket; selfId: string }) {
    if (data && data.socket) {
      this.socket = data.socket;
      this.selfPlayerId = data.selfId;
      this.hasSocketLoaded = true;
    }
  }

  preload() {
    // Generate all sprites and icons dynamically using graphics to bypass external static assets dependency
    this.generateTextureAtlas();

    // Load AQW-themed premium high-fidelity graphics
    this.load.image('aqw_map_bg', imgMapBg);
    this.load.image('aqw_warrior', imgWarrior);
    this.load.image('aqw_mage', imgMage);
    this.load.image('aqw_archer', imgArcher);
    this.load.image('aqw_slime', imgSlime);
    this.load.image('aqw_dragon', imgDragon);
  }

  create() {
    // Draw background grid representing safe village and dangerous wilderness grass
    this.createWorldBoundaries();

    // Initialize key inputs
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys('W,A,S,D') as any;
    
    // Space or click to activate skills/attacks
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Target Selection cursor ring
    this.selectionRing = this.add.graphics();
    this.selectionRing.setDepth(1);

    // Dynamic camera following self-player sprite
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // Setup Socket Listeners Inside Scene
    if (this.socket) {
      this.setupSocketHandlers();
      // Trigger full synchrony scan once Phaser instance is ready
      this.socket.emit('requestFullSync');
    }

    // Map Click mechanics to designate hostile targets
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      
      // Determine what was clicked
      let clickedMob: string | null = null;
      let closestDist = 45;

      this.monsters.forEach((container, mobId) => {
        const d = Phaser.Math.Distance.Between(worldX, worldY, container.x, container.y);
        if (d < closestDist) {
          closestDist = d;
          clickedMob = mobId;
        }
      });

      if (clickedMob) {
        this.targetMovePos = null; // stop running during target engagement
        this.selectedMobId = clickedMob;
        PhaserEventBus.emit('targetSelected', this.selectedMobId);
      } else {
        // If clicked elsewhere, clear target AND activate click-to-move glides! (AQWorlds click to walk)
        this.selectedMobId = null;
        PhaserEventBus.emit('targetSelected', null);
        this.targetMovePos = { x: worldX, y: worldY };

        // Render localized green circular placement locator (visual cue)
        const ring = this.add.circle(worldX, worldY, 4, 0x10b981, 0.65);
        this.tweens.add({
          targets: ring,
          scale: 3.5,
          alpha: 0,
          duration: 320,
          onComplete: () => ring.destroy()
        });
      }
    });

    // Notify React that Phaser canvas initialized successfully
    PhaserEventBus.emit('sceneReady', this);
  }

  update(time: number, delta: number) {
    const selfContainer = this.players.get(this.selfPlayerId || '');
    if (!selfContainer) return;

    const body = selfContainer.body as Phaser.Physics.Arcade.Body;
    const speed = selfContainer.getData('speed') || 130;
    
    let vx = 0;
    let vy = 0;

    const isWDown = this.wasdKeys.W.isDown || this.cursors.up.isDown;
    const isADown = this.wasdKeys.A.isDown || this.cursors.left.isDown;
    const isSDown = this.wasdKeys.S.isDown || this.cursors.down.isDown;
    const isDDown = this.wasdKeys.D.isDown || this.cursors.right.isDown;

    // Direct movement reading both WASD and Arrow Keys
    if (isWDown || isADown || isSDown || isDDown) {
      this.targetMovePos = null; // interrupts click-to-move on physical key override

      if (isADown) {
        vx = -speed;
      } else if (isDDown) {
        vx = speed;
      }

      if (isWDown) {
        vy = -speed;
      } else if (isSDown) {
        vy = speed;
      }
    } else if (this.targetMovePos) {
      // Auto-navigation glide towards target destination
      const dx = this.targetMovePos.x - selfContainer.x;
      const dy = this.targetMovePos.y - selfContainer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        this.targetMovePos = null;
        body.setVelocity(0, 0);
      } else {
        const angle = Math.atan2(dy, dx);
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
    }

    // Apply movement speeds smoothly (with diagonal scaling factor)
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    body.setVelocity(vx, vy);

    // Check turning flips for direction
    const crest = selfContainer.getData('crest') as Phaser.GameObjects.Graphics;
    const charImg = selfContainer.getData('charImage') as Phaser.GameObjects.Image;
    if (vx < 0) {
      if (crest) crest.setScale(-1, 1);
      if (charImg) charImg.setScale(-1, 1);
    } else if (vx > 0) {
      if (crest) crest.setScale(1, 1);
      if (charImg) charImg.setScale(1, 1);
    }

    // Broadcast updated positions to game server
    if (vx !== 0 || vy !== 0) {
      this.socket.emit('playerMove', {
        x: selfContainer.x,
        y: selfContainer.y
      });
    }

    // Trigger skills / combat swing checks
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.triggerAttackSequence();
    }

    // Update target selection rings
    this.drawSelectionHUD();
  }

  private triggerAttackSequence() {
    this.socket.emit('playerAttack', {
      targetMobId: this.selectedMobId || undefined
    });
  }

  // Draw focus ring on current hostile targets
  private drawSelectionHUD() {
    this.selectionRing?.clear();
    if (!this.selectedMobId) return;

    const mobContainer = this.monsters.get(this.selectedMobId);
    if (!mobContainer) {
      this.selectedMobId = null;
      return;
    }

    this.selectionRing!.lineStyle(2, 0xff3333, 0.85);
    // Draw rotating brackets or circle
    const r = 26 + Math.sin(this.time.now * 0.01) * 3;
    this.selectionRing!.strokeCircle(mobContainer.x, mobContainer.y + 10, r);
  }

  // Handle packet events synced from high-frequency server ticks
  private setupSocketHandlers() {
    this.socket.on('initData', (data: {
      selfId: string;
      players: Record<string, PlayerState>;
      monsters: Record<string, Monster>;
    }) => {
      this.selfPlayerId = data.selfId;
      this.syncFullGameState({ players: data.players, monsters: data.monsters });
    });

    this.socket.on('playerMoved', (data: { id: string; x: number; y: number }) => {
      const p = this.players.get(data.id);
      if (p) {
        // Tween to make remote players move fluidly and prevent rubberbanding
        this.tweens.add({
          targets: p,
          x: data.x,
          y: data.y,
          duration: 90,
          ease: 'Linear'
        });
        
        // Face correct orientation
        const crest = p.getData('crest') as Phaser.GameObjects.Graphics;
        const charImg = p.getData('charImage') as Phaser.GameObjects.Image;
        if (p.x !== data.x) {
          const targetScale = data.x < p.x ? -1 : 1;
          if (crest) crest.setScale(targetScale, 1);
          if (charImg) charImg.setScale(targetScale, 1);
        }
      }
    });

    this.socket.on('playerDisconnected', (id: string) => {
      const p = this.players.get(id);
      if (p) {
        this.addSparks(p.x, p.y, 0x888888, 15);
        p.destroy();
        this.players.delete(id);
      }
    });

    this.socket.on('playerStatsUpdated', (pData: PlayerState) => {
      const p = this.players.get(pData.id);
      if (p) {
        p.setData('speed', pData.speed);
        p.setData('hp', pData.hp);
        p.setData('maxHp', pData.maxHp);
        p.setData('level', pData.level);

        // Update Level Tags instantly
        const textObj = p.getData('textTag') as Phaser.GameObjects.Text;
        if (textObj) {
          textObj.setText(`Lv.${pData.level} ${pData.name}`);
        }

        // Update green health bar ratio
        const hpBar = p.getData('hpBar') as Phaser.GameObjects.Graphics;
        if (hpBar) {
          this.redrawMiniHealthBar(hpBar, pData.hp, pData.maxHp);
        }

        // Trigger visual death grayscale if player HP reaches 0
        const crest = p.getData('crest') as Phaser.GameObjects.Graphics;
        const charImg = p.getData('charImage') as Phaser.GameObjects.Image;
        if (pData.hp <= 0) {
          if (crest) crest.setAlpha(0.25);
          if (charImg) charImg.setAlpha(0.25);
        } else {
          if (crest) crest.setAlpha(1);
          if (charImg) charImg.setAlpha(1);
        }

        // Forward state update to ReactHUD
        if (pData.id === this.selfPlayerId) {
          PhaserEventBus.emit('selfStatsUpdated', pData);
        }
      }
    });

    this.socket.on('newPlayer', (pData: PlayerState) => {
      if (!this.players.has(pData.id)) {
        this.spawnPlayerSprite(pData);
      }
    });

    this.socket.on('newMonster', (mob: Monster) => {
      if (!this.monsters.has(mob.id)) {
        this.spawnMonsterSprite(mob);
      }
    });

    this.socket.on('monsterMoved', (data: { id: string; x: number; y: number }) => {
      const mob = this.monsters.get(data.id);
      if (mob) {
        // smooth glide
        this.tweens.add({
          targets: mob,
          x: data.x,
          y: data.y,
          duration: 95,
          ease: 'Linear'
        });
      }
    });

    this.socket.on('monsterDefeated', (mobId: string) => {
      const mob = this.monsters.get(mobId);
      if (mob) {
        this.addSparks(mob.x, mob.y + 10, 0xffa500, 20);
        this.cameras.main.flash(180, 240, 240, 200, false);
        mob.destroy();
        this.monsters.delete(mobId);
        if (this.selectedMobId === mobId) {
          this.selectedMobId = null;
          PhaserEventBus.emit('targetSelected', null);
        }
      }
    });

    this.socket.on('combatFeedback', (data: {
      targetType: 'mob' | 'player';
      targetId: string;
      damage: number;
      hp: number;
      maxHp: number;
      attackerId: string;
    }) => {
      let x = 200, y = 200;
      
      if (data.targetType === 'mob') {
        const mob = this.monsters.get(data.targetId);
        if (mob) {
          x = mob.x;
          y = mob.y;
          const sFactor = mob.getData('scaleFactor') || 1.0;
          const mobHpBar = mob.getData('hpBar') as Phaser.GameObjects.Graphics;
          if (mobHpBar) {
            this.redrawMiniHealthBar(mobHpBar, data.hp, data.maxHp, sFactor);
          }
          this.addSparks(x, y + 10, 0xff5555, 8);
          this.shakeEntity(mob);
        }
      } else {
        const p = this.players.get(data.targetId);
        if (p) {
          x = p.x;
          y = p.y;
          const pHpBar = p.getData('hpBar') as Phaser.GameObjects.Graphics;
          if (pHpBar) {
            this.redrawMiniHealthBar(pHpBar, data.hp, data.maxHp);
          }
          this.addSparks(x, y, 0xff2222, 12);
          this.shakeEntity(p);
          // Red screen flash on player hurt
          if (data.targetId === this.selfPlayerId) {
            this.cameras.main.shake(120, 0.015);
          }
        }
      }

      // Display floating combat damage pop
      this.showDamagePop(x, y - 25, data.damage.toString(), data.targetType === 'player');
    });

    this.socket.on('playerEffect', (data: {
      playerId: string;
      action: 'attack' | 'levelup';
      class?: string;
      level?: number;
      x?: number;
      y?: number;
    }) => {
      const p = this.players.get(data.playerId);
      if (!p) return;

      if (data.action === 'attack') {
        this.renderAttackGraphic(p, data.class || 'WARRIOR');
      } else if (data.action === 'levelup') {
        this.addSparks(p.x, p.y, 0x00ff00, 30);
        // visual halo level flash!
        const circle = this.add.circle(p.x, p.y + 10, 10, 0x00ff00, 0.35);
        this.tweens.add({
          targets: circle,
          scale: 6,
          alpha: 0,
          duration: 900,
          onComplete: () => circle.destroy()
        });
      }
    });

    this.socket.on('killAllMonstersFeedback', () => {
      this.monsters.forEach((c) => {
        this.addSparks(c.x, c.y, 0xffffff, 15);
        c.destroy();
      });
      this.monsters.clear();
      this.selectedMobId = null;
      PhaserEventBus.emit('targetSelected', null);
    });
  }

  // Pre-load procedural generation of 2D art models
  private generateTextureAtlas() {
    // 1. Particle Glow
    const gPart = this.add.graphics({ x: 0, y: 0 });
    gPart.fillStyle(0xffffff, 1);
    gPart.fillCircle(4, 4, 4);
    gPart.generateTexture('dot_particle', 8, 8);
    gPart.destroy();

    // 2. Projectile Fireball
    const gFire = this.add.graphics({ x: 0, y: 0 });
    gFire.fillStyle(0xff7733, 1);
    gFire.fillCircle(8, 8, 8);
    gFire.fillStyle(0xffcc44, 1);
    gFire.fillCircle(8, 8, 4);
    gFire.generateTexture('fireball_proj', 16, 16);
    gFire.destroy();

    // 3. Arrow Art
    const gArrow = this.add.graphics({ x: 0, y: 0 });
    gArrow.lineStyle(2, 0xffffff, 0.95);
    gArrow.lineBetween(0, 4, 12, 4);
    gArrow.fillStyle(0x77dd77, 1);
    gArrow.fillTriangle(12, 4, 8, 1, 8, 7);
    gArrow.generateTexture('arrow_proj', 14, 8);
    gArrow.destroy();
  }

  private createWorldBoundaries() {
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // 1. Draw the high-fidelity immersive medieval fantasy field background
    const bg = this.add.image(this.mapWidth / 2, this.mapHeight / 2, 'aqw_map_bg');
    bg.setDisplaySize(this.mapWidth, this.mapHeight);

    // 2. Add an elegant twilight shade overlay to ensure character outlines remain high contrast
    const shade = this.add.graphics();
    shade.fillStyle(0x0e111a, 0.45); // highly balanced twilight transparency
    shade.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // 3. Grid representation with subtle opacity for spacing intuition
    this.mapGrid = this.add.grid(
      this.mapWidth / 2,
      this.mapHeight / 2,
      this.mapWidth,
      this.mapHeight,
      40,
      40,
      0x2c3540,
      0.15,
      0x1f242c,
      0.2
    );

    // Safe Zone Village boundaries lines
    const zoneLine = this.add.graphics();
    zoneLine.lineStyle(3, 0x00ccff, 0.45);
    zoneLine.strokeRect(30, 30, 350, 350);
    zoneLine.lineStyle(1, 0x00ccff, 0.2);
    zoneLine.strokeRect(20, 20, 370, 370);

    const safeLabel = this.add.text(45, 45, '🛡️ PSALTER VILLAGE [SAFE ZONE]', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '11px',
      color: '#00ccff'
    });
    safeLabel.setAlpha(0.65);
  }

  // Draw actual character models onto Containers
  public spawnPlayerSprite(p: PlayerState) {
    const pContainer = this.add.container(p.pos.x, p.pos.y);
    this.physics.add.existing(pContainer);
    
    const body = pContainer.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(30, 30);
    body.setOffset(-15, -15);

    // 1. Draw elegant crest shield representational frame!
    const crest = this.add.graphics();
    // Shield shadow core
    crest.fillStyle(0x000000, 0.45);
    crest.fillEllipse(0, 16, 26, 7);

    // Shield rim coloring representing class specialty
    const rimColor = p.class === 'VOID_MONARCH' ? 0xd946ef : p.class === 'WARRIOR' ? 0xffd700 : p.class === 'MAGE' ? 0xc084fc : 0x4ade80;
    crest.fillStyle(0x0d1117, 0.9);
    crest.lineStyle(2, rimColor, 1);
    
    // Smooth coat-of-arms bezier shield vector
    crest.beginPath();
    crest.moveTo(-16, -26);
    crest.lineTo(16, -26);
    crest.lineTo(16, -2);
    crest.lineTo(0, 10);
    crest.lineTo(-16, -2);
    crest.closePath();
    crest.fillPath();
    crest.strokePath();
    pContainer.add(crest);

    // Continuous divine celestial void halo animation for Void Monarchs
    if (p.class === 'VOID_MONARCH') {
      const halo = this.add.graphics();
      halo.lineStyle(1.5, 0xd946ef, 0.85);
      halo.strokeCircle(0, 12, 18);
      pContainer.add(halo);
      this.tweens.add({
        targets: halo,
        scale: 1.3,
        alpha: 0.15,
        duration: 950,
        yoyo: true,
        repeat: -1
      });
    }

    // 2. High density character graphic itself!
    const imgKey = p.class === 'WARRIOR' ? 'aqw_warrior' : (p.class === 'MAGE' || p.class === 'VOID_MONARCH') ? 'aqw_mage' : 'aqw_archer';
    const charImage = this.add.image(0, -8, imgKey);
    charImage.setDisplaySize(28, 28);
    pContainer.add(charImage);

    // 3. Mini Health Bar top
    const hpBar = this.add.graphics();
    this.redrawMiniHealthBar(hpBar, p.hp, p.maxHp);
    pContainer.add(hpBar);

    // 4. Player Label Text
    const textColor = p.id === this.selfPlayerId ? '#00e5ff' : '#ffffff';
    const genderSymbol = p.gender === 'F' ? '♀' : '♂';
    const tag = this.add.text(0, -32, `Lv.${p.level} [${genderSymbol}] ${p.name}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: textColor,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    pContainer.add(tag);

    // Cache metadata and direct component references to bypass brittle array index queries
    pContainer.setData('speed', p.speed);
    pContainer.setData('hp', p.hp);
    pContainer.setData('maxHp', p.maxHp);
    pContainer.setData('level', p.level);
    
    pContainer.setData('crest', crest);
    pContainer.setData('charImage', charImage);
    pContainer.setData('hpBar', hpBar);
    pContainer.setData('textTag', tag);

    this.players.set(p.id, pContainer);

    // Spark enter
    this.addSparks(p.pos.x, p.pos.y, 0x00e5ff, 12);

    // Bind camera follow if player is self
    if (p.id === this.selfPlayerId) {
      this.cameras.main.startFollow(pContainer, true, 0.1, 0.1);
    }
  }

  private drawPlayerArtwork(art: Phaser.GameObjects.Graphics, cls: 'WARRIOR' | 'MAGE' | 'ARCHER') {
    // Keep as fallback just in case
  }

  // Draw dynamic monster assets onto map
  private spawnMonsterSprite(mob: Monster) {
    const mobContainer = this.add.container(mob.x, mob.y);
    this.physics.add.existing(mobContainer);
    
    const body = mobContainer.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    
    // Render Boss dragon twice as large for highly epic feel
    const isDragon = mob.type === 'dragon';
    const scaleFactor = isDragon ? 1.8 : 1.0;
    
    body.setSize(30 * scaleFactor, 30 * scaleFactor);
    body.setOffset(-15 * scaleFactor, -15 * scaleFactor);

    // 1. Draw monster badge core
    const crest = this.add.graphics();
    crest.fillStyle(0x000000, 0.45);
    crest.fillEllipse(0, 16 * scaleFactor, 28 * scaleFactor, 8 * scaleFactor);

    let rimColor = 0xffa500;
    let imgKey = 'aqw_slime';
    if (mob.type === 'slime') {
      rimColor = 0x22c55e;
      imgKey = 'aqw_slime';
    } else if (mob.type === 'dragon') {
      rimColor = 0xef4444;
      imgKey = 'aqw_dragon';
    } else if (mob.type === 'orc') {
      rimColor = 0x8b5cf6; // epic purple
    } else if (mob.type === 'goblin') {
      rimColor = 0xb45309; // bronze goblin
    }

    // Shield outline
    crest.fillStyle(0x110c08, 0.95);
    crest.lineStyle(2 * scaleFactor, rimColor, 1);
    
    crest.beginPath();
    crest.moveTo(-18 * scaleFactor, -26 * scaleFactor);
    crest.lineTo(18 * scaleFactor, -26 * scaleFactor);
    crest.lineTo(18 * scaleFactor, -2 * scaleFactor);
    crest.lineTo(0, 11 * scaleFactor);
    crest.lineTo(-18 * scaleFactor, -2 * scaleFactor);
    crest.closePath();
    crest.fillPath();
    crest.strokePath();
    mobContainer.add(crest);

    // 2. Add monster inner visual representation
    let hasLoadedImage = this.textures.exists(imgKey);
    let charImage: Phaser.GameObjects.GameObject | null = null;
    let innerArt: Phaser.GameObjects.Graphics | null = null;
    
    if (hasLoadedImage && (mob.type === 'slime' || mob.type === 'dragon')) {
      const mobImg = this.add.image(0, -8 * scaleFactor, imgKey);
      mobImg.setDisplaySize(30 * scaleFactor, 30 * scaleFactor);
      mobContainer.add(mobImg);
      charImage = mobImg;
    } else {
      innerArt = this.add.graphics();
      this.drawMonsterArtwork(innerArt, mob.type);
      innerArt.setScale(0.8 * scaleFactor);
      innerArt.setY(-10 * scaleFactor);
      mobContainer.add(innerArt);
    }

    // 3. Health bar display
    const hpBar = this.add.graphics();
    this.redrawMiniHealthBar(hpBar, mob.hp, mob.maxHp, scaleFactor);
    mobContainer.add(hpBar);

    // 4. Tag names of beasts
    const labelColor = mob.type === 'dragon' ? '#ff3333' : '#ffb833';
    const tag = this.add.text(0, -34 * scaleFactor, `Lv.${mob.level} ${mob.name}`, {
      fontFamily: 'sans-serif',
      fontSize: isDragon ? '11px' : '9.5px',
      color: labelColor,
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    mobContainer.add(tag);

    // Cache metadata
    mobContainer.setData('scaleFactor', scaleFactor);
    mobContainer.setData('crest', crest);
    if (charImage) mobContainer.setData('charImage', charImage);
    if (innerArt) mobContainer.setData('innerArt', innerArt);
    mobContainer.setData('hpBar', hpBar);
    mobContainer.setData('textTag', tag);

    this.monsters.set(mob.id, mobContainer);
  }

  private drawMonsterArtwork(art: Phaser.GameObjects.Graphics, type: string) {
    art.clear();
    if (type === 'slime') {
      // Forest slime bouncing dome blob
      art.fillStyle(0x48bb78, 0.85); // glowing slimi green
      art.fillCircle(0, 6, 12);
      art.fillRect(-12, 6, 24, 7);
      // Small tiny cute eyes
      art.fillStyle(0xffffff, 1);
      art.fillCircle(-4, 4, 2.5);
      art.fillCircle(4, 4, 2.5);
      art.fillStyle(0x000000, 1);
      art.fillCircle(-4, 4, 1);
      art.fillCircle(4, 4, 1);
    } else if (type === 'goblin') {
      // Nimble light green goblin thieves
      art.fillStyle(0xdd6b20, 1); // orange thief cowl band
      art.fillRect(-8, -4, 16, 6);
      art.fillStyle(0x38a169, 1); // goblin skin tone
      art.fillCircle(0, -2, 8);
      art.fillRect(-8, 5, 16, 12);
      // Rogue ears
      art.fillTriangle(-8, -4, -14, -12, -8, 2);
      art.fillTriangle(8, -4, 14, -12, 8, 2);
    } else if (type === 'orc') {
      // Gray bulky fierce Orc soldiers
      art.fillStyle(0x4a5568, 1); // grey plate iron armor
      art.fillRect(-13, 1, 26, 19);
      art.fillStyle(0x1a202c, 1); // deep tusk mask
      art.fillRect(-10, -8, 20, 9);
      // Bulky red war paint horns
      art.fillStyle(0xe53e3e, 1);
      art.fillTriangle(-11, -8, -13, -17, -7, -8);
      art.fillTriangle(11, -8, 13, -17, 7, -8);
    } else if (type === 'dragon') {
      // Giant crimson red flying Boss Dragon
      art.fillStyle(0xc53030, 1); // Crimson thick head carapace
      art.fillCircle(0, -10, 24);
      art.fillRect(-22, -10, 44, 35);
      // Glowing flame horn spikes
      art.fillStyle(0xed8936, 1);
      art.fillTriangle(-18, -25, -24, -45, -10, -25);
      art.fillTriangle(18, -25, 24, -45, 10, -25);
      // Yellow glowing reptilian dragon eyes
      art.fillStyle(0xfff5f5, 1);
      art.fillTriangle(-13, -12, -4, -12, -8, -16);
      art.fillTriangle(13, -12, 4, -12, 8, -16);
      art.fillStyle(0x000000, 1);
      art.fillRect(-9, -14, 2, 2);
      art.fillRect(7, -14, 2, 2);
    }
  }

  // Draw life ratios cleanly
  private redrawMiniHealthBar(g: Phaser.GameObjects.Graphics, hp: number, max: number, scaleFactor: number = 1.0) {
    g.clear();
    
    // Background frame
    const width = 32 * scaleFactor;
    const height = 4 * scaleFactor;
    const x = -width / 2;
    const y = -24 * scaleFactor;

    g.fillStyle(0x111111, 0.7);
    g.fillRect(x, y, width, height);

    // Green filling indicator
    const ratio = Math.max(0, Math.min(1, hp / max));
    const hitColor = ratio > 0.4 ? 0x22c55e : ratio > 0.15 ? 0xeab308 : 0xef4444;

    g.fillStyle(hitColor, 1);
    g.fillRect(x, y, Math.floor(width * ratio), height);
  }

  // Action visualizations
  private renderAttackGraphic(p: Phaser.GameObjects.Container, cls: string) {
    if (cls === 'WARRIOR') {
      // Sword slash swoop arc
      const arc = this.add.graphics({ x: p.x, y: p.y });
      arc.lineStyle(4, 0xffeb3b, 0.95);
      arc.arc(0, 5, 25, -Math.PI/4, Math.PI + Math.PI/4, false);
      this.tweens.add({
        targets: arc,
        alpha: 0,
        scale: 1.35,
        duration: 210,
        onComplete: () => arc.destroy()
      });
    } else if (cls === 'MAGE') {
      // Launch procedural fireball projectile shooting forward
      const fBall = this.add.sprite(p.x, p.y - 5, 'fireball_proj');
      fBall.setScale(0.1);
      
      this.physics.add.existing(fBall);
      // Fly towards target or random right side
      const targetX = this.selectedMobId ? this.monsters.get(this.selectedMobId)?.x || p.x + 100 : p.x + 100;
      const targetY = this.selectedMobId ? this.monsters.get(this.selectedMobId)?.y || p.y : p.y;

      this.tweens.add({
        targets: fBall,
        x: targetX,
        y: targetY,
        scale: 1.25,
        duration: 350,
        ease: 'Cubic.out',
        onComplete: () => {
          this.addSparks(targetX, targetY, 0xffa500, 10);
          fBall.destroy();
        }
      });
    } else if (cls === 'ARCHER') {
      // Quick flying physical arrow
      const arrowPoint = this.add.sprite(p.x, p.y + 4, 'arrow_proj');
      
      const targetX = this.selectedMobId ? this.monsters.get(this.selectedMobId)?.x || p.x + 100 : p.x + 100;
      const targetY = this.selectedMobId ? this.monsters.get(this.selectedMobId)?.y || p.y : p.y;
      
      const angle = Phaser.Math.Angle.Between(p.x, p.y, targetX, targetY);
      arrowPoint.setRotation(angle);

      this.tweens.add({
        targets: arrowPoint,
        x: targetX,
        y: targetY,
        duration: 280,
        onComplete: () => {
          this.addSparks(targetX, targetY, 0xdd6b20, 5);
          arrowPoint.destroy();
        }
      });
    } else if (cls === 'VOID_MONARCH') {
      // Cosmic void singularity vortex pull
      const vortex = this.add.graphics({ x: p.x, y: p.y });
      vortex.fillStyle(0x030008, 0.95);
      vortex.lineStyle(2, 0xd946ef, 1);
      vortex.fillCircle(0, 5, 20);
      vortex.strokeCircle(0, 5, 20);
      vortex.strokeCircle(0, 5, 35);
      
      this.tweens.add({
        targets: vortex,
        rotation: Math.PI * 4,
        scale: 2.2,
        alpha: 0,
        duration: 385,
        ease: 'Quad.easeOut',
        onComplete: () => vortex.destroy()
      });
      this.addSparks(p.x, p.y, 0xd946ef, 24);
    }
  }

  private showDamagePop(x: number, y: number, text: string, isSelfHurt: boolean) {
    const color = isSelfHurt ? '#ef4444' : '#ffd54f';
    const size = isSelfHurt ? '14px' : '12px';
    const pop = this.add.text(x, y, text, {
      fontFamily: 'Inter, monospace',
      fontSize: size,
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Rise up and fade
    this.tweens.add({
      targets: pop,
      y: y - 40,
      alpha: 0,
      scale: 1.4,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => pop.destroy()
    });
  }

  private addSparks(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const sp = this.add.image(x, y, 'dot_particle');
      sp.setTint(color);
      sp.setScale(0.5 + Math.random() * 0.8);

      const vx = (Math.random() - 0.5) * 140;
      const vy = (Math.random() - 0.5) * 140;

      this.physics.add.existing(sp);
      const b = sp.body as Phaser.Physics.Arcade.Body;
      b.setVelocity(vx, vy);

      this.tweens.add({
        targets: sp,
        alpha: 0,
        scale: 0.1,
        duration: 400 + Math.random() * 400,
        onComplete: () => sp.destroy()
      });
    }
  }

  private shakeEntity(container: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: container,
      x: container.x + 5,
      yoyo: true,
      repeat: 2,
      duration: 40
    });
  }

  public syncFullGameState(data: { players: Record<string, PlayerState>; monsters: Record<string, Monster> }) {
    // Players setup
    Object.keys(data.players).forEach(id => {
      const pData = data.players[id];
      if (!this.players.has(id)) {
        this.spawnPlayerSprite(pData);
      }
    });

    // Clean departed
    this.players.forEach((c, id) => {
      if (!data.players[id]) {
        this.addSparks(c.x, c.y, 0x888888, 10);
        c.destroy();
        this.players.delete(id);
      }
    });

    // Mobs setup
    Object.keys(data.monsters).forEach(id => {
      const mob = data.monsters[id];
      if (!this.monsters.has(id)) {
        this.spawnMonsterSprite(mob);
      } else {
        const mobC = this.monsters.get(id);
        if (mobC) {
          const sFactor = mobC.getData('scaleFactor') || 1.0;
          const mobHpBar = mobC.getData('hpBar') as Phaser.GameObjects.Graphics;
          if (mobHpBar) {
            this.redrawMiniHealthBar(mobHpBar, mob.hp, mob.maxHp, sFactor);
          }
        }
      }
    });

    // Clean slain mobs
    this.monsters.forEach((c, id) => {
      if (!data.monsters[id]) {
        c.destroy();
        this.monsters.delete(id);
      }
    });
  }
}

function Physics_Arc_To_Rads(degrees: number): number {
  return degrees * (Math.PI / 180);
}
