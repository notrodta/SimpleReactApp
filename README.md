# Unit Testing with Mock Data Factories

## Mock Data Factory

```tsx
// tests/factories/companyPickerFactory.ts
import { vi } from 'vitest';
import type { CompanyPickerContext } from '../../CompanyPicker';

export const createMockContext = (
  overrides?: Partial<CompanyPickerContext>
): CompanyPickerContext => ({
  autocomplete: {
    value: '',
    suggestions: [],
    onChange: vi.fn(),
    onSelect: vi.fn(),
    loading: false,
    ...overrides?.autocomplete,
  },
  selectedList: {
    items: [],
    onRemove: vi.fn(),
    ...overrides?.selectedList,
  },
  footer: {
    selectedCount: 0,
    onClear: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides?.footer,
  },
});
```

---

## Test Example

```tsx
// CompanyPickerView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompanyPickerView } from './CompanyPicker';
import { createMockContext } from './factories/companyPickerFactory';

describe('CompanyPickerView', () => {
  it('should handle empty state', () => {
    // Uses all defaults - no setup needed!
    const mockContext = createMockContext();
    
    render(<CompanyPickerView context={mockContext} />);
    
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('should render with selected companies', () => {
    // Easy to create mock with only what we care about
    const mockContext = createMockContext({
      selectedList: {
        items: [
          { id: '1', name: 'Company A' },
          { id: '2', name: 'Company B' },
        ],
      },
      footer: { selectedCount: 2 },
    });
    
    render(<CompanyPickerView context={mockContext} />);
    
    expect(screen.getByText('Company A')).toBeInTheDocument();
    expect(screen.getByText('Company B')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

});

describe('List Component', () => {
  it('should render selected items from context', () => {
    const mockContext = createMockContext({
      selectedList: {
        items: [
          { id: '1', name: 'Company A' },
          { id: '2', name: 'Company B' },
        ],
      },
    });

    render(
      <CompanyPickerCtx.Provider value={mockContext}>
        <List />
      </CompanyPickerCtx.Provider>
    );

    expect(screen.getByText('Company A')).toBeInTheDocument();
    expect(screen.getByText('Company B')).toBeInTheDocument();
  });
});
```


