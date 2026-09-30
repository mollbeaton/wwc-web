import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tabs, type TabDef } from '../../components/Tabs'
import { MonthlyReturn } from './MonthlyReturn'
import { ProductionAccount } from './ProductionAccount'
import { SprRates } from './SprRates'

type DutyTab = 'return' | 'spr' | 'account'

const TABS: TabDef<DutyTab>[] = [
  { value: 'return', label: 'Monthly return' },
  { value: 'spr', label: 'SPR rates' },
  { value: 'account', label: 'Production account' },
]

export function DutyPage() {
  const [tab, setTab] = useState<DutyTab>('return')

  return (
    <div>
      <PageHeader
        title="Duty"
        subtitle="Monthly Alcohol Duty and Small Producer Relief, in the shape of the HMRC return"
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'return' && <MonthlyReturn />}
      {tab === 'spr' && <SprRates />}
      {tab === 'account' && <ProductionAccount />}
    </div>
  )
}
