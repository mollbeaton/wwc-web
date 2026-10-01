import { makeReferenceListApi } from '../../api/referenceLists'
import { ManagementList, type ManagementListConfig } from './ManagementList'

const usedColumn = {
  key: 'used_count',
  label: 'Used',
  render: (i: { used_count: number }) => String(i.used_count),
}

const ORCHARDS: ManagementListConfig = {
  title: 'Orchards',
  subtitle: 'Where the fruit is grown',
  addLabel: 'Add orchard',
  queryKey: 'orchards',
  api: makeReferenceListApi('/orchards'),
  gridTemplate: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) 60px 90px',
  searchKeys: ['name', 'location', 'grower'],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'location', label: 'Location' },
    { key: 'grower', label: 'Grower' },
    usedColumn,
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'grower', label: 'Grower', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

export const OrchardsPage = () => <ManagementList config={ORCHARDS} />
