import { describe, expect, it } from 'vitest';
import {
  AvatarAnimationController,
  JUMP_TIMINGS,
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

const SHEET_KEYS = Object.keys(SPRITE_SPECS) as Array<keyof typeof SPRITE_SPECS>;

describe('renderScale — one on-screen size for every sheet', () => {
  // Deliberate tripwire: these are the *measured* standing heights of the
  // shipped art plus the height the renderer normalises them to. The walk sheet
  // is drawn smaller than the jump/turn art, so it is scaled up — without this
  // the character looked undersized on idle and then "grew" on takeoff. If the
  // art or the target changes, re-measure and update here.
  it('records the measured standing heights and the shared target', () => {
    expect(TARGET_CONTENT_H).toBe(240);
    // The 240px pack is drawn at scale 1.0: every sheet's standing character is
    // exactly TARGET_CONTENT_H tall in its own sheet pixels.
    expect(SPRITE_SPECS.walk.contentH).toBe(240);
    expect(SPRITE_SPECS.jump.contentH).toBe(240);
    expect(SPRITE_SPECS.turn.contentH).toBe(240);
    expect(SPRITE_SPECS.airTurn.contentH).toBe(240);
  });

  it('scales each sheet by the target over its measured height', () => {
    for (const key of SHEET_KEYS) {
      const spec = SPRITE_SPECS[key];
      expect(renderScale(spec)).toBeCloseTo(TARGET_CONTENT_H / spec.contentH, 6);
    }
  });

  it('renders the native pack at scale 1.0, uniformly across sheets', () => {
    for (const key of SHEET_KEYS) {
      expect(renderScale(SPRITE_SPECS[key])).toBe(1);
    }
  });

  it('matches the metadata the 240px pack ships', () => {
    // Deliberate tripwire tied to arshad-sprites-240px/assets/animations.json.
    // If the pack changes, update these numbers from its metadata.
    expect(SPRITE_SPECS.walk).toMatchObject({ w: 172, h: 330, ax: 86, fy: 318 });
    expect(SPRITE_SPECS.jump).toMatchObject({ w: 224, h: 330, ax: 112, fy: 318 });
    expect(SPRITE_SPECS.turn).toMatchObject({ w: 176, h: 330, ax: 88, fy: 318 });
    expect(SPRITE_SPECS.airTurn).toMatchObject({ w: 224, h: 330, ax: 112, fy: 318 });
  });

  it('lands every sheet at the same on-screen standing height', () => {
    for (const key of SHEET_KEYS) {
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
    // Centred on the actor box, one scaled anchor in from the left edge.
    expect(pose.offsetX).toBe(72 / 2 - spec.ax * scale);
    // The 6px of art below the feet scales with the sheet.
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
      // ...and that overhang stays the pack's 12px transparent foot padding.
      expect(-pose.offsetY).toBe(12);
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
    expect(endPose.row).toBe(1); // left-facing row (baked mirror art)
    expect(endPose.flip).toBe(false);
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

  it('renders left-facing poses from the baked left row (no runtime flip)', () => {
    // The sheet's left row is a baked mirror of the right art (stride-identical,
    // stride-first ordering), so facing selects the row and no flip flag is set.
    const ctrl = new AvatarAnimationController({ facingDir: -1 });

    const idlePose = ctrl.getCurrentPose({ walking: false, walkFrame: 9 });
    expect(idlePose.sheet).toBe('walk');
    expect(idlePose.row).toBe(1);
    expect(idlePose.flip).toBe(false);
    expect(idlePose.backgroundPosition).toBe('0px -330px'); // row 1, col 0

    const walkPose = ctrl.getCurrentPose({ walking: true, walkFrame: 10 });
    expect(walkPose.sheet).toBe('walk');
    expect(walkPose.row).toBe(1);
    expect(walkPose.flip).toBe(false);
    // frame 10 is index 1 of the left walk group -> sheet column 1
    expect(walkPose.column).toBe(1);
    expect(walkPose.backgroundPosition).toBe('-172px -330px');
  });

  it('never flips any pose', () => {
    // Baked art removed the need for runtime mirroring; the flag stays in the
    // pose contract but must be false everywhere.
    const ctrl = new AvatarAnimationController({ facingDir: -1 });
    for (const wf of [0, 1, 5, 9, 12]) {
      expect(ctrl.getCurrentPose({ walking: true, walkFrame: wf }).flip).toBe(false);
      expect(ctrl.getCurrentPose({ walking: false, walkFrame: wf }).flip).toBe(false);
    }
  });

  it('relaunches a held jump from landing and recovery, but not mid-air', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });

    // Mid-air relaunch is still refused (no double jumps).
    ctrl.startJump();
    ctrl.mode = 'air';
    expect(ctrl.startJump()).toBe(false);

    // Landing: the body is grounded again while the controller still plays the
    // landing pose — a held jump must relaunch from here, or the first stretch
    // of the next bounce renders stiff standing frames.
    ctrl.mode = 'landing';
    expect(ctrl.startJump({ immediate: true })).toBe(true);
    expect(ctrl.mode).toBe('air');
    expect(ctrl.seededAir).toBe(true);

    ctrl.mode = 'recovery';
    expect(ctrl.startJump({ immediate: true })).toBe(true);
    expect(ctrl.mode).toBe('air');
  });

  it('immediate bounces drive poses from the seeded clock, ignoring physics progress', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.startJump({ immediate: true });
    expect(ctrl.seededAir).toBe(true);

    // Right after seeding, the arc is in RISING even though the physics vy is
    // at full launch (which alone would read TAKEOFF).
    const rising = ctrl.getCurrentPose({ walking: false, walkFrame: 0, jumpProgress: 0 });
    expect(rising.sheet).toBe('jump');
    expect(rising.column).toBe(3); // RISING

    // As the seeded clock advances, the loop walks apex -> falling -> pre-landing.
    // (+0.3s => p=0.55, inside the 0.38..0.62 APEX band.)
    ctrl.update(JUMP_TIMINGS.AIRTIME * 0.3);
    const apex = ctrl.getCurrentPose({ walking: false, walkFrame: 0, jumpProgress: 0 });
    expect(apex.column).toBe(4); // APEX

    ctrl.update(JUMP_TIMINGS.AIRTIME * 0.3);
    const falling = ctrl.getCurrentPose({ walking: false, walkFrame: 0, jumpProgress: 0 });
    expect(falling.column).toBe(5); // FALLING

    ctrl.update(JUMP_TIMINGS.AIRTIME * 0.15);
    const preLanding = ctrl.getCurrentPose({ walking: false, walkFrame: 0, jumpProgress: 0 });
    expect(preLanding.column).toBe(6); // PRE_LANDING
  });

  it('clears the seeded-air flag when the controller returns to ground', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1 });
    ctrl.startJump({ immediate: true });
    expect(ctrl.seededAir).toBe(true);
    ctrl.mode = 'ground';
    ctrl.update(0.016);
    expect(ctrl.seededAir).toBe(false);
    // and a fresh (non-immediate) jump keeps physics-driven poses. The fresh
    // jump enters ANTICIPATION first (120ms of crouch), so at p=0.02 of air
    // progress the controller has not yet reached the air phase — but if it
    // did, the pose must come from physics, not a stale seeded clock.
    expect(ctrl.startJump()).toBe(true);
    expect(ctrl.mode).toBe('anticipation');
    ctrl.mode = 'air'; // simulate the anticipation->air handoff for the pose check
    ctrl.seededAir = false;
    const takeoff = ctrl.getCurrentPose({ walking: false, walkFrame: 0, jumpProgress: 0.02 });
    expect(takeoff.column).toBe(2); // TAKEOFF, from physics progress
  });

  it('swaps instantly with reduced motion', () => {
    const ctrl = new AvatarAnimationController({ facingDir: 1, reducedMotion: true });
    ctrl.requestDirection(-1);
    expect(ctrl.turnState.isTurning).toBe(false);
    expect(ctrl.facingDir).toBe(-1);
  });
});
