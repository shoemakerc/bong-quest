import Phaser from 'phaser';
import { PHYSICS, TEXTURES } from '../constants';
import { POWERS, type PowerId } from '../powers';

interface Controls {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[];
  dash: Phaser.Input.Keyboard.Key[];
}

/** Events the player emits so the scene can react (sound, effects). */
export type PlayerEvent = 'jump' | 'airJump' | 'wallJump' | 'dash';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly powers = new Set<PowerId>();

  private controls: Controls;
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  private airJumpsLeft = 0;

  private canDash = false;
  private dashEndsAt = -Infinity;
  private dashDir = 1;
  private lastTrailAt = 0;

  /** -1 = wall on the left, 1 = wall on the right. */
  private wallDir = 0;
  private lastWallAt = -Infinity;
  private inputLockedUntil = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setMaxVelocityY(PHYSICS.maxFallSpeed);
    this.body.setMaxVelocityX(PHYSICS.runSpeed);

    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.controls = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.UP), kb.addKey(K.W), kb.addKey(K.SPACE)],
      dash: [kb.addKey(K.SHIFT), kb.addKey(K.X)],
    };
  }

  get isDashing() {
    return this.scene.time.now < this.dashEndsAt;
  }

  grantPower(id: PowerId) {
    this.powers.add(id);
  }

  respawn(x: number, y: number) {
    // body.reset (not setPosition) also clears the body's previous position and
    // velocity; otherwise the teleport looks like a huge move and collisions misfire.
    this.body.reset(x, y);
    this.body.setAcceleration(0, 0);
    this.body.setAllowGravity(true);
    this.dashEndsAt = -Infinity;
    this.inputLockedUntil = -Infinity;
    this.lastGroundedAt = -Infinity;
    this.lastWallAt = -Infinity;
    this.jumpPressedAt = -Infinity;
    this.setScale(1);
  }

  update(time: number) {
    const c = this.controls;
    const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
    const pressed = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const released = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => Phaser.Input.Keyboard.JustUp(k));

    const jumpPressed = pressed(c.jump);
    const jumpReleased = released(c.jump);
    const dashPressed = pressed(c.dash);
    const onGround = this.body.blocked.down;
    const dir = (down(c.right) ? 1 : 0) - (down(c.left) ? 1 : 0);

    if (onGround) {
      this.lastGroundedAt = time;
      this.refillAirMoves();
    }

    // Wall contact: touching a wall in the air allows a wall jump; holding toward it also slides.
    const hasWallJump = this.powers.has('wallJump');
    const wallSide = this.body.blocked.left ? -1 : this.body.blocked.right ? 1 : 0;
    const touchingWall = hasWallJump && !onGround && wallSide !== 0;
    const onWall = touchingWall && dir === wallSide;
    if (touchingWall) {
      this.wallDir = wallSide;
      this.lastWallAt = time;
      this.refillAirMoves();
    }

    // Dash overrides everything else while it lasts.
    if (dashPressed && this.canDash && !this.isDashing) this.startDash(time, dir);
    if (this.isDashing) {
      this.body.setVelocity(this.dashDir * PHYSICS.dashSpeed, 0);
      if (time - this.lastTrailAt > 30) this.spawnTrail(time);
      return;
    }
    if (!this.body.allowGravity) this.endDash();

    // Horizontal movement (ignored briefly after a wall jump).
    const locked = time < this.inputLockedUntil;
    this.body.setAccelerationX(locked ? 0 : dir * PHYSICS.acceleration);
    this.body.setDragX(locked ? 0 : PHYSICS.drag);
    if (!locked && dir !== 0) this.setFlipX(dir < 0);

    // Jumping, in priority order: ground (incl. coyote time) → wall → air jump.
    if (jumpPressed) this.jumpPressedAt = time;
    const buffered = time - this.jumpPressedAt <= PHYSICS.jumpBufferMs;
    const canCoyote = time - this.lastGroundedAt <= PHYSICS.coyoteMs;
    const canWallJump = hasWallJump && !onGround && time - this.lastWallAt <= PHYSICS.wallCoyoteMs;

    if (buffered && canCoyote) {
      this.jump('jump');
      this.lastGroundedAt = -Infinity; // consume coyote window
    } else if (jumpPressed && canWallJump) {
      this.wallJump(time);
    } else if (jumpPressed && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.jump('airJump');
    }

    // Variable jump height: letting go early cuts the rise short.
    if (jumpReleased && !down(c.jump) && this.body.velocity.y < 0) {
      this.body.velocity.y *= PHYSICS.jumpCutoff;
    }

    // Wall slide and glide both cap fall speed.
    const vy = this.body.velocity.y;
    const gliding = this.powers.has('glide') && !onGround && !onWall && down(c.jump) && vy > PHYSICS.glideFallSpeed;
    if (onWall && vy > PHYSICS.wallSlideSpeed) this.body.setVelocityY(PHYSICS.wallSlideSpeed);
    if (gliding) this.body.setVelocityY(PHYSICS.glideFallSpeed);
    this.setScale(gliding ? 1.25 : 1, gliding ? 0.85 : 1);
    if (onWall) this.setFlipX(this.wallDir > 0);
  }

  private refillAirMoves() {
    this.airJumpsLeft = this.powers.has('doubleJump') ? 1 : 0;
    this.canDash = this.powers.has('dash');
  }

  private jump(kind: 'jump' | 'airJump') {
    this.body.setVelocityY(-PHYSICS.jumpVelocity);
    this.jumpPressedAt = -Infinity;
    this.emit(kind);
  }

  private wallJump(time: number) {
    this.body.setVelocity(-this.wallDir * PHYSICS.wallJumpX, -PHYSICS.wallJumpY);
    this.setFlipX(this.wallDir > 0);
    this.inputLockedUntil = time + PHYSICS.wallJumpLockMs;
    this.lastWallAt = -Infinity;
    this.jumpPressedAt = -Infinity;
    this.emit('wallJump');
  }

  private startDash(time: number, dir: number) {
    this.canDash = false;
    this.dashDir = dir !== 0 ? dir : this.flipX ? -1 : 1;
    this.setFlipX(this.dashDir < 0);
    this.dashEndsAt = time + PHYSICS.dashMs;
    this.inputLockedUntil = -Infinity;
    this.body.setAllowGravity(false);
    this.body.setAcceleration(0, 0);
    this.body.setMaxVelocityX(PHYSICS.dashSpeed);
    this.setScale(1);
    this.emit('dash');
  }

  private endDash() {
    this.body.setAllowGravity(true);
    this.body.setMaxVelocityX(PHYSICS.runSpeed);
    this.body.setVelocityX(this.dashDir * PHYSICS.runSpeed);
  }

  private spawnTrail(time: number) {
    this.lastTrailAt = time;
    const ghost = this.scene.add
      .image(this.x, this.y, TEXTURES.player)
      .setFlipX(this.flipX)
      .setTint(POWERS.dash.color)
      .setAlpha(0.5)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }
}
