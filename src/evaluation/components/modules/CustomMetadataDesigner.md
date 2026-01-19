# Custom Metadata Designer

A visual UI component for designing custom metadata schemas in Atlan.

## Features

### Template Selection
- **5 Pre-built Templates**: Data Product, Compliance, Data Quality, Operational, Business Context
- **Start from Scratch**: Create completely custom schemas
- Template cards show description, use case, and attribute count

### Schema Management
- **Multiple Schemas**: Create and manage multiple custom metadata schemas
- **Schema List Panel**: Left sidebar showing all created schemas
- **Schema Properties**:
  - API Name (alphanumeric + underscores)
  - Display Name (human-readable)
  - Description
  - Icon (optional)
  - Color (optional)

### Asset Type Selection
- Multi-select for which asset types the schema applies to:
  - Table, View, Column, Database, Schema
  - Dashboard, Dataset, Report, Pipeline

### Attribute Editor
- **11 Attribute Types**:
  - Text (string)
  - Number
  - Boolean (checkbox)
  - Date
  - Date & Time
  - Dropdown (enum)
  - Multi-select
  - User picker
  - Group picker
  - URL
  - SQL editor

### Attribute Configuration
- **API Name**: Field name for API calls (validated)
- **Display Name**: User-friendly label
- **Description**: Help text for the attribute
- **Type**: Select from 11 types
- **Required**: Mark as mandatory field
- **Multi-valued**: Allow multiple values
- **Help Text**: Inline guidance for users
- **Enum Values**: For dropdown/multi-select types, add/remove values

### Attribute Management
- **Add/Edit/Delete**: Full CRUD operations on attributes
- **Reorder**: Move attributes up/down to control display order
- **Validation**: Real-time validation of API names

### Preview Panel
- **Live Preview**: See how the schema will appear to users
- **Rendered Inputs**: Shows appropriate input types based on attribute configuration
- **Asset Type Tags**: Visual indication of applicable asset types

## Usage

```tsx
import { CustomMetadataDesigner } from './components/modules/CustomMetadataDesigner';

function App() {
  const handleSave = (schemas) => {
    console.log('Saved schemas:', schemas);
    // Send to backend, export as JSON, etc.
  };

  return (
    <CustomMetadataDesigner
      initialSchemas={[]}
      onSave={handleSave}
    />
  );
}
```

## Props

### `CustomMetadataDesignerProps`

| Prop | Type | Description |
|------|------|-------------|
| `initialSchemas` | `CustomMetadataDesign[]` | Optional array of existing schemas to load |
| `onSave` | `(schemas: CustomMetadataDesign[]) => void` | Callback when "Save All" is clicked |

## Types

### `CustomMetadataDesign`
```typescript
interface CustomMetadataDesign {
  id: string;
  name: string;                  // API name
  displayName: string;           // Human-readable name
  description: string;
  appliesTo: AssetType[];        // Which asset types this applies to
  attributes: CustomAttribute[]; // Array of attributes
  isRequired: boolean;
  domains: string[];
  icon?: string;
  color?: string;
}
```

### `CustomAttribute`
```typescript
interface CustomAttribute {
  id: string;
  name: string;                  // API name (snake_case)
  displayName: string;           // Display label
  description?: string;
  type: AttributeType;           // string, number, boolean, etc.
  enumValues?: string[];         // For enum/multiSelect types
  isRequired: boolean;
  isMultiValued: boolean;
  defaultValue?: unknown;
  helpText?: string;
  validationRule?: string;
  validationMessage?: string;
  order: number;                 // Display order
}
```

### `AttributeType`
```typescript
type AttributeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'multiSelect'
  | 'user'
  | 'group'
  | 'url'
  | 'sql';
```

## Templates

### Data Product
For data mesh architectures:
- SLA (dropdown)
- Refresh Frequency (dropdown)
- Cost Center (text)
- Consumers (group, multi-valued)
- Data Contract URL (url)

### Compliance
For regulatory tracking:
- Retention Period (dropdown)
- Legal Hold (boolean)
- Data Source Country (enum, multi-valued)
- Applicable Regulations (multi-select)
- Last Audit Date (date)

### Data Quality
For quality metrics:
- Freshness SLA (dropdown)
- Completeness Threshold (number)
- DQ Owner (user)
- DQ Rules (url)
- Known Issues (text)

### Operational
For incident response:
- On-Call Team (group)
- Runbook URL (url)
- Slack Channel (text)
- Last Incident Date (date)
- Criticality (dropdown)

### Business Context
For lineage gaps:
- Business Process (enum, multi-valued)
- Upstream System (text, multi-valued)
- Downstream Reports (text, multi-valued)
- Business Owner (user)

## Styling

The component uses:
- **Tailwind CSS** for styling
- **lucide-react** for icons
- **Slate/Blue color palette** matching existing components
- **Responsive grid layouts**
- **Modal dialogs** for attribute editing
- **Hover states and transitions**

## Validation

### API Name Validation
- Must start with lowercase letter
- Only lowercase letters, numbers, and underscores
- Max 50 characters
- Real-time validation with error messages

### Required Fields
- Schema: API name, Display name
- Attribute: API name, Display name, Type
- Enum/MultiSelect: At least one value

## State Management

The component manages its own state using React hooks:
- `schemas`: Array of all custom metadata schemas
- `selectedSchemaId`: Currently selected schema
- `editingAttribute`: Attribute being edited in modal
- `showAttributeModal`: Modal visibility
- `showPreview`: Preview modal visibility

## Integration

The component is integrated into the main app:
1. Added to `CategorySidebar` under the STRUCTURE group
2. Rendered in `App.tsx` when `activeView === 'custom-metadata'`
3. Exported from `src/components/modules/index.ts`

## Next Steps

Potential enhancements:
- Export schemas as JSON
- Import schemas from JSON
- Validation rules editor
- Default value configuration
- Domain-specific overrides
- Preview with sample data
- Deploy to Atlan API integration
