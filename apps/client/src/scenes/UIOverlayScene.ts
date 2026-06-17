import Phaser from 'phaser';

export class UIOverlayScene extends Phaser.Scene {
  constructor() {
    super('UIOverlayScene');
  }

  create() {
    console.log('👑 UIOverlayScene loaded. Monitoring DOM/HTML overlays.');
  }
}
