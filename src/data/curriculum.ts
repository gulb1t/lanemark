import type { LevelDef, ProgramId, Skill } from '../types.ts'
import { MUST_SEES } from './mustSees.ts'

/**
 * Preset levels for the Lifesaving Society Swim for Life program.
 *
 * Sources:
 *  - Lifesaving Society Swim for Life At-a-Glance guides (Preschool, Swimmer, Adult): official skills and distances.
 *  - Swim Patrol distances follow the Lifesaving Society program overview.
 * Paired items (e.g. "Float on front" / "Float on back") are kept as separate skills so each can be
 * marked and commented on individually. Everything here is a preset: classes get their own editable copy.
 */

/** Programme colours are CSS variables (see index.css) so each theme can use a shade with enough contrast. */
export const PROGRAMS: Record<ProgramId, { label: string; hue: string; blurb: string }> = {
  'parent-tot': { label: 'Parent & Tot', hue: 'var(--p-parent-tot)', blurb: 'Play-based, parent in the water. Registration is by age.' },
  preschool: { label: 'Preschool', hue: 'var(--p-preschool)', blurb: 'Ages 3–5: comfort, floats, glides and first strokes.' },
  swimmer: { label: 'Swimmer', hue: 'var(--p-swimmer)', blurb: 'Swimmer 1–6: strokes, survival skills and fitness.' },
  patrol: { label: 'Swim Patrol', hue: 'var(--p-patrol)', blurb: 'Rookie, Ranger and Star: lifesaving foundations.' },
  bronze: { label: 'Bronze', hue: 'var(--p-bronze)', blurb: 'Bronze Star: the first lifesaving award.' },
  'teen-adult': { label: 'Teen / Adult', hue: 'var(--p-teen-adult)', blurb: 'Adult swimmer levels with flexible goals.' },
}

type Entry = string | [name: string, mustSeesKey: string]
type Category = [category: string, entries: Entry[]]

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

function build(
  meta: Omit<LevelDef, 'skills'>,
  categories: Category[],
): LevelDef {
  const seen = new Map<string, number>()
  const skills: Skill[] = []
  for (const [category, entries] of categories) {
    for (const entry of entries) {
      const [name, key] = typeof entry === 'string' ? [entry, undefined] : entry
      if (key && !MUST_SEES[key]) throw new Error(`Unknown must-see key "${key}" in ${meta.id}`)
      let id = `${meta.id}.${slug(name)}`
      const n = (seen.get(id) ?? 0) + 1
      seen.set(id, n)
      if (n > 1) id = `${id}-${n}`
      skills.push({ id, name, category, ...(key ? { mustSees: MUST_SEES[key] } : {}) })
    }
  }
  return { ...meta, skills }
}

const WATER_SMART_PRE = 'Water Smart: Within Arms’ Reach; Wear a Lifejacket'
const WATER_SMART = 'Water Smart: Swim with a Buddy; Wear a Lifejacket; Check the Ice; Swim to Survive'
const WORKOUT_300 =
  'Workout 300 m: 50 m warm-up, 4 × 25 m front crawl (15 sec. rests), 4 × 25 m back crawl (15 sec. rests), 50 m cool-down'

const EE = 'Entries & Exits'
const SS = 'Surface Support'
const UW = 'Underwater Skills'
const S2S = 'Swim to Survive'
const MV = 'Movement & Swimming'
const FIT = 'Fitness'
const WS = 'Water Smart'

