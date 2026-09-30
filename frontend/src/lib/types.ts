export type Role = 'admin' | 'manager'

export interface Me {
  id: number
  username: string
  name: string
  role: Role
  location_ids: number[]
}

export interface Location {
  id: number
  name: string
  name_ar: string
  city: string
  slug: string
  is_active: boolean
  created_at: string
  feedback_count: number
  last_feedback_at: string | null
}

export type Status = 'new' | 'reviewed' | 'resolved'

export interface Feedback {
  id: number
  location: number
  location_name: string
  created_at: string
  overall: number
  food: number | null
  service: number | null
  ambiance: number | null
  cleanliness: number | null
  value: number | null
  nps: number | null
  highlights: string[]
  comment: string
  guest_name: string
  guest_contact: string
  contact_consent: boolean
  table_number: string
  server_name: string
  language: string
  status: Status
  staff_note: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type CategoryKey = 'food' | 'service' | 'ambiance' | 'cleanliness' | 'value'
export const CATEGORY_KEYS: CategoryKey[] = ['food', 'service', 'ambiance', 'cleanliness', 'value']

export interface Stats {
  range: { from: string; to: string }
  count: number
  avg: number | null
  nps: number | null
  nps_responses: number
  attention: number
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
  categories: Record<CategoryKey, number | null>
  series: { date: string; count: number; avg: number | null }[]
  highlights: { key: string; count: number }[]
  by_location: { id: number; name: string; count: number; avg: number | null; nps: number | null; low: number }[]
  previous: { count: number; avg: number | null; nps: number | null }
}

export interface HistoryDay {
  date: string
  count: number
  avg: number | null
  low: number
  new: number
  comments: number
  locations: number
  nps: number | null
}

export interface TeamMember extends Me {
  first_name: string
  last_login: string | null
}
