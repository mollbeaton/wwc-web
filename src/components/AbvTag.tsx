/** Where an ABV came from: a manual lab reading, or calculated from gravity. */
export function AbvTag({ method }: { method: string }) {
  return method === 'manual' ? (
    <span className="tag tag--manual" title="Manual reading">Manual</span>
  ) : (
    <span className="tag tag--calc" title="Calculated from gravity">Calc</span>
  )
}
