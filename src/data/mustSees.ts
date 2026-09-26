import type { MustSees } from '../types.ts'

/**
 * "Must sees": the one-line coaching cue for each part of a skill (arms, legs, breathing, body position), or a single
 * note for skills judged as a whole. They're written to be dropped into a report card comment after the skill name,
 * so each one is a complete instruction. Keys are referenced by curriculum.ts; shared cues are constants below.
 */

const STAR_ARMS = 'Keep your arms spread wide like a star, right at the surface.'
const STAR_LEGS = 'Keep your legs spread wide like a star, right at the surface.'
const STRAIGHT_LEGS = 'Keep your legs straight and up at the surface.'
const BUBBLES = 'Put your whole face in and blow bubbles.'
const EARS_IN = 'Lay your ears back in the water and keep your whole body close to the surface.'
const ARMS_BEYOND = 'Stretch your arms past your head so your body stays long and streamlined.'
const ON_SIDE =
  'Lie on your side with your bottom arm stretched past your head and your top arm resting along your side, so you stay streamlined.'
const KICK_KNEE_BEND = 'Keep both legs kicking up and down the whole time, with just a little bend at the knee.'
const KICK_CONTINUOUS = 'Keep your legs kicking up and down without stopping.'
const FACE_BUBBLES = 'Put your whole face in the water and blow bubbles.'
const FLUTTER_FRONT_BODY =
  'Reach your arms past your head and kick up and down at the surface to stay long and streamlined.'
const FLUTTER_BACK_BODY =
  'Lay your ears back, keep your tummy up and kick up and down at the surface to stay long and streamlined.'
const BREASTSTROKE_LEGS_S6 = 'Kick both legs together, with your knees close and your feet out wide.'
const HIPS_KICK = 'Keep the kick going without pauses, and let it start from your hips.'
const RELAX_KICK = 'Let your legs and feet stay loose while you kick.'
const RELAXED_BREATHING = 'Keep your breathing calm and relaxed.'
const WHIP_LEGS = 'Keep your feet wider than your knees, and kick both feet together in the same motion.'
const EGG_LEGS = 'Circle your legs inward one after the other, with your feet wider than your knees.'
const HEAD_UP_ARMS =
  'Alternate your arms, lifting your elbow out of the water first. Reach forward past your shoulder, then pull down past your hip.'
const HEAD_UP_LEGS = 'Kick from your hips without stopping, keeping the kick at the surface.'
const BREASTSTROKE_ARMS =
  'Pull both arms in towards your chest together, elbows above your hands, then stretch them out past your head.'
const BREATHE_EXHALE = 'Breathe out every time your face is in the water.'

