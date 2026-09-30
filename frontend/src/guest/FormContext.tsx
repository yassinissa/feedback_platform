import { createContext, use, useMemo, useReducer, type ReactNode } from 'react'
import type { Lang } from '../lib/copy'
import { STRINGS, type Strings } from './i18n'

export type GuestCategory = 'food' | 'service' | 'ambiance'
export const GUEST_CATEGORIES: GuestCategory[] = ['food', 'service', 'ambiance']

export interface FormState {
  ratings: Partial<Record<GuestCategory, number>>
  highlights: string[]
  comment: string
  guest_name: string
  server_name: string
  guest_contact: string
  contact_consent: boolean
  table_number: string // only from a per-table QR (?table=12)
  website: string // honeypot
}

type TextField = 'comment' | 'guest_name' | 'server_name' | 'guest_contact' | 'website'

type Action =
  | { type: 'rate'; key: GuestCategory; value: number }
  | { type: 'toggleHighlight'; key: string }
  | { type: 'text'; field: TextField; value: string }
  | { type: 'consent'; value: boolean }

const initialForm = (table: string): FormState => ({
  ratings: {},
  highlights: [],
  comment: '',
  guest_name: '',
  server_name: '',
  guest_contact: '',
  contact_consent: false,
  table_number: table,
  website: '',
})

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'rate':
      return { ...state, ratings: { ...state.ratings, [action.key]: action.value } }
    case 'toggleHighlight':
      return {
        ...state,
        highlights: state.highlights.includes(action.key)
          ? state.highlights.filter((h) => h !== action.key)
          : [...state.highlights, action.key],
      }
    case 'text':
      return { ...state, [action.field]: action.value }
    case 'consent':
      return { ...state, contact_consent: action.value }
  }
}

/** Average of what's been rated so far (drives the ambient light), or null. */
export function averageRating(ratings: FormState['ratings']): number | null {
  const values = GUEST_CATEGORIES.map((k) => ratings[k]).filter((v): v is number => v != null)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export const hasPoor = (ratings: FormState['ratings']) => GUEST_CATEGORIES.some((k) => ratings[k] === 1)

interface FormContextValue {
  state: FormState
  dispatch: (a: Action) => void
  meta: { lang: Lang; t: Strings; dir: 'ltr' | 'rtl' }
}

const FormContext = createContext<FormContextValue | null>(null)

export function FormProvider({ lang, table, children }: { lang: Lang; table: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, table, initialForm)
  const value = useMemo<FormContextValue>(
    () => ({ state, dispatch, meta: { lang, t: STRINGS[lang], dir: lang === 'ar' ? 'rtl' : 'ltr' } }),
    [state, lang],
  )
  return <FormContext value={value}>{children}</FormContext>
}

export function useForm(): FormContextValue {
  const ctx = use(FormContext)
  if (!ctx) throw new Error('useForm must be used inside <FormProvider>')
  return ctx
}

export function toPayload(s: FormState, lang: Lang, clientId: string) {
  return {
    client_id: clientId,
    ...s.ratings, // overall is derived server-side from these
    highlights: s.highlights,
    comment: s.comment.trim(),
    guest_name: s.guest_name.trim(),
    server_name: s.server_name.trim(),
    table_number: s.table_number.trim(),
    guest_contact: s.contact_consent ? s.guest_contact.trim() : '',
    contact_consent: s.contact_consent,
    language: lang,
    website: s.website,
  }
}
