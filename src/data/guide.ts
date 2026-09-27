/**
 * The how-to guide, written once and shown in two places: the in-app Help page (/help) and docs/GUIDE.md
 * (regenerate with `npm run guide:md`; a test fails if it's out of date). Text may use **bold**.
 */

/** Places a "Try it" button can open, in the demo or in your own classes. See lib/guideLinks.ts. */
export type GuideTarget =
  'dashboard' | 'new-class' | 'swimmers-tab' | 'attendance' | 'skills' | 'lessons' | 'reports' | 'report-card' | 'settings' | 'pool' | 'pool-team' | 'swimmers'

export interface GuideTopic {
  id: string
  title: string
  summary: string
  /** Screenshot in public/guide/<shot>-light.webp and -dark.webp (made by `npm run guide:shots`). */
  shot?: string
  steps: string[]
  tips?: string[]
  tryIt?: GuideTarget
}

export interface GuideSection {
  id: string
  title: string
  intro: string
  topics: GuideTopic[]
}

export const GUIDE: GuideSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    intro: 'Set up once at the start of a session. It takes about five minutes.',
    topics: [
      {
        id: 'first-look',
        title: 'Your home screen',
        summary: 'Today’s classes, what’s left to do, and all your classes in one place.',
        shot: 'dashboard',
        steps: [
          'Classes you teach **today** show up first, with a big **Take attendance** button.',
          'The **To do** list shows what’s left: attendance you missed, skills to check and report cards that are due. Tap an item to go straight there.',
          'Below that are **all your classes**. Tap one to open it.',
        ],
        tips: ['The first time you open a page, a short tour points out the important parts. To see them again, go to **Help → Replay the tour**.'],
        tryIt: 'dashboard',
      },
      {
        id: 'new-class',
        title: 'Make a class',
        summary: 'Pick the level and SwimTrack loads its skills for you.',
        shot: 'new-class',
        steps: [
          'Press **New** at the top of the screen, then **New class**. (On a phone, press **New** next to your classes on the home screen.)',
          'Pick the **level**, for example Swimmer 3. Its skills from the Swim for Life manual are loaded in automatically.',
          'Add the **session** (like Fall 2026) and the **day and time**. The class name fills itself in.',
          'Choose the **number of lessons**, then press **Create class**.',
        ],
        tips: ['Every class gets its own copy of the skills, so you can rename or add skills in one class without changing the others.'],
        tryIt: 'new-class',
      },
      {
        id: 'add-swimmers',
        title: 'Add swimmers',
        summary: 'Add new swimmers, or put swimmers you already have into a class.',
        shot: 'add-swimmers',
        steps: [
          'Open the class and go to the **Swimmers** tab.',
          'Press **Add swimmers**.',
          '**Tick** everyone you want in this class, then press **Add**. Nothing changes until you press it.',
          'Someone new? Press **New swimmer**, type their name and press **Add to class**.',
        ],
        tips: [
          'To take a swimmer out of a class, press the person icon on their card. SwimTrack asks first and tells you what will be removed.',
          'A swimmer can be in more than one class. Their profile shows every class they’re in.',
        ],
        tryIt: 'swimmers-tab',
      },
    ],
  },
  {
    id: 'lessons',
    title: 'Every lesson',
    intro: 'On deck, with wet hands. Big buttons, and it works without Wi-Fi.',
    topics: [
      {
        id: 'attendance',
        title: 'Take attendance',
        summary: 'A few taps at the start of each lesson.',
        shot: 'attendance',
        steps: [
          'On the home screen, press **Take attendance** on today’s class. (Or open the class and go to the **Attendance** tab.)',
          'Tap **Present**, **Late** or **Absent** for each swimmer.',
          'Everyone else is here? Press **Mark the rest present**.',
          'When everyone is marked you’ll see **attendance done**, with a shortcut to check skills.',
        ],
        tips: ['Tapped the wrong one? Just tap the right one.', 'Missed a lesson? Pick it from the row of lessons at the top, or the To do list will remind you.'],
        tryIt: 'attendance',
      },
      {
        id: 'skills',
        title: 'Check off skills',
        summary: 'Mark each skill as passed or not yet, for the whole class or one swimmer at a time.',
        shot: 'skills',
        steps: [
          'Open the class and go to the **Skills** tab.',
          '**Everyone** shows a grid: skills down the side, swimmers across the top. Tap a box once for **passed** (✓), twice for **not yet** (–), three times to clear it.',
          '**One swimmer** shows a single swimmer with a **Passed** and a **Not yet** button for each skill. It’s easier on a phone.',
          'When a swimmer passes every skill, SwimTrack celebrates and their report card switches to the passing wording.',
        ],
        tips: ['Tap a skill’s name in the One swimmer view to see what the manual says to look for.'],
        tryIt: 'skills',
      },
      {
        id: 'lesson-plans',
        title: 'Plan your lessons',
        summary: 'A topic, date and notes for each lesson.',
        shot: 'lessons',
        steps: [
          'Open the class and go to the **Lessons** tab.',
          'Type a **topic** for each lesson. Suggestions come from the class’s skills.',
          'Press **Fill dates**, pick the **first lesson** and how often it **repeats** (weekly for most sessions), then press **Fill dates** again. Every lesson gets its date.',
          'Use **+** and **–** to change how many lessons there are.',
        ],
        tips: ['Lessons need dates for today’s class to show up on your home screen.'],
        tryIt: 'lessons',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Report cards',
    intro: 'At the end of the session. SwimTrack writes the comments from the manual; you check them.',
    topics: [
      {
        id: 'write-reports',
        title: 'Write report cards',
        summary: 'One swimmer at a time, in three steps.',
        shot: 'report-card',
        steps: [
          'Open the class, go to the **Report cards** tab and press **Start writing**.',
          '**Step 1, skills:** tap **Passed** or **Not yet** for each skill. (Already done in the Skills tab? It’s filled in here too.)',
          '**Step 2, the comment:** press **Write it for me**. SwimTrack writes it from the skills, in the report card manual’s own words. Read it and change anything you like.',
          'Want it to praise something else, or mention different things to work on? Press **Change what it says** and pick.',
          '**Step 3, next level:** already filled in. A swimmer moves up only when every skill is passed.',
          'Press **Next** to go to the next swimmer. Everything saves as you go.',
        ],
        tips: [
          'A green check next to a step means it’s done. The bar at the bottom shows how many cards are finished.',
          'In a hurry? On the Report cards tab, **More → Write the missing comments** writes one for everyone who doesn’t have one. Read them before you print.',
        ],
        tryIt: 'report-card',
      },
      {
        id: 'print',
        title: 'Print or download',
        summary: 'Letter-size report cards, one per page, or a spreadsheet of the whole class.',
        shot: 'preview',
        steps: [
          'While writing, press **Preview** to see exactly what will print.',
          'Press **Print**, then choose **one swimmer’s card** or the **whole class**.',
          'For records, go to the **Report cards** tab and press **More → Download as a spreadsheet**. It opens in Excel or Google Sheets.',
        ],
        tips: ['In the print window, choose Letter paper and turn off headers and footers for the cleanest cards.'],
        tryIt: 'reports',
      },
      {
        id: 'manual-rules',
        title: 'Report card rules',
        summary: 'What the report card manual asks for, and how SwimTrack helps.',
        steps: [
          'Comment on **at least two** skills. SwimTrack warns you if a comment names fewer.',
          'Never mention **attendance or behaviour**. SwimTrack flags words like “absent” or “listening”.',
          'A swimmer passes a level only when **every** skill is passed. Otherwise they register in the same level again.',
          'Keep it positive and specific: something they did well, then what to work on next.',
        ],
        tips: ['A green “Follows the manual” note under the comment means it meets these rules.'],
      },
    ],
  },
  {
    id: 'pools',
    title: 'Pools and supervisors',
    intro: 'For facilities: instructors join a pool, supervisors see every class.',
    topics: [
      {
        id: 'join-pool',
        title: 'Join your pool',
        summary: 'For instructors. It takes one code.',
        steps: [
          'Your supervisor sends you an invite link or an 8-character code.',
          'Open the link (or go to **Settings → Account → Join or start a pool** and type the code).',
          'Read what supervisors can see, then press **Join pool**.',
        ],
        tips: [
          'Supervisors can see your classes, swimmers, attendance, skill marks and report card comments. They can’t change anything.',
          'You can leave any time from the Pool tab. They stop seeing your classes straight away.',
        ],
      },
      {
        id: 'supervise',
        title: 'Supervise a pool',
        summary: 'Every class’s progress in one place, and who needs a hand.',
        shot: 'pool',
        steps: [
          'Go to **Settings → Account → Join or start a pool**, then **Start a pool**.',
          'On the **Team** tab, copy the **invite link** and send it to your instructors.',
          'The **Overview** shows how caught up every class is. **Needs attention** lists classes that are behind, and why.',
          'Tap any class to see it in full: swimmers, attendance, skills and comments. You can print its report cards or download it.',
          '**Rankings** orders classes and instructors by how caught up their records are. Swimmers are never ranked.',
        ],
        tryIt: 'pool',
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    intro: 'Safe, and it keeps working when the Wi-Fi doesn’t.',
    topics: [
      {
        id: 'offline',
        title: 'Working without Wi-Fi',
        summary: 'Everything saves on your device first.',
        steps: [
          'Keep working as normal. Every change saves on your phone, tablet or laptop straight away.',
          'The little status pill at the top says **Saved**, **Saving** or **Offline**.',
          'When you’re back online, SwimTrack syncs by itself, so your other devices catch up.',
        ],
        tips: ['Open SwimTrack once on each device while you have signal. After that it opens even with none.'],
      },
      {
        id: 'mistakes',
        title: 'Undo a mistake',
        summary: 'Nothing important happens without asking.',
        steps: [
          'Removing or deleting anything asks you first, and says exactly what will be removed.',
          'After you remove something, or change several things at once, an **Undo** button pops up for a few seconds. Tap it to put things back.',
          'Want a copy of everything? **Settings → Data → Export backup**.',
        ],
      },
      {
        id: 'security',
        title: 'Keep your account safe',
        summary: 'Two-factor sign-in, and a list of your devices.',
        steps: [
          'Turn on **two-factor** in **Settings → Security**. You’ll use a code from an authenticator app when you sign in.',
          'Save your **recovery codes** somewhere safe, in case you lose your phone.',
          '**Settings → Devices** lists where you’re signed in. Sign out any device you don’t recognise.',
          'Forgot your password? Press **Forgot password?** on the sign-in page and we’ll email you a link.',
        ],
        tryIt: 'settings',
      },
    ],
  },
]

/** Every topic, in order, with the section it belongs to. */
export const ALL_TOPICS = GUIDE.flatMap((section) => section.topics.map((topic) => ({ section, topic })))
