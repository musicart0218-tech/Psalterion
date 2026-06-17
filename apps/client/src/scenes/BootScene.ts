import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // For local alpha configurations, build simple colorful canvas fallback textures
    // if physical image files are missing in your workspace.
    const canvas = this.textures.createCanvas('player_fallback', 32, 32);
    if (canvas) {
      const ctx = canvas.context;
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.fillText('HERO', 2, 20);
      canvas.refresh();
    }
  }

  create() {
    console.log('📦 Core assets cached. Initializing World Render Link...');
    this.scene.start('WorldScene');
  }
}
