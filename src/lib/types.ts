export type Role = 'editor' | 'viewer'

export interface Profile {
  id: string
  email: string | null
  name: string
  role: Role
}

export interface AllowedMember {
  email: string
  name: string
  role: Role
}

export interface Settings {
  id: number
  house_name: string
  budget: number
}

export type StageStatus = 'pending' | 'ongoing' | 'done'

export interface Stage {
  id: number
  name_en: string
  name_ta: string
  sort_order: number
  status: StageStatus
}

export type CategoryKind = 'material' | 'labour' | 'service' | 'other'

export interface Category {
  id: number
  name_en: string
  name_ta: string
  kind: CategoryKind
  sort_order: number
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  notes: string | null
}

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'credit'
export type CashMode = 'cash' | 'upi' | 'bank'

export interface Expense {
  id: string
  date: string
  amount: number
  paid_amount: number
  category_id: number | null
  stage_id: number | null
  supplier_id: number | null
  description: string | null
  quantity: number | null
  unit: string | null
  payment_mode: PaymentMode
  paid_by: string | null
  receipt_path: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Worker {
  id: string
  name: string
  trade: string
  daily_rate: number
  phone: string | null
  active: boolean
  notes: string | null
}

export interface Attendance {
  id: string
  date: string
  worker_id: string
  day_fraction: number
  rate: number
  stage_id: number | null
  notes: string | null
}

export interface WorkerPayment {
  id: string
  date: string
  worker_id: string
  amount: number
  kind: 'wage' | 'advance'
  payment_mode: CashMode
  paid_by: string | null
  notes: string | null
  created_at: string
}
