/** Labels shared by the guest form (EN/AR) and the admin (EN). Keys match the backend. */
import type { CategoryKey } from './types'

export type Lang = 'en' | 'ar'

export const POSITIVE_HIGHLIGHTS = [
  'tasty_food',
  'friendly_staff',
  'fast_service',
  'great_atmosphere',
  'spotless',
  'good_value',
  'beautiful_presentation',
] as const

export const NEGATIVE_HIGHLIGHTS = [
  'slow_service',
  'food_temperature',
  'wrong_order',
  'noisy',
  'cleanliness',
  'pricey',
  'staff_attitude',
] as const

const NEGATIVE_SET = new Set<string>(NEGATIVE_HIGHLIGHTS)
export const isNegativeHighlight = (key: string) => NEGATIVE_SET.has(key)

export const HIGHLIGHT_LABELS: Record<string, Record<Lang, string>> = {
  tasty_food: { en: 'Delicious food', ar: 'أكل لذيذ' },
  friendly_staff: { en: 'Friendly staff', ar: 'طاقم ودود' },
  fast_service: { en: 'Quick service', ar: 'خدمة سريعة' },
  great_atmosphere: { en: 'Great atmosphere', ar: 'أجواء رائعة' },
  spotless: { en: 'Spotless & clean', ar: 'نظافة ممتازة' },
  good_value: { en: 'Good value', ar: 'قيمة مناسبة' },
  beautiful_presentation: { en: 'Beautiful plating', ar: 'تقديم جميل' },
  slow_service: { en: 'Slow service', ar: 'خدمة بطيئة' },
  food_temperature: { en: 'Food not hot enough', ar: 'الأكل ما كان حار' },
  wrong_order: { en: 'Order was wrong', ar: 'الطلب غلط' },
  noisy: { en: 'Too noisy', ar: 'المكان مزعج' },
  cleanliness: { en: 'Cleanliness', ar: 'النظافة' },
  pricey: { en: 'Too pricey', ar: 'الأسعار مرتفعة' },
  staff_attitude: { en: 'Staff attitude', ar: 'تعامل الموظفين' },
}

export const CATEGORY_LABELS: Record<CategoryKey, Record<Lang, string>> = {
  food: { en: 'Food', ar: 'الأكل' },
  service: { en: 'Service', ar: 'الخدمة' },
  ambiance: { en: 'Ambiance', ar: 'الأجواء' },
  cleanliness: { en: 'Cleanliness', ar: 'النظافة' },
  value: { en: 'Value for money', ar: 'القيمة مقابل السعر' },
}

export const RATING_WORDS: Record<Lang, string[]> = {
  en: ['Poor', 'Fair', 'Good', 'Great', 'Excellent'],
  ar: ['سيئ', 'مقبول', 'جيد', 'رائع', 'ممتاز'],
}

export const moodVar = (rating: number | null | undefined) =>
  rating ? `var(--mood-${Math.min(5, Math.max(1, Math.round(rating)))})` : 'var(--text-3)'
