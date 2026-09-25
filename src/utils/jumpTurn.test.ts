import { describe, expect, it } from 'vitest';
import {
  AvatarAnimationController,
  SPRITE_SPECS,
  TARGET_CONTENT_H,
  TURN_DURATION,
  TURN_START_COL,
  TURN_END_COL,
  getRenderPose,
  renderScale,
  turnProgressToColumn,
} from './jumpTurn';

describe('turnProgressToColumn', () => {
  it('maps progress 0 to column 2 (left 3/4 view)', () => {
    expect(turnProgressToColumn(0)).toBe(TURN_START_COL); // 2
  });

  it('maps progress 1 to column 6 (right 3/4 view)', () => {
    expect(turnProgressToColumn(1)).toBe(TURN_END_COL); // 6
  });

  it('maps progress 0.5 to column 4 (front view)', () => {
    expect(turnProgressToColumn(0.5)).toBe(4);
  });

  it('progresses smoothly through 2 -> 3 -> 4 -> 5 -> 6', () => {
    const cols = [0, 0.25, 0.5, 0.75, 1.0].map(turnProgressToColumn);
    expect(cols).toEqual([2, 3, 4, 5, 6]);
  });
});

describe('renderScale — one on-screen size for every sheet', () => {
  // Deliberate tripwire: these are the *measured* standing heights of the
  // shipped art. The walk sheet is drawn smaller than the jump/turn art, so it
  // is scaled up; it previously made the character look undersized on idle and
  // suddenly "grow" on takeoff. If the art is replaced, re-measure here.
  it('records the measured standing heights', () => {
    expect(SPRITE_SPECS.walk.contentH).toBe(124);
    expect(SPRITE_SPECS.jump.contentH).toBe(155);
    expect(SPRITE_SPECS.turn.contentH).toBe(155);
    expect(SPRITE_SPECS.airTurn.contentH).toBe(155);
  });

  it('scales the smaller walk art up and leaves the jump/turn art at native', () => {
    expect(renderScale(SPRITE_SPECS.walk)).toBeCloseTo(1.25, 5);
    expect(renderScale(SPRITE_SPECS.jump)).toBe(1);
    expect(renderScale(SPRITE_SPECS.turn)).toBe(1);
    expect(renderScale(SPRITE_SPECS.airTurn)).toBe(1);
  });

  it('lands every sheet at the same on-screen standing height', () => {
    for (const key of Object.keys(SPRITE_SPECS) as Array<keyof typeof SPRITE_SPECS>) {
      const spec = SPRITE_SPECS[key];
      const pose = getRenderPose(key, 0, 0, 72);
      // The standing character occupies contentH/h of the cell, so its rendered
      // height is the cell height times that fraction.
      const standingOnScreen = pose.height * (spec.contentH / spec.h);
      expect(standingOnScreen).toBeCloseTo(TARGET_CONTENT_H, 5);
    }
  });
});

describe('getRenderPose alignment and anchors', () => {
  it('calculates proper offsets for walk sheet, scaled to the shared size', () => {
    const spec = SPRITE_SPECS.walk;
    const scale = renderScale(spec);
    const pose = getRenderPose('walk', 0, 0, 72);
    // ax: 44, actorW: 72, scale 1.25 -> offsetX = 36 - 55 = -19
    expect(pose.offsetX).toBe(72 / 2 - spec.ax * scale);
    // fy: 164, h: 170, scale 1.25 -> offsetY = -(6) * 1.25 = -7.5
    expect(pose.offsetY).toBe(-(spec.h - spec.fy) * scale);
    expect(pose.width).toBe(spec.w * scale);
    expect(pose.height).toBe(spec.h * scale);
    expect(pose.backgroundPosition).toBe('0px 0px');
  });

  it('calculates proper offsets for jump sheet', () => {
    const spec = SPRITE_SPECS.jump;
    const scale = renderScale(spec);
    const pose = getRenderPose('jump', 4, 0, 72);
    // ax: 72, actorW: 72 -> offsetX = 36 - 72 = -36
    expect(pose.offsetX).toBe(72 / 2 - spec.ax * scale);
    // fy: 202, h: 208 -> offsetY = -(208 - 202) = -6
    expect(pose.offsetY).toBe(-(spec.h - spec.fy) * scale);
    expect(pose.backgroundPosition).toBe(`${-4 * spec.w * scale}px 0px`);
    // The whole sheet has to be mapped to the cell grid for the offsets to line up.
    expect(pose.backgroundSize).toBe(
      `${spec.w * scale * spec.cols}px ${spec.h * scale * spec.rows}px`,
    );
  });

  it('calculates proper offsets for turn sheet', () => {
    const spec = SPRITE_SPECS.turn;
    const scale = renderScale(spec);
    const pose = getRenderPose('turn', 4, 0, 72);
    // ax: 56, actorW: 72 -> offsetX = 36 - 56 = -20
    expect(pose.offsetX).toBe(72 / 2 - spec.ax * scale);
    // fy: 164, h: 170 -> offsetY = -(170 - 164) = -6
    expect(pose.offsetY).toBe(-(spec.h - spec.fy) * scale);
  });

  it('rests every sheet’s feet on the actor box bottom', () => {
    for (const key of Object.keys(SPRITE_SPECS) as Array<keyof typeof SPRITE_SPECS>) {
      const spec = SPRITE_SPECS[key];
      const scale = renderScale(spec);
      const pose = getRenderPose(key, 0, 0, 72);
      // offsetY places the cell so its foot baseline (fy from the cell top)
      // lands on the box bottom; the only overhang is the art below the feet.
      expect(-pose.offsetY).toBeCloseTo((spec.h - spec.fy) * scale, 5);
      expect(-pose.offsetY).toBeLessThanOrEqual(8);
    }
  });
});

