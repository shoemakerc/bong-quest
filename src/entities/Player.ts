import Phaser from 'phaser';
import { PHYSICS, TEXTURES } from '../constants';
import type { PowerId } from '../powers';

interface Controls {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[];
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly powers = new Set<PowerId>();

  private controls: Controls;
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  private airJumpsLeft = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(false);
    this.body.setMaxVelocityY(PHYSICS.maxFallSpeed);
    this.body.setDragX(PHYSICS.drag);
    this.body.setMaxVelocityX(PHYSICS.runSpeed);

    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.controls = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.UP), kb.addKey(K.W), kb.addKey(K.SPACE)],
    };
  }

  grantPower(id: PowerId) {
    this.powers.add(id);
  }

  respawn(x: number, y: number) {
    // body.reset (not setPosition) also clears the body's previous position and
    // velocity; otherwise the teleport looks like a huge move and collisions misfire.
    this.body.reset(x, y);
    this.body.setAcceleration(0, 0);
    this.lastGroundedAt = -Infinity;
    this.jumpPressedAt = -Infinity;
  }

  update(time: number) {
    const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
    const justDown = this.controls.jump.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const onGround = this.body.blocked.down;

    // Horizontal: accelerate while held, drag stops us when released.
    const dir = (down(this.controls.right) ? 1 : 0) - (down(this.controls.left) ? 1 : 0);
    this.body.setAccelerationX(dir * PHYSICS.acceleration);
    if (dir !== 0) this.setFlipX(dir < 0);

    if (onGround) {
      this.lastGroundedAt = time;
      this.airJumpsLeft = this.powers.has('doubleJump') ? 1 : 0;
    }
    if (justDown) this.jumpPressedAt = time;

    const buffered = time - this.jumpPressedAt <= PHYSICS.jumpBufferMs;
    const canCoyote = time - this.lastGroundedAt <= PHYSICS.coyoteMs;

    if (buffered && canCoyote) {
      this.jump();
      this.lastGroundedAt = -Infinity; // consume coyote window
    } else if (justDown && !canCoyote && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.jump();
    }

    // Variable jump height: letting go early cuts the rise short.
    const released = this.controls.jump.some((k) => Phaser.Input.Keyboard.JustUp(k));
    if (released && !down(this.controls.jump) && this.body.velocity.y < 0) {
      this.body.velocity.y *= PHYSICS.jumpCutoff;
    }
  }

  private jump() {
    this.body.setVelocityY(-PHYSICS.jumpVelocity);
    this.jumpPressedAt = -Infinity;
  }
}
