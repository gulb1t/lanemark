import { create } from 'zustand'
import { cloneSkills, LEVEL_BY_ID } from '../data/curriculum'
import { uid } from '../lib/stats'
import type {
  AttendanceStatus,
  Enrollment,
  Lesson,
  PersistedData,
  Skill,
  SkillStatus,
  Swimmer,
  SwimClass,
} from '../types'

export const DEFAULT_LESSONS = 8
export const MAX_LESSONS = 30

const newLesson = (): Lesson => ({ id: uid(), topic: '', date: '', notes: '' })
const newEnrollment = (swimmerId: string): Enrollment => ({
  swimmerId,
  attendance: {},
  skills: {},
  comment: '',
  nextLevelId: '',
})

export interface NewClassInput {
  levelId: string
  name?: string
  session: string
  schedule: string
  lessonCount: number
}

interface Actions {
  // classes
  addClass: (input: NewClassInput) => string
  updateClass: (id: string, patch: Partial<Pick<SwimClass, 'name' | 'levelId' | 'session' | 'schedule'>>) => void
  deleteClass: (id: string) => void
  duplicateClass: (id: string) => string | undefined
  // lessons
  setLessonCount: (classId: string, count: number) => void
  addLesson: (classId: string) => void
  removeLesson: (classId: string, lessonId: string) => void
  updateLesson: (classId: string, lessonId: string, patch: Partial<Omit<Lesson, 'id'>>) => void
  // skills
  addSkill: (classId: string, skill: { name: string; category: string }) => void
  updateSkill: (classId: string, skillId: string, patch: Partial<Pick<Skill, 'name' | 'category'>>) => void
  removeSkill: (classId: string, skillId: string) => void
  moveSkill: (classId: string, skillId: string, dir: -1 | 1) => void
  /** Reorders the skills of one category (drag and drop); other skills keep their positions. */
  reorderSkills: (classId: string, category: string, orderedIds: string[]) => void
  resetSkills: (classId: string) => void
  // swimmers & roster
  addSwimmer: (input: { name: string; notes?: string }, classId?: string) => string
  updateSwimmer: (id: string, patch: Partial<Pick<Swimmer, 'name' | 'photo' | 'notes'>>) => void
  deleteSwimmer: (id: string) => void
  enroll: (classId: string, swimmerId: string) => void
  unenroll: (classId: string, swimmerId: string) => void
  // records
  setAttendance: (classId: string, swimmerId: string, lessonId: string, status: AttendanceStatus | undefined) => void
  markLesson: (classId: string, lessonId: string, status: AttendanceStatus) => void
  setSkillStatus: (classId: string, swimmerId: string, skillId: string, status: SkillStatus | undefined) => void
  setComment: (classId: string, swimmerId: string, comment: string) => void
  setNextLevel: (classId: string, swimmerId: string, levelId: string) => void
  archiveClass: (id: string, archived: boolean) => void
  // data
  /** Replaces everything without treating it as a user edit (used when loading a cache). */
  hydrate: (data: PersistedData) => void
  /** Applies documents pulled from the server. */
  applyRemote: (docs: RemoteDoc[]) => void
  /** Puts specific documents back to an earlier version (undo). */
  restore: (before: PersistedData, ids: { classes: string[]; swimmers: string[] }) => void
  importData: (data: PersistedData) => void
  replaceWith: (data: PersistedData) => void
  clearAll: () => void
}

export type RemoteDoc =
  | { kind: 'class'; id: string; deleted: boolean; data: SwimClass | null }
  | { kind: 'swimmer'; id: string; deleted: boolean; data: Swimmer | null }

type State = PersistedData & Actions

const newestFirst = (a: SwimClass, b: SwimClass) => b.createdAt - a.createdAt

function upsert<T extends { id: string }>(list: T[], id: string, doc: T | null): T[] {
  const i = list.findIndex((x) => x.id === id)
  if (!doc) return i === -1 ? list : list.filter((x) => x.id !== id)
  if (i === -1) return [...list, doc]
  const next = [...list]
  next[i] = doc
  return next
}

