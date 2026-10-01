import type { RefBody } from '../../api/referenceLists'
import type { FieldConfig, ManagementListConfig } from './ManagementList'

export interface ParseResult {
  /** Rows ready to create (valid, not already present, not repeated in the paste). */
  toCreate: RefBody[]
  /** Primary values skipped because they already exist (or repeat within the paste). */
  duplicates: string[]
  /** Rows that couldn't be used, with the reason, for the user to fix. */
  invalid: { line: number; text: string; reason: string }[]
}

/** Parse pasted comma-separated rows into managed-list records, against the
 *  list's own fields. Pure and UI-free so it's easy to test. Select columns
 *  (e.g. fruit, kind) are matched case-insensitively to their option value or
 *  label; a value matching no option is reported rather than sent. Rows whose
 *  primary value already exists are skipped, not duplicated. */
export function parseImport(
  text: string,
  config: ManagementListConfig,
  existingPrimaries: string[],
): ParseResult {
  const primaryField = config.primaryField ?? 'name'
  const columns = config.importColumns ?? []
  const fieldByKey = new Map<string, FieldConfig>(config.fields.map((f) => [f.key, f]))

  const existing = new Set(existingPrimaries.map((p) => p.trim().toLowerCase()))
  const seen = new Set<string>()
  const result: ParseResult = { toCreate: [], duplicates: [], invalid: [] }

  const rawLines = text.split(/\r?\n/)
  let skipHeader = false
  // Treat a first row that names the columns as a header, not data.
  const firstNonBlank = rawLines.find((l) => l.trim() !== '')
  if (firstNonBlank) {
    const cells = firstNonBlank.split(',').map((c) => c.trim().toLowerCase())
    const headerMatches = cells.every((c, i) => {
      const f = fieldByKey.get(columns[i])
      return f ? c === f.key.toLowerCase() || c === f.label.toLowerCase() : false
    })
    if (headerMatches && cells.length === columns.length) skipHeader = true
  }

  rawLines.forEach((raw, index) => {
    const line = index + 1
    if (raw.trim() === '') return
    if (skipHeader && raw === firstNonBlank) {
      skipHeader = false // only skip the first occurrence
      return
    }

    const cells = raw.split(',').map((c) => c.trim())
    const values: RefBody = {}
    let error: string | null = null

    for (let i = 0; i < columns.length; i++) {
      const field = fieldByKey.get(columns[i])
      if (!field) continue
      const cell = cells[i] ?? ''
      if (field.type === 'select') {
        const match = (field.options ?? []).find(
          (o) => o.value.toLowerCase() === cell.toLowerCase() || o.label.toLowerCase() === cell.toLowerCase(),
        )
        if (!match) {
          error ??= cell === '' ? `missing ${field.label.toLowerCase()}` : `unknown ${field.label.toLowerCase()} "${cell}"`
        } else {
          values[field.key] = match.value
        }
      } else {
        values[field.key] = cell
      }
    }

    const primary = String(values[primaryField] ?? '').trim()
    if (primary === '') error ??= `missing ${primaryField}`

    if (error) {
      result.invalid.push({ line, text: raw.trim(), reason: error })
      return
    }

    const key = primary.toLowerCase()
    if (existing.has(key) || seen.has(key)) {
      result.duplicates.push(primary)
      return
    }
    seen.add(key)
    result.toCreate.push(values)
  })

  return result
}
