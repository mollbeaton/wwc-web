import { makeReferenceListApi, type RefBody } from '../../api/referenceLists'
import { VESSEL_TYPES } from '../../api/vessels'
import { fixed } from '../../lib/format'
import { ManagementList, type ManagementListConfig } from './ManagementList'

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const VESSELS: ManagementListConfig = {
  title: 'Vessels',
  subtitle: 'Tanks, barrels and other vessels the iOS app records against',
  addLabel: 'Add vessel',
  queryKey: 'vessels',
  api: makeReferenceListApi('/vessels'),
  gridTemplate: 'minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 0.8fr) 60px 90px',
  primaryField: 'code',
  searchKeys: ['code', 'name', 'type'],
  // A vessel also needs a positive capacity, beyond a non-empty code.
  isValid: (form: RefBody) => Number(form.capacity_l) > 0,
  columns: [
    {
      key: 'code',
      label: 'Vessel',
      render: (v) => (v.name ? `${String(v.code)} · ${String(v.name)}` : String(v.code)),
    },
    { key: 'type', label: 'Type', render: (v) => cap(String(v.type)) },
    { key: 'capacity_l', label: 'Capacity', render: (v) => `${fixed(String(v.capacity_l), 0)} L` },
    { key: 'used_count', label: 'Used', render: (v) => String(v.used_count) },
  ],
  fields: [
    { key: 'code', label: 'Code', type: 'text' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'capacity_l', label: 'Capacity (L)', type: 'number' },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: VESSEL_TYPES.map((t) => ({ value: t, label: cap(t) })),
    },
  ],
}

export const VesselsPage = () => <ManagementList config={VESSELS} />
