/**
 * WD-25. The production account records monthly production in hl of pure
 * alcohol, whose yearly totals feed the next year's SPR. The accrual endpoint
 * (production counted at packaging) is still to come - see the "Duty P1
 * remainder" task - so this is a placeholder rather than a broken screen.
 */
export function ProductionAccount() {
  return (
    <div className="card" style={{ color: 'var(--ink-muted)' }}>
      The production account (monthly hectolitres of pure alcohol, with year-to-date totals) is
      coming next. The 2025-26 opening figure that sets this year's SPR rates is already recorded
      and visible on the SPR rates tab.
    </div>
  )
}
