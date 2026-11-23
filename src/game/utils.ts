import type Phaser from 'phaser';
import { EventBus } from './EventBus';

export function startScene(scene: Phaser.Scene, key: string, data?: object) {
  scene.scene.start(key, data);
  EventBus.emit('scene-changed', { key, data });
}