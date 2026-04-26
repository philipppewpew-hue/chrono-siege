import * as Phaser from 'phaser';
import { generateAssets } from '../utils/AssetGenerator';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Loading text
    const loadText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Generating assets...', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ccddff',
    }).setOrigin(0.5);

    // Generate all procedural assets
    this.time.delayedCall(50, () => {
      generateAssets(this);
      loadText.setText('Ready!');

      this.time.delayedCall(200, () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
