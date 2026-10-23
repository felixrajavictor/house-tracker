import { createContext, useContext } from 'react'
import type { Expense } from './types'

/** App-wide actions provided by the Layout (e.g. open the add/edit expense sheet from anywhere). */
export type UiCtx = { openExpense: (e?: Expense) => void }

export const UiContext = createContext<UiCtx>({ openExpense: () => {} })

export const useUi = () => useContext(UiContext)