export const LEVELS: LevelDef[] = [
  // Parent & Tot
  build(
    { id: 'pt1', program: 'parent-tot', name: 'Parent & Tot 1', short: 'PT1', ages: '4–12 months', minutes: 30, next: 'pt2', ageBased: true,
      blurb: 'Learn to enjoy the water together with a parent.' },
    [[
      'Water Skills',
      [
        ['Hold tot on front, eye contact', 'ptHoldFront'],
        ['Hold tot on back, head and back support', 'ptHoldBack'],
        ['Front float (face out), assisted', 'ptFrontFloatOut'],
        ['Back float, assisted', 'ptBackFloat'],
      ],
    ]],
  ),
  build(
    { id: 'pt2', program: 'parent-tot', name: 'Parent & Tot 2', short: 'PT2', ages: '12–24 months', minutes: 30, next: 'pt3', ageBased: true,
      blurb: 'Face-in floats and first kicks with support.' },
    [[
      'Water Skills',
      [
        ['Front float (face in), assisted', 'ptFrontFloatIn'],
        ['Float on back, assisted', 'ptBackFloat'],
        ['Kicking on front and back, assisted', 'ptKick'],
      ],
    ]],
  ),
  build(
    { id: 'pt3', program: 'parent-tot', name: 'Parent & Tot 3', short: 'PT3', ages: '2–3 years', minutes: 30, next: 'ps1', ageBased: true,
      blurb: 'Starfish and pencil floats, alternating kicks.' },
    [[
      'Water Skills',
      [
        ['Front and back “starfish” floats, assisted', 'ptStarfish'],
        ['Front and back “pencil” floats, assisted', 'ptPencil'],
        ['Kicking on front and back, assisted', 'ptKick'],
      ],
    ]],
  ),

  // Preschool
  build(
    { id: 'ps1', program: 'preschool', name: 'Preschool 1', short: 'PS1', ages: '3–5 years', minutes: 30, next: 'ps2',
      blurb: 'Getting in and out, face in the water, assisted floats and glides.' },
    [
      [EE, ['Enter and exit shallow water (assisted)', 'Jump into chest-deep water (assisted)']],
      [UW, ['Face in water', 'Blow bubbles in water']],
      [MV, [
        ['Float on front, 3 sec. (assisted)', 'psFloatFront'],
        ['Float on back, 3 sec. (assisted)', 'psFloatBack'],
        'Safe movement in shallow water wearing PFD',
        ['Glide on front, 3 m (assisted)', 'psGlideFront'],
        ['Glide on back, 3 m (assisted)', 'psGlideBack'],
      ]],
      [WS, [WATER_SMART_PRE]],
    ],
  ),
  build(
    { id: 'ps2', program: 'preschool', name: 'Preschool 2', short: 'PS2', ages: '3–5 years', minutes: 30, next: 'ps3',
      blurb: 'Independent jumps, submerging, PFD floats and glides.' },
    [
      [EE, ['Enter and exit shallow water wearing PFD', 'Jump into chest-deep water']],
      [UW, ['Submerge', 'Submerge and exhale 3 times']],
      [MV, [
        ['Float on front, 3 sec., wearing PFD or with aid', 'psFloatFrontPfd'],
        ['Float on back, 3 sec., wearing PFD or with aid', 'psFloatBackPfd'],
        ['Roll laterally front to back, wearing PFD', 'rollFB'],
        ['Roll laterally back to front, wearing PFD', 'rollBF'],
        ['Glide on front, 3 m, wearing PFD or with aid', 'psGlideFront2'],
        ['Glide on back, 3 m, wearing PFD or with aid', 'psGlideBack2'],
        ['Flutter kick on back, 5 m, with buoyant aid', 'psKickBack'],
      ]],
      [WS, [WATER_SMART_PRE]],
    ],
  ),
  build(
    { id: 'ps3', program: 'preschool', name: 'Preschool 3', short: 'PS3', ages: '3–5 years', minutes: 30, next: 'ps4',
      blurb: 'Deep-water jumps in a PFD, rolling, kicking and gliding.' },
    [
      [EE, ['Jump into deep water wearing PFD, return and exit', 'Sideways entry wearing PFD']],
      [UW, ['Hold breath underwater 3 sec.', 'Submerge and exhale 5 times', 'Recover object from bottom in waist-deep water']],
      [S2S, ['Back float; roll to front; swim 3 m']],
      [MV, [
        ['Float on front, 5 sec.', 'floatFront'],
        ['Float on back, 5 sec.', 'floatBack'],
        ['Roll laterally front to back', 'rollFB'],
        ['Roll laterally back to front', 'rollBF'],
        ['Glide on front, 3 m', 'glideFront'],
        ['Glide on back, 3 m', 'glideBack'],
        ['Flutter kick on back, 5 m', 'flutterBack'],
        ['Flutter kick on front, 5 m', 'flutterFront'],
      ]],
      [WS, [WATER_SMART_PRE]],
    ],
  ),
  build(
    { id: 'ps4', program: 'preschool', name: 'Preschool 4', short: 'PS4', ages: '3–5 years', minutes: 30, next: 'ps5',
      blurb: 'Solo jumps, sideways entries, side glide and a 5 m front swim in a PFD.' },
    [
      [EE, ['Jump into deep water, return and exit', 'Sideways entry']],
      [SS, [['Tread water 10 sec. wearing PFD', 'treadPfd']]],
      [UW, ['Open eyes underwater', 'Recover object from bottom in chest-deep water']],
      [S2S, [
        'Wearing PFD, sideways entry into deep water; tread 15 sec.; swim / kick 5 m',
        ['Front float; roll to back; swim 5 m', 'floatRollSwim'],
      ]],
      [MV, [
        ['Glide on side, 3 m', 'glideSide'],
        ['Flutter kick on front, 7 m', 'flutterFront'],
        ['Flutter kick on back, 7 m', 'flutterBack'],
        ['Flutter kick on side, 5 m', 'flutterSide'],
        ['Front crawl, 5 m, wearing PFD', 'psFrontCrawlPfd'],
      ]],
      [WS, [WATER_SMART_PRE]],
    ],
  ),
  build(
    { id: 'ps5', program: 'preschool', name: 'Preschool 5', short: 'PS5', ages: '3–5 years', minutes: 30, next: 'sw2',
      blurb: 'Roll entry, treading, whip kick and 5 m front and back crawl.' },
    [
      [EE, ['Forward roll entry wearing PFD']],
      [SS, [['Tread water 10 sec.', 'treadPfd']]],
      [UW, ['Submerge and hold breath 5 sec.', 'Recover object from bottom in chest-deep water']],
      [S2S, ['Wearing PFD, sideways entry into deep water; tread 20 sec.; swim / kick 10 m']],
      [MV, [
        ['Whip kick in vertical position, 20 sec., with PFD or buoyant aid', 'whipVerticalPfd'],
        ['Front crawl, 5 m', 'frontCrawlPs5'],
        ['Back crawl, 5 m', 'backCrawlPs5'],
      ]],
      [FIT, ['Interval training: 4 × 5 m flutter kick on back with 30 sec. rests']],
      [WS, [WATER_SMART_PRE]],
    ],
  ),

  // Swimmer 1–6
  build(
    { id: 'sw1', program: 'swimmer', name: 'Swimmer 1', short: 'SW1', ages: '5+ years', minutes: 30, next: 'sw2',
      blurb: 'Comfort in the water: jumps, breath control, floats, glides and kicking.' },
    [
      [EE, ['Enter and exit shallow water', 'Jump into chest-deep water', 'Jump into deep water wearing PFD']],
      [SS, [['Tread water 30 sec. wearing PFD', 'treadPfd']]],
      [UW, ['Hold breath underwater 5 sec.', 'Submerge and exhale 5 times', 'Open eyes underwater']],
      [MV, [
        ['Float on front, 5 sec.', 'floatFront'],
        ['Float on back, 5 sec.', 'floatBack'],
        ['Roll laterally front to back', 'rollFB'],
        ['Roll laterally back to front', 'rollBF'],
        ['Glide on front, 3 m', 'glideFront'],
        ['Glide on back, 3 m', 'glideBack'],
        ['Glide on side, 3 m', 'glideSide'],
        ['Flutter kick on front, 5 m', 'flutterFront'],
        ['Flutter kick on back, 5 m', 'flutterBack'],
        ['Front crawl, 5 m, wearing PFD', 'psFrontCrawlPfd'],
      ]],
      [WS, [WATER_SMART]],
    ],
  ),
  build(
    { id: 'sw2', program: 'swimmer', name: 'Swimmer 2', short: 'SW2', ages: '5+ years', minutes: 30, next: 'sw3',
      blurb: 'Deeper water, whip kick, and 10 m front and back crawl.' },
    [
      [EE, ['Jump into deep water, return and exit', 'Sideways entry wearing PFD']],
      [SS, [['Tread water 15 sec.', 'treadPfd']]],
      [UW, ['Recover object from bottom in chest-deep water']],
      [S2S, ['Wearing PFD, jump into deep water, tread 30 sec. and swim / kick 15 m']],
      [MV, [
        ['Flutter kick on front, 10 m', 'flutterFrontKnee'],
        ['Flutter kick on back, 10 m', 'flutterBackKnee'],
        ['Flutter kick on side, 10 m', 'flutterSide'],
        ['Whip kick in vertical position, 30 sec., with aid', 'whipVertical'],
        ['Front crawl, 10 m', 'frontCrawlS2'],
        ['Back crawl, 10 m', 'backCrawlS2'],
      ]],
      [FIT, ['Interval training: 4 × 5 m flutter kick with 20 sec. rests']],
      [WS, [WATER_SMART]],
    ],
  ),
  build(
    { id: 'sw3', program: 'swimmer', name: 'Swimmer 3', short: 'SW3', ages: '5+ years', minutes: 45, next: 'sw4',
      blurb: 'Dives, rolls, somersaults and 15 m front and back crawl.' },
    [
      [EE, ['Kneeling dive into deep water', 'Forward roll entry into deep water']],
      [SS, [['Tread water 30 sec.', 'treadS3']]],
      [UW, ['Handstand in shallow water', 'Front somersault (in water)']],
      [S2S, ['Jump into deep water, tread 30 sec. and swim / kick 25 m']],
      [MV, [
        ['Flutter kick on back 5 m; reverse direction and flutter kick on front 5 m', 'flutterBackToFront'],
        ['Flutter kick on front 5 m; reverse direction and flutter kick on back 5 m', 'flutterFrontToBack'],
        ['Whip kick on back, 10 m', 'whipBack'],
        ['Front crawl, 15 m', 'frontCrawlS3'],
        ['Back crawl, 15 m', 'backCrawlS3'],
      ]],
      [FIT, ['Interval training: 4 × 15 m flutter kick with 20 sec. rests']],
      [WS, [WATER_SMART]],
    ],
  ),
  build(
    { id: 'sw4', program: 'swimmer', name: 'Swimmer 4', short: 'SW4', ages: '5+ years', minutes: 45, next: 'sw5',
      blurb: 'Swim to Survive standard, breaststroke arms and 25 m front and back crawl.' },
    [
      [EE, ['Standing dive into deep water']],
      [SS, [['Tread water 1 min.', 'treadS3']]],
      [UW, ['Swim underwater 5 m']],
      [S2S, ['Canadian Swim to Survive Standard: roll entry into deep water, tread 1 min. and swim 50 m']],
      [MV, [
        ['Whip kick on front, 15 m', 'whipFront'],
        ['Breaststroke arms drill, 15 m', 'breaststrokeArms'],
        ['Front crawl, 25 m', 'frontCrawlS3'],
        ['Back crawl, 25 m', 'backCrawlS4'],
      ]],
      [FIT, ['Interval training: 4 × 25 m front or back crawl with 20 sec. rests', 'Sprint front crawl, 25 m']],
      [WS, [WATER_SMART]],
    ],
  ),
  build(
    { id: 'sw5', program: 'swimmer', name: 'Swimmer 5', short: 'SW5', ages: '5+ years', minutes: 45, next: 'sw6',
      blurb: 'Shallow dive, eggbeater, breaststroke 25 m and 50 m front and back crawl.' },
    [
      [EE, ['Shallow dive into deep water', 'Tuck jump (cannonball) into deep water']],
      [SS, [
        ['Jump entry into deep water, and tread 2 min.', 'treadS3'],
        ['Stationary eggbeater kick, 30 sec.', 'eggbeater'],
      ]],
      [UW, ['Back somersault (in water)']],
      [S2S, ['Roll entry into deep water, tread 90 sec. and swim 75 m']],
      [MV, [
        ['Breaststroke, 25 m', 'breaststrokeS5'],
        ['Front crawl, 50 m', 'frontCrawlS5'],
        ['Back crawl, 50 m', 'backCrawlS5'],
        ['Head-up front crawl, 10 m', 'headUpFrontS5'],
      ]],
      [FIT, [
        'Interval training: 4 × 50 m front or back crawl with 30 sec. rests',
        'Interval training: 4 × 15 m breaststroke with 30 sec. rests',
        'Sprint front crawl, 25 m',
        'Sprint back crawl, 25 m',
      ]],
      [WS, [WATER_SMART]],
    ],
  ),
  build(
    { id: 'sw6', program: 'swimmer', name: 'Swimmer 6', short: 'SW6', ages: '5+ years', minutes: 45, next: 'rookie',
      blurb: 'Lifesaving kicks, 100 m front and back crawl, 50 m breaststroke, 300 m workout.' },
    [
      [EE, ['Stride entry into deep water', 'Compact jump into deep water']],
      [SS, [['Legs-only surface support, 45 sec.', 'legsOnly']]],
      [UW, ['Swim underwater 10 m to recover object']],
      [MV, [
        ['Eggbeater kick on back, 15 m', 'eggbeaterBack'],
        ['Scissor kick, 15 m', 'scissor'],
        ['Breaststroke, 50 m', 'breaststrokeS6'],
        ['Front crawl, 100 m', 'frontCrawlS6'],
        ['Back crawl, 100 m', 'backCrawlS6'],
        ['Head-up swim, 25 m', 'headUpSwim'],
      ]],
      [FIT, [
        'Interval training: 4 × 25 m breaststroke with 30 sec. rests',
        'Sprint breaststroke, 25 m',
        WORKOUT_300,
      ]],
      [WS, [WATER_SMART]],
    ],
  ),

  // Swim Patrol
  build(
    { id: 'rookie', program: 'patrol', name: 'Swimmer 7: Rookie Patrol', short: 'SW7', ages: 'Swim Patrol', minutes: 60, next: 'ranger',
      blurb: '50 m strokes, 100 m in 3 minutes, and first aid basics.' },
    [
      ['H2O Proficiency', [
        ['Head-up front crawl or breaststroke', 'headUpFrontOrBreast'],
        ['Scull in ready position', 'sculReady'],
        ['Object carry, 15 m', 'objectCarry'],
        ['Surface dives', 'surfaceDives'],
        ['Lifesaving kick: eggbeater', 'eggbeater'],
        ['Lifesaving kick: scissor kick', 'scissor'],
        ['Lifesaving kick: whip kick', 'breaststrokeLegsS6'],
        ['Front crawl, 50 m', 'frontCrawlS6'],
        ['Back crawl, 50 m', 'backCrawlS6'],
        ['Breaststroke, 50 m', 'breaststrokeS6'],
        ['Endurance challenge: 100 m in 3 min.', 'endurance100'],
      ]],
      ['First Aid', [
        ['Assess conscious victim', 'assessConscious'],
        ['Contacting EMS', 'contactEms'],
        ['Care for bleeding', 'careBleeding'],
      ]],
      ['Recognition & Rescue', [
        ['Victim recognition: weak swimmer', 'weakSwimmer'],
        ['Victim recognition: non-swimmer', 'nonSwimmer'],
      ]],
    ],
  ),
  build(
    { id: 'ranger', program: 'patrol', name: 'Swimmer 8: Ranger Patrol', short: 'SW8', ages: 'Swim Patrol', minutes: 60, next: 'star',
      blurb: '75 m strokes, 200 m in 6 minutes, unconscious victim care.' },
    [
      ['H2O Proficiency', [
        ['Head-up swim', 'headUpSwim'],
        ['Eggbeater kick on back', 'eggbeaterBack'],
        ['Object support', 'objectSupport'],
        ['Remove conscious victim', 'removeConscious'],
        ['Front crawl, 75 m', 'frontCrawlS6'],
        ['Back crawl, 75 m', 'backCrawlS6'],
        ['Breaststroke, 75 m', 'breaststrokeS6'],
        ['Endurance challenge: 200 m in 6 min.', 'endurance200'],
      ]],
      ['First Aid', [
        ['Assessing unconscious, breathing victim', 'assessUnconscious'],
        ['Treat for shock', 'treatShock'],
        ['Obstructed airway: mild obstruction', 'airwayMild'],
        ['Obstructed airway: severe obstruction', 'airwaySevere'],
      ]],
      ['Recognition & Rescue', [
        ['Victim recognition and avoidance', 'victimAvoidance'],
        ['Rescue with buoyant aid', 'rescueBuoyant'],
      ]],
    ],
  ),
  build(
    { id: 'star', program: 'patrol', name: 'Swimmer 9: Star Patrol', short: 'SW9', ages: 'Swim Patrol', minutes: 60, next: 'bronze-star',
      blurb: '100 m strokes, 300 m in 9 minutes, victim removals and towing rescue.' },
    [
      ['H2O Proficiency', [
        ['Head-up swim and assume ready position', 'readyPosition'],
        ['Defense methods', 'defenseMethods'],
        ['Eggbeater kick', 'eggbeaterBack'],
        ['Object carry, 25 m', 'objectCarry'],
        ['Remove unconscious victim', 'removeUnconscious'],
        ['Unconscious victim recovery', 'victimRecovery'],
        ['Front crawl, 100 m', 'frontCrawlS6'],
        ['Back crawl, 100 m', 'backCrawlS6'],
        ['Breaststroke, 100 m', 'breaststrokeS6'],
        ['Endurance challenge: 300 m in 9 min.', 'endurance300'],
      ]],
      ['First Aid', [
        ['Care for bone or joint injury', 'careBoneJoint'],
        ['Care for respiratory emergency', 'careRespiratory'],
      ]],
      ['Recognition & Rescue', [['Rescue with towing aid', 'rescueTowing']]],
    ],
  ),

  // Bronze
  build(
    { id: 'bronze-star', program: 'bronze', name: 'Swimmer 10: Bronze Star', short: 'SW10', ages: 'Bronze', minutes: 60,
      blurb: 'Self rescue, 400 m endurance, obstacle swim and CPR.' },
    [
      ['H2O Proficiency', [
        ['Self rescue', 'selfRescue'],
        ['Entries', 'entries'],
        'Swimming and lifesaving strokes',
        ['Sculling', 'sculling'],
        ['Reaching and throwing assists', 'reachThrow'],
        ['Endurance challenge: 400 m', 'endurance400'],
        ['Obstacle swim', 'obstacleSwim'],
      ]],
      ['First Aid', [['Adult / child CPR', 'cpr']]],
      ['Recognition & Rescue', [
        ['Victim recognition', 'weakSwimmer'],
        ['Rescue with a partner', 'rescueTowing'],
      ]],
    ],
  ),

  // Teen / Adult
  build(
    { id: 'ta1', program: 'teen-adult', name: 'Teen / Adult 1', short: 'TA1', ages: 'Teens & adults', minutes: 45, next: 'ta2',
      blurb: 'Water confidence, floats, kicking and a 10–15 m swim on front and back.' },
    [
      [EE, ['Enter and exit shallow water', 'Jump into deep water, return and exit', 'Sideways entry wearing PFD']],
      [SS, [['Tread water 30 sec. wearing PFD', 'treadPfd']]],
      [UW, ['Hold breath underwater 5–10 sec.', 'Submerge and exhale 5–10 times', 'Open eyes underwater', 'Recover object from bottom in chest-deep water']],
      [S2S, ['Wearing PFD, jump into deep water, tread 30 sec. and swim / kick on back 5–10 m']],
      [MV, [
        ['Float on front', 'floatFront'],
        ['Float on back', 'floatBack'],
        ['Roll laterally front to back', 'rollFB'],
        ['Roll laterally back to front', 'rollBF'],
        ['Glide on front, 3–5 m', 'glideFront'],
        ['Glide on back, 3–5 m', 'glideBack'],
        ['Glide on side, 3–5 m', 'glideSide'],
        ['Flutter kick on front, 10–15 m', 'flutterFront'],
        ['Flutter kick on back, 10–15 m', 'flutterBack'],
        ['Flutter kick on side, 10–15 m', 'flutterSide'],
        ['Whip kick in vertical position with PFD, 15–30 sec.', 'whipVertical'],
        ['Front crawl, 10–15 m', 'frontCrawlS2'],
        ['Back crawl, 10–15 m', 'backCrawlS2'],
      ]],
      [FIT, ['Interval training: 4 × 9–12 m flutter kick with 10–15 sec. rests']],
      [WS, [`${WATER_SMART}; Within Arms’ Reach`]],
    ],
  ),
  build(
    { id: 'ta2', program: 'teen-adult', name: 'Teen / Adult 2', short: 'TA2', ages: 'Teens & adults', minutes: 45, next: 'ta3',
      blurb: 'Dives, Swim to Survive standard, breaststroke arms and 25–50 m crawl.' },
    [
      [EE, ['Standing dive into deep water', 'Forward roll entry into deep water with and without PFD', 'Tuck jump (cannonball) into deep water']],
      [SS, [['Tread water 1–2 min.', 'treadS3']]],
      [UW, ['Handstand in shallow water', 'Front somersault (in water)', 'Swim underwater 5–10 m']],
      [S2S, ['Canadian Swim to Survive Standard: roll entry into deep water, tread 1 min. and swim 50 m']],
      [MV, [
        ['Flutter kick on back 5 m; reverse direction and flutter kick on front 5 m', 'flutterBackToFront'],
        ['Flutter kick on front 5 m; reverse direction and flutter kick on back 5 m', 'flutterFrontToBack'],
        ['Whip kick on back, 10–15 m', 'whipBack'],
        ['Whip kick on front, 10–15 m', 'whipFront'],
        ['Breaststroke arms drill, 10–15 m', 'breaststrokeArms'],
        ['Front crawl, 25–50 m', 'frontCrawlS3'],
        ['Back crawl, 25–50 m', 'backCrawlS3'],
      ]],
      [FIT, [
        'Interval training: 4 × 25 m flutter kick with 15–20 sec. rests',
        'Interval training: 4 × 25 m front or back crawl with 15–20 sec. rests',
        'Sprint front crawl, 25 m',
      ]],
      [WS, [`${WATER_SMART}; Within Arms’ Reach`]],
    ],
  ),
  build(
    { id: 'ta3', program: 'teen-adult', name: 'Teen / Adult 3', short: 'TA3', ages: 'Teens & adults', minutes: 45,
      blurb: 'Eggbeater, stride entries, all three strokes and a 300 m workout.' },
    [
      [EE, ['Shallow dive into deep water', 'Stride entry into deep water', 'Compact jump into deep water']],
      [SS, [['Legs-only surface support, 30–60 sec.', 'legsOnly']]],
      [UW, ['Back somersault (in water)', 'Swim underwater 5–10 m to recover object']],
      [MV, [
        ['Eggbeater kick on back or scissor kick on side, 10–15 m', 'eggbeaterOrScissor'],
        ['Breaststroke, 25–50 m', 'breaststrokeS6'],
        ['Front crawl, 50–100 m', 'frontCrawlS6'],
        ['Back crawl, 50–100 m', 'backCrawlS6'],
        ['Head-up front crawl, 10–15 m', 'headUpSwim'],
      ]],
      [FIT, [
        'Interval training: 4 × 50 m front or back crawl or breaststroke with 30 sec. rests',
        'Sprint 25–50 m: front crawl, back crawl or breaststroke',
        WORKOUT_300,
      ]],
      [WS, [`${WATER_SMART}; Within Arms’ Reach`]],
    ],
  ),
]

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]))

export function getLevel(id: string): LevelDef | undefined {
  return LEVEL_BY_ID[id]
}

/** A fresh, independent copy of a level's skills for use in a class. */
export function cloneSkills(levelId: string): Skill[] {
  return (LEVEL_BY_ID[levelId]?.skills ?? []).map((s) => ({ ...s, mustSees: s.mustSees ? { ...s.mustSees } : undefined }))
}

/** Skill categories in the order they first appear in a list. */
export function categoriesOf(skills: Skill[]): string[] {
  return [...new Set(skills.map((s) => s.category))]
}
