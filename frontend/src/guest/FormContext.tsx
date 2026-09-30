import { createContext, use, useMemo, useReducer, type ReactNode } from 'react'
import type { Lang } from '../lib/copy'
import type { CategoryKey } from '../lib/types'
import { STRINGS, type Strings } from './i18n'

export interface FormState {
  overall: number | null
  categories: Partial<Record<CategoryKey, number>>
  highlights: string[]
  comment: string
  nps: number | null
  guest_name: string
  table_number: string
  server_name: string
  guest_contact: string
  contact_consent: boolean
  website: string // honeypot
}

type TextField = 'comment' | 'guest_name' | 'table_number' | 'server_name' | 'guest_contact' | 'website'

type Action =
  | { type: 'overall'; value: number }
  | { type: 'category'; key: CategoryKey; value: number }
  | { type: 'toggleHighlight'; key: string }
  | { type: 'nps'; value: number }
  | { type: 'text'; field: TextField; value: string }
  | { type: 'consent'; value: boolean }
  | { type: 'reset'; table: string }

export const initialForm = (table = ''): FormState => ({
  overall: null,
  categories: {},
  highlights: [],
  comment: '',
  nps: null,
  guest_name: '',
  table_number: table,
  server_name: '',
  guest_contact: '',
  contact_consent: false,
  website: '',
})

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'overall': {
      // Switching between happy/unhappy changes which highlights are offered — clear stale picks.
      const flipped = state.overall != null && state.overall >= 4 !== action.value >= 4
      return { ...state, overall: action.value, highlights: flipped ? [] : state.highlights }
    }
    case 'category':
      return { ...state, categories: { ...state.categories, [action.key]: action.value } }
    case 'toggleHighlight':
      return {
        ...state,
        highlights: state.highlights.includes(action.key)
          ? state.highlights.filter((h) => h !== action.key)
          : [...state.highlights, action.key],
      }
    case 'nps':
      return { ...state, nps: state.nps === action.value ? null : action.value }
    case 'text':
      return { ...state, [action.field]: action.value }
    case 'consent':
      return { ...state, contact_consent: action.value }
    case 'reset':
      return initialForm(action.table)
  }
}

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
    overall: s.overall,
    ...s.categories,
    nps: s.nps,
    highlights: s.highlights,
    comment: s.comment.trim(),
    guest_name: s.guest_name.trim(),
    table_number: s.table_number.trim(),
    server_name: s.server_name.trim(),
    guest_contact: s.contact_consent ? s.guest_contact.trim() : '',
    contact_consent: s.contact_consent,
    language: lang,
    website: s.website,
  }
}
