import { makeReferenceListApi } from '../../api/referenceLists'
import { ManagementList, type ManagementListConfig } from './ManagementList'

const usedColumn = { key: 'used_count', label: 'Used', render: (i: { used_count: number }) => String(i.used_count) }
const GRID_3 = 'minmax(0, 1.5fr) minmax(0, 1fr) 70px 90px'
const GRID_2 = 'minmax(0, 1.6fr) 70px 90px'

const VARIETIES: ManagementListConfig = {
  title: 'Varieties',
  subtitle: 'Apple, pear and grape varieties',
  addLabel: 'Add variety',
  queryKey: 'varieties',
  api: makeReferenceListApi('/varieties'),
  gridTemplate: GRID_3,
  columns: [{ key: 'name', label: 'Name' }, { key: 'fruit', label: 'Fruit' }, usedColumn],
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
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

const ADDITIVES: ManagementListConfig = {
  title: 'Additives',
  subtitle: 'What can be added to a lot',
  addLabel: 'Add additive',
  queryKey: 'additives',
  api: makeReferenceListApi('/additives'),
  gridTemplate: GRID_3,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'default_unit', label: 'Unit' },
    usedColumn,
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'default_unit',
      label: 'Default unit',
      type: 'select',
      options: ['ml', 'g', 'kg', 'litres'].map((u) => ({ value: u, label: u })),
    },
    { key: 'adds_volume', label: 'Adds volume (dilutes ABV)', type: 'checkbox' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

const SUPPLIERS: ManagementListConfig = {
  title: 'Suppliers & canners',
  subtitle: 'Bought-in juice and canning partners',
  addLabel: 'Add supplier',
  queryKey: 'suppliers',
  api: makeReferenceListApi('/suppliers'),
  gridTemplate: GRID_3,
  columns: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind' }, usedColumn],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      options: [
        { value: 'juice', label: 'Juice supplier' },
        { value: 'canner', label: 'Canner' },
        { value: 'other', label: 'Other' },
      ],
    },
    { key: 'contact', label: 'Contact', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

const PACKAGING: ManagementListConfig = {
  title: 'Packaging',
  subtitle: 'Bottle, can and bag formats',
  addLabel: 'Add packaging',
  queryKey: 'packaging',
  api: makeReferenceListApi('/packaging'),
  gridTemplate: GRID_3,
  columns: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind' }, usedColumn],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      options: [
        { value: 'bottle', label: 'Bottle' },
        { value: 'can', label: 'Can' },
        { value: 'bag_in_box', label: 'Bag-in-box' },
      ],
    },
    { key: 'volume_l', label: 'Volume (L)', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

const LOSS_REASONS: ManagementListConfig = {
  title: 'Loss reasons',
  subtitle: 'Why volume left a lot',
  addLabel: 'Add reason',
  queryKey: 'loss-reasons',
  api: makeReferenceListApi('/loss-reasons'),
  gridTemplate: GRID_2,
  columns: [{ key: 'name', label: 'Name' }, usedColumn],
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

export const VarietiesPage = () => <ManagementList config={VARIETIES} />
export const AdditivesPage = () => <ManagementList config={ADDITIVES} />
export const SuppliersPage = () => <ManagementList config={SUPPLIERS} />
export const PackagingPage = () => <ManagementList config={PACKAGING} />
export const LossReasonsPage = () => <ManagementList config={LOSS_REASONS} />