export const MUST_SEES: Record<string, MustSees> = {
  // Parent & Tot
  ptHoldFront: { body: 'Lie flat and relaxed along the surface.' },
  ptHoldBack: { body: 'Lie flat by letting your ears rest back in the water.' },
  ptFrontFloatOut: {
    arms: STAR_ARMS,
    legs: STAR_LEGS,
    breathing: 'Have a go at blowing bubbles.',
    body: 'Lie flat and relaxed along the surface.',
  },
  ptBackFloat: {
    arms: STAR_ARMS,
    legs: 'Keep your legs straight and together, up at the surface.',
    body: 'Lie flat by letting your ears rest back in the water.',
  },
  ptFrontFloatIn: {
    arms: STAR_ARMS,
    legs: STAR_LEGS,
    breathing: 'Have a go at putting your face in and blowing bubbles.',
    body: 'Lie flat and relaxed along the surface.',
  },
  ptKick: {
    legs: 'Take turns with your legs to make a flutter kick.',
    breathing: 'On your front, have a go at putting your face in and blowing bubbles.',
    body: 'Stay long and streamlined. On your front, face in with your arms stretched past your head. On your back, ears in with your arms by your sides.',
  },
  ptStarfish: {
    arms: STAR_ARMS,
    legs: STAR_LEGS,
    breathing: 'On your front, have a go at putting your face in and blowing bubbles.',
    body: 'On your front, lie flat and relaxed along the surface. On your back, lie flat by letting your ears rest back in the water.',
  },
  ptPencil: {
    arms: 'Keep your arms along your sides, up at the surface.',
    legs: 'Keep your legs straight and squeezed together, up at the surface.',
    breathing: 'On your front, have a go at putting your face in and blowing bubbles.',
    body: 'On your front, lie flat and relaxed along the surface. On your back, lie flat by letting your ears rest back in the water.',
  },

  // Preschool
  psFloatFront: {
    arms: STAR_ARMS,
    legs: STRAIGHT_LEGS,
    breathing: 'Keep practising putting your whole face in and blowing bubbles.',
    body: 'Lie flat and relaxed along the surface.',
  },
  psFloatBack: {
    arms: STAR_ARMS,
    legs: STRAIGHT_LEGS,
    body: 'Lie flat and relaxed with your ears resting back in the water.',
  },
  psGlideFront: {
    legs: STRAIGHT_LEGS,
    breathing: 'Keep practising putting your whole face in and blowing bubbles.',
    body: ARMS_BEYOND,
  },
  psGlideBack: {
    legs: STRAIGHT_LEGS,
    body: 'Stay long and streamlined, with your ears in the water and your arms by your sides.',
  },
  psFloatFrontPfd: {
    breathing: 'Keep practising putting your whole face in and blowing bubbles.',
    body: 'Spread your arms out like a star, and get back to standing on your own afterwards.',
  },
  psFloatBackPfd: {
    body: 'Make a star shape with your ears in the water, and get back to standing on your own afterwards.',
  },
  rollFB: { body: 'As soon as you roll onto your back, bring your tummy up to the surface.' },
  rollBF: {
    breathing: 'As you roll onto your front, put your whole face in and blow bubbles.',
    body: 'Keep your body flat along the surface.',
  },
  psGlideBack2: {
    arms: 'Keep your arms resting by your sides.',
    legs: 'Keep your legs straight and squeezed together, up at the surface.',
    body: EARS_IN,
  },
  psGlideFront2: {
    legs: 'Keep your legs straight and squeezed together, up at the surface.',
    breathing: 'Practise putting your whole face in and blowing bubbles.',
    body: ARMS_BEYOND,
  },
  psKickBack: {
    arms: 'Keep your arms resting by your sides.',
    legs: 'Keep both legs kicking up and down the whole way.',
    body: EARS_IN,
  },

  // Floats, rolls, glides (Preschool 3 / Swimmer 1 / Teen-Adult 1)
  floatFront: {
    arms: STAR_ARMS,
    legs: STRAIGHT_LEGS,
    breathing: BUBBLES,
    body: 'Put your whole face in and hold a star shape right at the surface.',
  },
  floatBack: { arms: STAR_ARMS, legs: STRAIGHT_LEGS, body: EARS_IN },
  glideFront: {
    legs: 'Keep your legs straight and squeezed together, up at the surface.',
    breathing: 'Put your entire face in the water and blow bubbles.',
    body: ARMS_BEYOND,
  },
  glideBack: {
    arms: 'Keep your arms resting by your sides.',
    legs: 'Keep your legs straight and together, up at the surface.',
    body: EARS_IN,
  },
  glideSide: { body: ON_SIDE },

  // Kicks
  flutterFront: { legs: KICK_CONTINUOUS, breathing: FACE_BUBBLES, body: FLUTTER_FRONT_BODY },
  flutterBack: { legs: KICK_CONTINUOUS, body: FLUTTER_BACK_BODY },
  flutterFrontKnee: { legs: KICK_KNEE_BEND, breathing: FACE_BUBBLES, body: FLUTTER_FRONT_BODY },
  flutterBackKnee: {
    arms: 'Keep your arms resting by your sides.',
    legs: KICK_KNEE_BEND,
    body: FLUTTER_BACK_BODY,
  },
  flutterSide: { legs: 'Keep a steady flutter kick going the whole way.', body: ON_SIDE },
  flutterBackToFront: {
    arms: 'Keep your arms by your sides while you kick on your back, then stretch them past your head as you roll to your front.',
    legs: 'Kick from your hips without stopping, with just a little bend at the knee.',
    body: 'As soon as you turn onto your front, put your face in and stretch your arms past your head so you stay streamlined.',
  },
  flutterFrontToBack: {
    arms: 'Keep your arms stretched past your head while you kick on your front, then bring them to your sides as you roll to your back.',
    legs: 'Kick from your hips without stopping, with just a little bend at the knee.',
    body: 'As soon as you turn onto your back, lay your ears in and bring your tummy up so you stay streamlined.',
  },
  whipVertical: {
    legs: 'Whip both legs around with your feet wider than your knees.',
    body: 'Stay upright, and kick both legs together in the same motion.',
  },
  whipBack: { legs: WHIP_LEGS, body: 'Stay on your back and whip both legs around together.' },
  whipFront: { legs: WHIP_LEGS, body: 'Stay on your front and whip both legs around together.' },
  eggbeater: { legs: EGG_LEGS, body: 'Keep your body upright.' },
  eggbeaterBack: { legs: EGG_LEGS, body: 'Keep your body on its back.' },
  scissor: {
    legs: 'Reach one leg forward and the other back, then snap them together like scissors.',
    body: 'Keep your body turned on its side.',
  },
  eggbeaterOrScissor: {
    legs: 'For eggbeater, alternate both legs in inward circles with your feet wider than your knees. For scissor kick, reach one leg forward and the other back, then snap them together.',
    body: 'For eggbeater, stay on your back. For scissor kick, stay turned on your side.',
  },
  legsOnly: {
    body: 'Stay upright with your mouth and nose out of the water.',
  },

  // Treading
  treadPfd: {
    arms: 'Keep your arms sweeping back and forth.',
    legs: 'Keep your legs pedalling in big circles, like riding a bike.',
    breathing: 'Keep your mouth and nose above the water the whole time.',
    body: 'Keep your body upright.',
  },
  treadS3: {
    arms: 'Keep your arms sweeping back and forth without stopping.',
    legs: 'Bring your knees up towards your chest and pedal like you’re riding a bike, so the kick holds you up the whole time.',
    breathing: 'Keep your mouth and nose above the water the whole time.',
    body: 'Keep your body upright.',
  },
  floatRollSwim: {
    arms: STAR_ARMS,
    legs: 'Keep your legs up at the surface.',
    body: 'Lay your ears back, keep your whole body close to the surface, and get your kick going.',
  },
  psFrontCrawlPfd: {
    arms: 'Take turns with your arms, lifting them high out of the water.',
    legs: 'Keep both legs kicking without stopping.',
    body: 'Stay relaxed on your front and keep your arms and legs moving the whole way.',
  },
  whipVerticalPfd: {
    legs: 'Whip both legs around with your feet wider than your knees.',
    body: 'Stay upright, and kick both legs together in the same motion.',
  },
  frontCrawlPs5: {
    arms: 'Take turns with your arms, lifting them high out of the water.',
    legs: KICK_KNEE_BEND,
    breathing: 'Look down at the bottom of the pool and blow your bubbles.',
    body: 'Kick up and down close to the surface so you stay long and streamlined.',
  },
  backCrawlPs5: {
    arms: 'Take turns with your arms, lifting them high out of the water.',
    legs: KICK_KNEE_BEND,
    breathing: RELAXED_BREATHING,
    body: FLUTTER_BACK_BODY,
  },

  // Front / back crawl by stage
  frontCrawlS2: {
    arms: 'Keep your arms taking turns, reaching high out of the water each time.',
    legs: 'Keep both legs alternating the whole way, with just a little bend at the knee.',
    breathing: 'Blow bubbles while your face is in, and keep a steady breathing rhythm.',
    body: 'Keep your body on its front the whole way.',
  },
  backCrawlS2: {
    arms: 'Keep your arms taking turns, reaching high out of the water each time.',
    legs: 'Keep both legs alternating the whole way, with just a little bend at the knee.',
    breathing: RELAXED_BREATHING,
    body: 'Keep your body on its back the whole way.',
  },
  frontCrawlS3: {
    arms: 'Keep your arms taking turns high out of the water, and add a pull under the water with each stroke.',
    legs: HIPS_KICK,
    breathing: 'Blow bubbles while your face is in, and turn to the side to breathe on a steady rhythm.',
    body: 'Keep your body long and streamlined.',
  },
  backCrawlS3: {
    arms: 'Keep your arms taking turns high out of the water, entering past your shoulder, and add a pull under the water with each stroke.',
    legs: `${HIPS_KICK} ${RELAX_KICK}`,
    breathing: RELAXED_BREATHING,
    body: 'Keep your body on its back the whole way.',
  },
  backCrawlS4: {
    arms: 'Keep your arms taking turns high out of the water, entering past your shoulder, and add a pull under the water with each stroke.',
    legs: RELAX_KICK,
    breathing: RELAXED_BREATHING,
    body: 'Keep your body on its back the whole way.',
  },
  frontCrawlS5: {
    arms: HEAD_UP_ARMS,
    legs: HEAD_UP_LEGS,
    breathing: 'Turn to the side to breathe on a steady rhythm, and breathe out under the water.',
    body: 'Keep your body long and streamlined.',
  },
  headUpFrontS5: {
    arms: HEAD_UP_ARMS,
    legs: HEAD_UP_LEGS,
    breathing: 'Keep your eyes up above the water.',
    body: 'Keep your body long and streamlined.',
  },
  backCrawlS5: {
    arms: 'Keep your arms straight over the top. Enter the water past your shoulder, then bend your arm to pull down past your thigh.',
    legs: HEAD_UP_LEGS,
    breathing: RELAXED_BREATHING,
    body: 'Keep your body long and streamlined.',
  },
  frontCrawlS6: {
    arms: 'Alternate your arms with your elbows staying above your hands. Reach forward, then pull down past your hip.',
    legs: `${HIPS_KICK} ${RELAX_KICK}`,
    breathing: 'Always turn to the side to breathe, and breathe out under the water.',
    body: 'Keep your body flat along the surface on your front.',
  },
  backCrawlS6: {
    arms: 'Keep your arms straight over the top. Enter the water past your shoulder, then bend your arm to pull through to your thigh.',
    legs: `${HIPS_KICK} ${RELAX_KICK}`,
    breathing: RELAXED_BREATHING,
    body: 'Stay relaxed and flat on your back.',
  },
  headUpSwim: {
    arms: HEAD_UP_ARMS,
    legs: HEAD_UP_LEGS,
    breathing: 'Keep your eyes up above the water.',
    body: 'Keep your body long and streamlined.',
  },

  // Breaststroke
  breaststrokeArms: {
    arms: 'Pull both arms in towards your chest together, elbows above your hands, then stretch them out past your head for the glide.',
    breathing: BREATHE_EXHALE,
    body: 'Keep your body flat along the surface on your front.',
  },
  breaststrokeS5: {
    arms: 'Stick to the order pull, breathe, kick, glide: both arms pull in to your chest together with elbows above your hands, then stretch past your head for the glide.',
    legs: 'Flex your feet and keep them wider than your knees through the whip, with both legs kicking together in the same motion.',
    breathing: 'Breathe on a steady rhythm, and breathe out every time your face is in the water.',
    body: 'Keep your body flat on its front the whole way.',
  },
  breaststrokeS6: {
    arms: BREASTSTROKE_ARMS,
    legs: BREASTSTROKE_LEGS_S6,
    breathing: BREATHE_EXHALE,
    body: 'Keep your body flat on its front the whole way. Pull your arms in to your chest, breathe, kick, then glide with your arms past your head and your legs straight.',
  },

  // The lifesaving whip kick is judged the same way as the Swimmer 6 breaststroke kick.
  breaststrokeLegsS6: { legs: BREASTSTROKE_LEGS_S6 },

  // Swim Patrol (single comments)
  headUpFrontOrBreast: {
    note: 'Keep your eyes above the water the whole time, and hold on to the stroke technique from Swimmer 6.',
  },
  sculReady: {
    note: 'Keep your toes close to the surface and scull in place without drifting.',
  },
  objectCarry: { note: 'Keep your head up out of the water and use a lifesaving kick.' },
  surfaceDives: {
    note: 'Go down straight and vertical, and come back up with your arms stretched above your head.',
  },
  endurance100: { note: 'To make the 100 m in 3 minutes, keep your Swimmer 6 strokes smooth and efficient.' },
  endurance200: { note: 'To make the 200 m in 6 minutes, keep your Swimmer 6 strokes smooth and efficient.' },
  endurance300: { note: 'To make the 300 m in 9 minutes, keep your Swimmer 6 strokes smooth and efficient.' },
  endurance400: { note: 'To make the 400 m, keep your Swimmer 6 strokes smooth and efficient.' },
  assessConscious: {
    note: 'Check the area for hazards first, then check whether your victim responds and look for any bleeding. Talk to your victim to find out what happened.',
  },
  contactEms: { note: 'Give the dispatcher everything they need: who is hurt, what happened, where you are and why help is needed.' },
  careBleeding: {
    note: 'Check the area for hazards, see if your victim responds and look for bleeding. Check the ABCs, keep your victim resting and calm, and press firmly on the wound.',
  },
  weakSwimmer: {
    note: 'Keep in mind that a weak swimmer can usually stay at the surface and swim a little, but struggles to reach safety and may need a rescuer’s help.',
  },
  nonSwimmer: {
    note: 'Keep in mind that a non-swimmer can’t swim at all and is usually at or below the surface. They need a rescuer to get them to safety, and they can put that rescuer in danger.',
  },
  objectSupport: {
    note: 'Keep your head above the water the whole time, and use a strong lifesaving kick to hold yourself up.',
  },
  removeConscious: {
    note: 'Put safety first during the removal, and think about which removal will work best for the victim in front of you.',
  },
  assessUnconscious: {
    note: 'Check the area for hazards and whether your victim responds, then call EMS and send for an AED straight away. Open the airway with a head-tilt-chin-lift, and look, listen and feel for breathing for at least 5 seconds. Then roll your victim into the recovery position.',
  },
  treatShock: {
    note: 'Check the area for hazards and whether your victim responds, and go straight to the ABCs. Call EMS and send for an AED right away. Keep your victim resting, calm and warm, and place them in the recovery position.',
  },
  airwayMild: {
    note: 'Once you’ve worked out that your victim is choking, tell them to keep coughing and keep them calm.',
  },
  airwaySevere: {
    note: 'Call for help before you start. Give 5 back blows, then 5 abdominal thrusts, and keep switching until the airway clears or your victim becomes unconscious.',
  },
  victimAvoidance: {
    note: 'Use your avoidance skills when you’re in danger: ready position, swimming away or going under.',
  },
  rescueBuoyant: {
    note: 'Call for help before you get in. Keep your eyes on the victim the whole time: enter with a stride jump and swim out head-up. Keep talking to your victim all through the rescue.',
  },
  readyPosition: {
    note: 'Keep your toes close to the surface while you scull in the ready position.',
  },
  defenseMethods: {
    note: 'Keep yourself safe as the rescuer: reverse and get ready, swim away, or go under if a victim tries to grab you.',
  },
  removeUnconscious: {
    note: 'Put safety first during the removal, and think about which removal will work best for the victim in front of you. Give your bystander clear instructions the whole time.',
  },
  victimRecovery: {
    note: 'Keep your victim’s face held up above the water the whole time, so no water gets into the airway.',
  },
  careBoneJoint: {
    note: 'Check the area for hazards and whether your victim responds, and call EMS straight away if it’s needed. Keep the injured part as still as possible.',
  },
  careRespiratory: {
    note: 'Check the area for hazards and whether your victim responds, and call EMS straight away if it’s needed. Help your victim into a comfortable position and help them find and take their medication.',
  },
  rescueTowing: {
    note: 'Call for help before you get in. Keep your eyes on the victim the whole time: enter with a stride jump and swim out head-up. Keep talking to your victim all through the rescue, reassuring them and giving the right care.',
  },

  // Bronze Star
  selfRescue: {
    note: 'When doing your self-rescues, make sure your group keeps talking to each other and holds the huddle for the full minute.',
  },
  entries: {
    note: 'When doing your entries, pick one that is safe for the depth of the water, and stay in control as you go in.',
  },
  sculling: {
    note: 'Hold a steady ready position for 30 seconds while sculling in place, and keep that ready position for the full 10 m on the travelling scull.',
  },
  reachThrow: {
    note: 'When doing your reaching and throwing assists, show that you can use each aid safely and get it to the victim.',
  },
  obstacleSwim: {
    note: 'When doing your obstacle swim, go under each obstacle head-first, move well underwater and come back up to the surface.',
  },
  cpr: {
    note: 'Check the area for hazards and whether your victim responds, then call EMS and send for an AED straight away. Open the airway with a head-tilt-chin-lift and check for breathing for no more than 5 seconds. Start CPR with 30 compressions and 2 breaths, finding your hand position first and keeping a steady pace so every compression counts.',
  },
}

export const ELEMENT_LABEL: Record<string, string> = {
  arms: 'Arms',
  legs: 'Legs',
  breathing: 'Breathing',
  body: 'Body position',
  note: 'Must see',
}
