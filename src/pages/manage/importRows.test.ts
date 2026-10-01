import { describe, expect, it } from 'vitest'
import { parseImport } from './importRows'
import type { ManagementListConfig } from './ManagementList'
import type { ReferenceListApi } from '../../api/referenceLists'

const dummyApi = {} as ReferenceListApi

const varieties: ManagementListConfig = {
  title: 'Varieties',
  subtitle: '',
  addLabel: 'Add variety',
  queryKey: 'v',
  api: dummyApi,
  gridTemplate: '',
  importColumns: ['name', 'fruit'],
  columns: [],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'fruit',
      label: 'Fruit',
      type: 'select',
      options: [
        { value: 'apple', label: 'Apple' },
        { value: 'pear', label: 'Pear' },
        { value: 'grape', label: 'Grape' },
      ],
    },
  ],
}

const orchards: ManagementListConfig = {
  title: 'Orchards',
  subtitle: '',
  addLabel: 'Add orchard',
  queryKey: 'o',
  api: dummyApi,
  gridTemplate: '',
  importColumns: ['name', 'location', 'grower'],
  columns: [],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'grower', label: 'Grower', type: 'text' },
  ],
}

describe('parseImport', () => {
  it('parses valid rows and normalises select values to the option value', () => {
    const r = parseImport('Dabinett, apple\nThorn, Pear\nBacchus, GRAPE', varieties, [])
    expect(r.invalid).toEqual([])
    expect(r.duplicates).toEqual([])
    expect(r.toCreate).toEqual([
      { name: 'Dabinett', fruit: 'apple' },
      { name: 'Thorn', fruit: 'pear' }, // matched by label, stored as value
      { name: 'Bacchus', fruit: 'grape' }, // matched case-insensitively
    ])
  })

  it('rejects an unknown select value with a reason', () => {
    const r = parseImport('Dabinett, aple', varieties, [])
    expect(r.toCreate).toEqual([])
    expect(r.invalid).toHaveLength(1)
    expect(r.invalid[0]).toMatchObject({ line: 1, reason: expect.stringContaining('fruit') })
  })

  it('rejects a row missing the primary field', () => {
    const r = parseImport(', apple', varieties, [])
    expect(r.invalid).toHaveLength(1)
    expect(r.invalid[0].reason).toContain('name')
  })

  it('skips rows that already exist (case-insensitive)', () => {
    const r = parseImport('Dabinett, apple\nMichelin, apple', varieties, ['dabinett'])
    expect(r.duplicates).toEqual(['Dabinett'])
    expect(r.toCreate).toEqual([{ name: 'Michelin', fruit: 'apple' }])
  })

  it('skips a value repeated within the same paste', () => {
    const r = parseImport('Michelin, apple\nmichelin, apple', varieties, [])
    expect(r.toCreate).toHaveLength(1)
    expect(r.duplicates).toEqual(['michelin'])
  })

  it('ignores blank lines and an optional header row', () => {
    const r = parseImport('Name, Fruit\n\nDabinett, apple\n\n', varieties, [])
    expect(r.toCreate).toEqual([{ name: 'Dabinett', fruit: 'apple' }])
  })

  it('allows empty optional text columns (orchards)', () => {
    const r = parseImport('Tyntesfield, Somerset\nFailand Farm', orchards, [])
    expect(r.invalid).toEqual([])
    expect(r.toCreate).toEqual([
      { name: 'Tyntesfield', location: 'Somerset', grower: '' },
      { name: 'Failand Farm', location: '', grower: '' },
    ])
  })
})