describe('AvatarAnimationController', () => {
  it('initializes facing right', () => {
    const ctrl = new AvatarAnimationController();
    expect(ctrl.facingDir).toBe(1);
    expect(ctrl.turnState.isTurning).toBe(false);
  });

  it('turns right to left over duration', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.requestDirection(-1);
    expect(ctrl.turnState.isTurning).toBe(true);
    expect(ctrl.turnState.targetDir).toBe(-1);

    // Halfway through turn
    ctrl.update(TURN_DURATION / 2);
    expect(ctrl.turnState.isTurning).toBe(true);
    const midPose = ctrl.getCurrentPose({ walking: false, walkFrame: 0 });
    expect(midPose.sheet).toBe('turn');
    expect(midPose.column).toBe(4); // Facing viewer

    // Complete turn
    ctrl.update(TURN_DURATION / 2 + 0.01);
    expect(ctrl.turnState.isTurning).toBe(false);
    expect(ctrl.facingDir).toBe(-1);
    const endPose = ctrl.getCurrentPose({ walking: false, walkFrame: 0 });
    expect(endPose.sheet).toBe('walk');
    expect(endPose.row).toBe(1); // Left-facing row
  });

  it('reverses mid-turn without restarting', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.requestDirection(-1);
    // Advance to 60% toward left
    ctrl.update(TURN_DURATION * 0.4);
    const progressBeforeReverse = ctrl.turnState.progress;

    // Player reverses back to right
    ctrl.requestDirection(1);
    expect(ctrl.turnState.targetDir).toBe(1);
    // Starts exactly from where it was
    expect(ctrl.turnState.progress).toBeCloseTo(progressBeforeReverse, 3);

    // Advance to complete turn back to right
    ctrl.update(TURN_DURATION * 0.5);
    expect(ctrl.turnState.progress).toBeGreaterThan(progressBeforeReverse);
  });

  it('does not restart turn when holding the same direction key', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.requestDirection(-1);
    ctrl.update(0.1);
    const p1 = ctrl.turnState.progress;

    // Repeated call while holding key
    ctrl.requestDirection(-1);
    expect(ctrl.turnState.progress).toBe(p1);
  });

  it('uses air-turn frames while airborne', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.startJump();
    ctrl.mode = 'air'; // In the air

    ctrl.requestDirection(-1);
    ctrl.update(TURN_DURATION / 2);

    const pose = ctrl.getCurrentPose({ walking: false, walkFrame: 0 });
    expect(pose.sheet).toBe('airTurn');
    expect(pose.column).toBe(4); // Center tucked-knee frame
  });

  it('renders left-walking and left-idle frames within sheet column boundaries', () => {
    const ctrl = new AvatarAnimationController({ facingDir: -1 });
    // Left-idle (frame 9 in WALK_SHEET) should map to column 0 row 1
    const idlePose = ctrl.getCurrentPose({ walking: false, walkFrame: 9 });
    expect(idlePose.sheet).toBe('walk');
    expect(idlePose.row).toBe(1);
    expect(idlePose.column).toBe(0);
    // Walk cell is 170px tall, scaled by 1.25 -> row 1 sits 212.5px up the sheet.
    expect(idlePose.backgroundPosition).toBe('0px -212.5px');

    // Left-walk-01 (frame 10 in WALK_SHEET) should map to column 1 row 1
    const walkPose = ctrl.getCurrentPose({ walking: true, walkFrame: 10 });
    expect(walkPose.sheet).toBe('walk');
    expect(walkPose.row).toBe(1);
    expect(walkPose.column).toBe(1);
    // Column 1 of an 88px cell at 1.25 scale -> 110px.
    expect(walkPose.backgroundPosition).toBe('-110px -212.5px');
  });

  it('swaps instantly with reduced motion', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1, reducedMotion: true });
    ctrl.requestDirection(-1);
    expect(ctrl.turnState.isTurning).toBe(false);
    expect(ctrl.facingDir).toBe(-1);
  });
});
