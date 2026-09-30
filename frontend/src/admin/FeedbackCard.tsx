import { memo, useState } from 'react'
import { api } from '../lib/api'
import { CATEGORY_LABELS, HIGHLIGHT_LABELS, RATING_WORDS, isNegativeHighlight, moodVar } from '../lib/copy'
import { timeOf } from '../lib/format'
import { CATEGORY_KEYS, type Feedback, type Status } from '../lib/types'
import { Button } from '../ui/Button'
import { Stars } from '../ui/States'
import { useToast } from '../ui/Toast'

const STATUSES: { key: Status; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'resolved', label: 'Resolved' },
]

interface Props {
  item: Feedback
  showBranch: boolean
  onChange: (updated: Feedback) => void
}

function contactHref(contact: string) {
  if (contact.includes('@')) return `mailto:${contact}`
  return `tel:${contact.replace(/[^\d+]/g, '')}`
}

export const FeedbackCard = memo(function FeedbackCard({ item, showBranch, onChange }: Props) {
  const toast = useToast()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(item.staff_note)
  const [saving, setSaving] = useState<string | null>(null)

  async function patch(body: Partial<Feedback>, key: string, doneMsg?: string) {
    setSaving(key)
    try {
      const updated = await api<Feedback>(`/feedback/${item.id}/`, { method: 'PATCH', body })
      onChange(updated)
      if (doneMsg) toast.success(doneMsg)
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save. Try again.')
      return false
    } finally {
      setSaving(null)
    }
  }

  const categories = CATEGORY_KEYS.filter((k) => item[k] != null)
  const low = item.overall <= 2

  return (
    <article className={`fb-card${low ? ' fb-card-low' : ''}`} style={{ ['--mood' as string]: moodVar(item.overall) }}>
      <header className="fb-head">
        <div className="fb-rating">
          <Stars value={item.overall} size={14} />
          <span className="fb-word">{RATING_WORDS.en[item.overall - 1]}</span>
        </div>
        <span className="muted small tabular">{timeOf(item.created_at)}</span>
        {showBranch ? <span className="tag">{item.location_name}</span> : null}
        <div className="status-seg" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              data-status={s.key}
              aria-pressed={item.status === s.key}
              disabled={saving !== null}
              onClick={() => item.status !== s.key && patch({ status: s.key }, 'status')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {item.comment ? (
        <p className="fb-comment" dir="auto">
          {item.comment}
        </p>
      ) : (
        <p className="fb-comment muted fb-nocomment">No written comment.</p>
      )}

      {item.highlights.length ? (
        <div className="fb-tags">
          {item.highlights.map((h) => (
            <span key={h} className={`mention mention-sm ${isNegativeHighlight(h) ? 'mention-neg' : 'mention-pos'}`}>
              {HIGHLIGHT_LABELS[h]?.en ?? h}
            </span>
          ))}
        </div>
      ) : null}

      <dl className="fb-meta">
        <div>
          <dt>Guest</dt>
          <dd dir="auto">{item.guest_name || 'Anonymous'}</dd>
        </div>
        {item.table_number ? (
          <div>
            <dt>Table</dt>
            <dd>{item.table_number}</dd>
          </div>
        ) : null}
        {item.server_name ? (
          <div>
            <dt>Served by</dt>
            <dd dir="auto">{item.server_name}</dd>
          </div>
        ) : null}
        {item.nps != null ? (
          <div>
            <dt>Recommend</dt>
            <dd className="tabular">{item.nps}/10</dd>
          </div>
        ) : null}
        {categories.map((k) => (
          <div key={k}>
            <dt>{CATEGORY_LABELS[k].en}</dt>
            <dd className="tabular" style={{ color: moodVar(item[k]) }}>
              {item[k]}/5
            </dd>
          </div>
        ))}
        <div>
          <dt>Language</dt>
          <dd>{item.language === 'ar' ? 'Arabic' : 'English'}</dd>
        </div>
      </dl>

      {item.contact_consent && item.guest_contact ? (
        <div className="callback">
          <span className="callback-badge">Asked for a follow-up</span>
          <a href={contactHref(item.guest_contact)} className="callback-link" dir="ltr">
            {item.guest_contact}
          </a>
        </div>
      ) : null}

      {noteOpen ? (
        <div className="note-edit">
          <label className="sr-only" htmlFor={`note-${item.id}`}>
            Staff note
          </label>
          <textarea
            id={`note-${item.id}`}
            className="input"
            rows={3}
            value={note}
            placeholder="What was done about this? Only your team can see it."
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="note-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNote(item.staff_note)
                setNoteOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              pending={saving === 'note'}
              onClick={async () => {
                if (await patch({ staff_note: note.trim() }, 'note', 'Note saved')) setNoteOpen(false)
              }}
            >
              Save note
            </Button>
          </div>
        </div>
      ) : item.staff_note ? (
        <button className="note" onClick={() => setNoteOpen(true)}>
          <span className="note-label">Team note</span>
          <span dir="auto">{item.staff_note}</span>
        </button>
      ) : (
        <button className="link-btn" onClick={() => setNoteOpen(true)}>
          + Add team note
        </button>
      )}
    </article>
  )
})