const mapClass = (classes: SwimClass[], id: string, fn: (c: SwimClass) => SwimClass) =>
  classes.map((c) => (c.id === id ? fn(c) : c))

const mapEnrollment = (c: SwimClass, swimmerId: string, fn: (e: Enrollment) => Enrollment): SwimClass => ({
  ...c,
  enrollments: c.enrollments.map((e) => (e.swimmerId === swimmerId ? fn(e) : e)),
})

const omit = <T,>(rec: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _drop, ...rest } = rec
  return rest
}

const setOrClear = <T,>(rec: Record<string, T>, key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? omit(rec, key) : { ...rec, [key]: value }

function defaultClassName(levelId: string, schedule: string) {
  const level = LEVEL_BY_ID[levelId]
  return [level?.name ?? 'New class', schedule.trim()].filter(Boolean).join(' · ')
}

export const useStore = create<State>()((set, get) => ({
  swimmers: [],
  classes: [],

  // Classes
  addClass: ({ levelId, name, session, schedule, lessonCount }) => {
    const id = uid()
    const count = Math.min(MAX_LESSONS, Math.max(1, Math.round(lessonCount) || DEFAULT_LESSONS))
    const cls: SwimClass = {
      id,
      name: name?.trim() || defaultClassName(levelId, schedule),
      levelId,
      session: session.trim(),
      schedule: schedule.trim(),
      lessons: Array.from({ length: count }, newLesson),
      skills: cloneSkills(levelId),
      enrollments: [],
      createdAt: Date.now(),
    }
    set((s) => ({ classes: [cls, ...s.classes] }))
    return id
  },
  updateClass: (id, patch) => set((s) => ({ classes: mapClass(s.classes, id, (c) => ({ ...c, ...patch })) })),
  archiveClass: (id, archived) => set((s) => ({ classes: mapClass(s.classes, id, (c) => ({ ...c, archived })) })),
  deleteClass: (id) => set((s) => ({ classes: s.classes.filter((c) => c.id !== id) })),
  duplicateClass: (id) => {
    const src = get().classes.find((c) => c.id === id)
    if (!src) return undefined
    const copyId = uid()
    // Same skills and roster, but a clean slate for lessons, attendance and progress.
    const copy: SwimClass = {
      ...src,
      id: copyId,
      name: `${src.name} (copy)`,
      lessons: src.lessons.map(() => newLesson()),
      skills: src.skills.map((s) => ({ ...s })),
      enrollments: src.enrollments.map((e) => newEnrollment(e.swimmerId)),
      createdAt: Date.now(),
    }
    set((s) => ({ classes: [copy, ...s.classes] }))
    return copyId
  },

  // Lessons
  setLessonCount: (classId, count) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        const n = Math.min(MAX_LESSONS, Math.max(1, Math.round(count) || 1))
        if (n === c.lessons.length) return c
        if (n > c.lessons.length) {
          return { ...c, lessons: [...c.lessons, ...Array.from({ length: n - c.lessons.length }, newLesson)] }
        }
        const lessons = c.lessons.slice(0, n)
        return { ...c, lessons, enrollments: c.enrollments.map((e) => pruneAttendance(e, lessons)) }
      }),
    })),
  addLesson: (classId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) =>
        c.lessons.length >= MAX_LESSONS ? c : { ...c, lessons: [...c.lessons, newLesson()] },
      ),
    })),
  removeLesson: (classId, lessonId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        if (c.lessons.length <= 1) return c
        const lessons = c.lessons.filter((l) => l.id !== lessonId)
        return { ...c, lessons, enrollments: c.enrollments.map((e) => pruneAttendance(e, lessons)) }
      }),
    })),
  updateLesson: (classId, lessonId, patch) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
      })),
    })),

  // Skills
  addSkill: (classId, { name, category }) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        const skill: Skill = { id: uid(), name: name.trim() || 'New skill', category: category.trim() || 'Custom' }
        // Keep the new skill next to the others in its category.
        const lastInCategory = c.skills.map((k) => k.category).lastIndexOf(skill.category)
        const skills = [...c.skills]
        skills.splice(lastInCategory === -1 ? skills.length : lastInCategory + 1, 0, skill)
        return { ...c, skills }
      }),
    })),
  updateSkill: (classId, skillId, patch) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => ({
        ...c,
        skills: c.skills.map((k) => (k.id === skillId ? { ...k, ...patch } : k)),
      })),
    })),
  removeSkill: (classId, skillId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => ({
        ...c,
        skills: c.skills.filter((k) => k.id !== skillId),
        enrollments: c.enrollments.map((e) => ({ ...e, skills: omit(e.skills, skillId) })),
      })),
    })),
  moveSkill: (classId, skillId, dir) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        const i = c.skills.findIndex((k) => k.id === skillId)
        if (i < 0) return c
        // Swap with the nearest neighbour in the same category so groups stay intact.
        let j = i + dir
        while (j >= 0 && j < c.skills.length && c.skills[j].category !== c.skills[i].category) j += dir
        if (j < 0 || j >= c.skills.length) return c
        const skills = [...c.skills]
        ;[skills[i], skills[j]] = [skills[j], skills[i]]
        return { ...c, skills }
      }),
    })),
  reorderSkills: (classId, category, orderedIds) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        const byId = new Map(c.skills.map((k) => [k.id, k]))
        const queue = orderedIds.map((id) => byId.get(id)).filter((k): k is Skill => Boolean(k && k.category === category))
        if (queue.length !== c.skills.filter((k) => k.category === category).length) return c
        let i = 0
        return { ...c, skills: c.skills.map((k) => (k.category === category ? queue[i++] : k)) }
      }),
    })),
  resetSkills: (classId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => {
        const skills = cloneSkills(c.levelId)
        const keep = new Set(skills.map((k) => k.id))
        return {
          ...c,
          skills,
          // Progress survives for skills that still exist in the preset.
          enrollments: c.enrollments.map((e) => ({
            ...e,
            skills: Object.fromEntries(Object.entries(e.skills).filter(([id]) => keep.has(id))),
          })),
        }
      }),
    })),

  // Swimmers & roster
  addSwimmer: ({ name, notes }, classId) => {
    const id = uid()
    const swimmer: Swimmer = { id, name: name.trim() || 'New swimmer', notes: notes ?? '', createdAt: Date.now() }
    set((s) => ({
      swimmers: [...s.swimmers, swimmer],
      classes: classId
        ? mapClass(s.classes, classId, (c) => ({ ...c, enrollments: [...c.enrollments, newEnrollment(id)] }))
        : s.classes,
    }))
    return id
  },
  updateSwimmer: (id, patch) =>
    set((s) => ({ swimmers: s.swimmers.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
  deleteSwimmer: (id) =>
    set((s) => ({
      swimmers: s.swimmers.filter((w) => w.id !== id),
      classes: s.classes.map((c) => ({ ...c, enrollments: c.enrollments.filter((e) => e.swimmerId !== id) })),
    })),
  enroll: (classId, swimmerId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) =>
        c.enrollments.some((e) => e.swimmerId === swimmerId)
          ? c
          : { ...c, enrollments: [...c.enrollments, newEnrollment(swimmerId)] },
      ),
    })),
  unenroll: (classId, swimmerId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => ({
        ...c,
        enrollments: c.enrollments.filter((e) => e.swimmerId !== swimmerId),
      })),
    })),

  // Records
  setAttendance: (classId, swimmerId, lessonId, status) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) =>
        mapEnrollment(c, swimmerId, (e) => ({ ...e, attendance: setOrClear(e.attendance, lessonId, status) })),
      ),
    })),
  markLesson: (classId, lessonId, status) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => ({
        ...c,
        enrollments: c.enrollments.map((e) => ({ ...e, attendance: { ...e.attendance, [lessonId]: status } })),
      })),
    })),
  setSkillStatus: (classId, swimmerId, skillId, status) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) =>
        mapEnrollment(c, swimmerId, (e) => ({ ...e, skills: setOrClear(e.skills, skillId, status) })),
      ),
    })),
  setComment: (classId, swimmerId, comment) =>
    set((s) => ({ classes: mapClass(s.classes, classId, (c) => mapEnrollment(c, swimmerId, (e) => ({ ...e, comment }))) })),
  setNextLevel: (classId, swimmerId, levelId) =>
    set((s) => ({
      classes: mapClass(s.classes, classId, (c) => mapEnrollment(c, swimmerId, (e) => ({ ...e, nextLevelId: levelId }))),
    })),

  // Data
  hydrate: (data) => set({ swimmers: data.swimmers, classes: [...data.classes].sort(newestFirst) }),
  applyRemote: (docs) =>
    set((s) => {
      let { classes, swimmers } = s
      for (const d of docs) {
        if (d.kind === 'class') classes = upsert(classes, d.id, d.deleted ? null : d.data)
        else swimmers = upsert(swimmers, d.id, d.deleted ? null : d.data)
      }
      return { classes: [...classes].sort(newestFirst), swimmers }
    }),
  restore: (before, ids) =>
    set((s) => {
      let { classes, swimmers } = s
      for (const id of ids.classes) classes = upsert(classes, id, before.classes.find((c) => c.id === id) ?? null)
      for (const id of ids.swimmers) swimmers = upsert(swimmers, id, before.swimmers.find((w) => w.id === id) ?? null)
      return { classes: [...classes].sort(newestFirst), swimmers }
    }),
  importData: (data) =>
    set((s) => {
      const have = new Set(s.swimmers.map((w) => w.id))
      const haveClass = new Set(s.classes.map((c) => c.id))
      return {
        swimmers: [...s.swimmers, ...data.swimmers.filter((w) => !have.has(w.id))],
        classes: [...s.classes, ...data.classes.filter((c) => !haveClass.has(c.id))].sort(newestFirst),
      }
    }),
  replaceWith: (data) => set({ swimmers: data.swimmers, classes: [...data.classes].sort(newestFirst) }),
  clearAll: () => set({ swimmers: [], classes: [] }),
}))

