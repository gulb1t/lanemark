import { createPortal } from 'react-dom'
import { categoriesOf, getLevel } from '../data/curriculum'
import { nextLevelLabel } from '../lib/print'
import { passedLevel } from '../lib/stats'
import type { Enrollment, Swimmer, SwimClass } from '../types'

/** One letter-size report card, laid out like the paper card. Used for printing and the on-screen preview. */
export function ReportSheet({ cls, e, swimmer, instructor }: { cls: SwimClass; e: Enrollment; swimmer: Swimmer; instructor: string }) {
  const level = getLevel(cls.levelId)
  const passed = passedLevel(e, cls.skills)
  return (
    <article className="print-card">
      <header className="print-head">
        <div>
          <div className="print-eyebrow">Swim for Life report card</div>
          <h1>{level?.name ?? cls.name}</h1>
        </div>
        <div className={`print-badge ${passed ? 'pass' : 'fail'}`}>{passed ? '✓ Level completed' : 'Level not yet completed'}</div>
      </header>

      <dl className="print-meta">
        <div>
          <dt>Swimmer</dt>
          <dd>{swimmer.name}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{cls.session || '—'}</dd>
        </div>
        <div>
          <dt>Class</dt>
          <dd>{cls.schedule || cls.name}</dd>
        </div>
        <div>
          <dt>Instructor</dt>
          <dd>{instructor || '—'}</dd>
        </div>
      </dl>

      <section className="print-skills">
        {categoriesOf(cls.skills).map((cat) => (
          <div key={cat} className="print-cat">
            <h2>{cat}</h2>
            <ul>
              {cls.skills
                .filter((s) => s.category === cat)
                .map((s) => {
                  const v = e.skills[s.id]
                  return (
                    <li key={s.id} className={v === 'incomplete' ? 'hl' : ''}>
                      <span className="box">{v === 'pass' ? '✓' : ''}</span>
                      {s.name}
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </section>
      <p className="print-key">✓ completed · highlighted items still need work</p>

      <section className="print-comment">
        <h2>Instructor’s comments</h2>
        <p>{e.comment || ' '}</p>
      </section>

      <footer className="print-foot">
        <div>
          <span>Next level to register in</span>
          <strong>{nextLevelLabel(cls, e)}</strong>
        </div>
        <div>
          <span>Instructor signature</span>
          <i />
        </div>
        <div>
          <span>Date</span>
          <i />
        </div>
      </footer>
    </article>
  )
}

/**
 * Print-only report cards, one per page. Rendered into <body> and shown only while printing
 * (see `printReports` and the `[data-printing]` rules in index.css).
 */
export function PrintReports({ cls, rows, instructor }: { cls: SwimClass; rows: { e: Enrollment; swimmer: Swimmer }[]; instructor: string }) {
  return createPortal(
    <div className="print-only print-reports">
      {rows.map(({ e, swimmer }) => (
        <ReportSheet key={swimmer.id} cls={cls} e={e} swimmer={swimmer} instructor={instructor} />
      ))}
    </div>,
    document.body,
  )
}
