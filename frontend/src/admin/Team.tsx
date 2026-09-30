import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Location, Role, TeamMember } from '../lib/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { ErrorState } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useAuth } from './auth'
import { useLocations } from './filters'

export default function Team() {
  const { me } = useAuth()
  const toast = useToast()
  const { data, error, mutate } = useSWR<TeamMember[]>('/team/')
  const { data: locations } = useLocations()
  const [editing, setEditing] = useState<TeamMember | 'new' | null>(null)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const locName = new Map((locations ?? []).map((l) => [l.id, l.name]))

  async function remove(member: TeamMember) {
    try {
      await api(`/team/${member.id}/`, { method: 'DELETE' })
      toast.success(`${member.name} removed`)
      setRemoving(null)
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove. Try again.')
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="muted">Admins see every branch. Branch managers only see the branches you give them.</p>
        </div>
        <Button variant="primary" onClick={() => setEditing('new')}>
          + Add person
        </Button>
      </header>

      {error ? <ErrorState message={error.message} onRetry={() => mutate()} /> : null}
      <div className="panel panel-flush">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Branches</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!data
                ? [0, 1].map((i) => (
                    <tr key={i}>
                      <td colSpan={5}>
                        <div className="skeleton" style={{ height: 20 }} />
                      </td>
                    </tr>
                  ))
                : data.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="person">
                          <span className="avatar" aria-hidden>
                            {m.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <b>{m.name}</b>
                            <span className="muted small block">@{m.username}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${m.role === 'admin' ? 'badge-accent' : 'badge-muted'}`}>
                          {m.role === 'admin' ? 'Admin' : 'Manager'}
                        </span>
                      </td>
                      <td className="small">
                        {m.role === 'admin' ? <span className="muted">All branches</span> : m.location_ids.map((id) => locName.get(id)).filter(Boolean).join(', ') || <span className="muted">None yet</span>}
                      </td>
                      <td className="muted small">{m.last_login ? relativeTime(m.last_login) : 'Never'}</td>
                      <td className="num">
                        <div className="row-actions">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                            Edit
                          </Button>
                          {m.id !== me?.id ? (
                            <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <MemberForm
          member={editing === 'new' ? null : editing}
          locations={locations ?? []}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            mutate()
            toast.success(msg)
          }}
        />
      ) : null}
      {removing ? (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => remove(removing)}>
                Remove access
              </Button>
            </>
          }
        >
          <p className="muted">They'll be signed out and can no longer see feedback. Their past notes stay in the history.</p>
        </Modal>
      ) : null}
    </div>
  )
}

function MemberForm({
  member,
  locations,
  onClose,
  onSaved,
}: {
  member: TeamMember | null
  locations: Location[]
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [name, setName] = useState(member?.first_name ?? '')
  const [username, setUsername] = useState(member?.username ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(member?.role ?? 'manager')
  const [locIds, setLocIds] = useState<number[]>(member?.location_ids ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!username.trim()) errs.username = 'Choose a username.'
    if (!member && password.length < 8) errs.password = 'Use at least 8 characters.'
    if (member && password && password.length < 8) errs.password = 'Use at least 8 characters.'
    if (Object.keys(errs).length) return setErrors(errs)
    setPending(true)
    setErrors({})
    const body: Record<string, unknown> = { first_name: name.trim(), username: username.trim(), role_input: role, locations: locIds }
    if (password) body.password = password
    try {
      if (member) await api(`/team/${member.id}/`, { method: 'PATCH', body })
      else await api('/team/', { method: 'POST', body })
      onSaved(member ? 'Changes saved' : `${name || username} can now sign in`)
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as Record<string, string[] | string>) : null
      setErrors(
        data && typeof data === 'object'
          ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))
          : { username: 'Could not save. Try again.' },
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      title={member ? `Edit ${member.name}` : 'Add a person'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="member-form" pending={pending}>
            {member ? 'Save changes' : 'Add person'}
          </Button>
        </>
      }
    >
      <form id="member-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Field label="Full name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Noura Al-Sabah" />
        </Field>
        <Field label="Username" required error={errors.username}>
          <input className="input" autoCapitalize="none" autoComplete="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field
          label={member ? 'New password' : 'Password'}
          required={!member}
          hint={member ? 'Leave empty to keep the current password.' : 'At least 8 characters. Share it with them privately.'}
          error={errors.password}
        >
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <fieldset className="plain-fieldset">
          <legend className="field-label">Role</legend>
          <div className="segmented segmented-full" role="group">
            <button type="button" aria-pressed={role === 'manager'} onClick={() => setRole('manager')}>
              Branch manager
            </button>
            <button type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')}>
              Admin
            </button>
          </div>
        </fieldset>
        {role === 'manager' ? (
          <fieldset className="plain-fieldset">
            <legend className="field-label">Branches they can see</legend>
            <div className="chips">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="chip"
                  aria-pressed={locIds.includes(l.id)}
                  onClick={() => setLocIds((cur) => (cur.includes(l.id) ? cur.filter((x) => x !== l.id) : [...cur, l.id]))}
                >
                  {l.name}
                </button>
              ))}
            </div>
            {errors.locations ? <span className="field-error">{errors.locations}</span> : null}
          </fieldset>
        ) : null}
      </form>
    </Modal>
  )
}