/** Which documents differ between two snapshots (by reference, since every edit is immutable). */
export function changedIds(a: PersistedData, b: PersistedData) {
  const diff = <T extends { id: string }>(x: T[], y: T[]) => {
    const mx = new Map(x.map((d) => [d.id, d]))
    const my = new Map(y.map((d) => [d.id, d]))
    const out: string[] = []
    for (const [id, d] of mx) if (my.get(id) !== d) out.push(id)
    for (const id of my.keys()) if (!mx.has(id)) out.push(id)
    return out
  }
  return { classes: diff(a.classes, b.classes), swimmers: diff(a.swimmers, b.swimmers) }
}

function pruneAttendance(e: Enrollment, lessons: Lesson[]): Enrollment {
  const keep = new Set(lessons.map((l) => l.id))
  return { ...e, attendance: Object.fromEntries(Object.entries(e.attendance).filter(([id]) => keep.has(id))) }
}

/** Runtime check that parsed JSON has the shape of a Lanemark backup. */
export function parseBackup(raw: unknown): PersistedData {
  const d = raw as Partial<PersistedData> | null
  if (!d || typeof d !== 'object' || !Array.isArray(d.swimmers) || !Array.isArray(d.classes)) {
    throw new Error('This file is not a Lanemark backup.')
  }
  const okSwimmer = (w: Swimmer) => w && typeof w.id === 'string' && typeof w.name === 'string'
  const okClass = (c: SwimClass) =>
    c &&
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    Array.isArray(c.lessons) &&
    Array.isArray(c.skills) &&
    Array.isArray(c.enrollments)
  if (!d.swimmers.every(okSwimmer) || !d.classes.every(okClass)) {
    throw new Error('This backup is damaged or from a different app.')
  }
  return { swimmers: d.swimmers, classes: d.classes }
}
