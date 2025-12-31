# RFC: Smart/Dumb Component Architecture Pattern

**Status:** Proposed  
**Date:** December 25, 2025  
**Author:** Engineering Team

---

## Summary

This RFC proposes a standardized architecture pattern for complex React components that separates business logic from presentation using a "Smart/Dumb" component structure with Context-based prop distribution.

## Motivation

As React components grow in complexity, we face common challenges:

- **Prop drilling** through multiple levels of component hierarchy
- **Tight coupling** between business logic and UI rendering
- **Difficult testing** when logic and presentation are intertwined
- **Poor reusability** of UI components across different contexts
- **Unclear separation of concerns** leading to maintenance issues

This pattern addresses these issues by creating a clear contract between data/behavior (Smart) and presentation (Dumb).

## Detailed Design

### Architecture Overview

The pattern consists of three main layers:

Example component: CompanyPicker

```
┌─────────────────────────────────────┐
│   Smart Component (CompanyPicker)    │
│  - State Management                 │
│  - Business Logic                   │
│  - Child-specific Hooks             │
│  - Connects to CompanyPickerView     │
│    (Single point of entry)          │
└──────────────┬──────────────────────┘
               │ context prop
               ▼
┌─────────────────────────────────────┐
│  Context Provider (CompanyPickerCtx) │
│  - Props Distribution Bus           │
└──────────────┬──────────────────────┘
               │ provides context
               ▼
┌─────────────────────────────────────┐
│ Dumb Component (CompanyPickerView)   │
│  - Pure Presentation                │
│  - No Business Logic                │
│                                     │
│  Contains Child Components:         │
│  ┌───────────────────────────────┐ │
│  │ <Autocomplete />              │ │
│  │   ↑ consumes autocomplete     │ │
│  │     props from context        │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ <List />                      │ │
│  │   ↑ consumes selectedList     │ │
│  │     props from context        │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ <Footer />                    │ │
│  │   ↑ consumes footer           │ │
│  │     props from context        │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```


```tsx


/* ======================================================
    CompanyPickerView context (prop-bus)
   ====================================================== */
type CompanyPickerContext = {
  autocomplete: AutocompleteProps;
  selectedList: SelectedListProps;
  footer: FooterProps;
};

const CompanyPickerCtx = React.createContext<CompanyPickerContext | null>(null);

/* ======================================================
    CompanyPickerView - Single Point of entry
   ====================================================== */
function CompanyPickerView({ context }: { context: CompanyPickerContext }) {
  return (
    <CompanyPickerCtx.Provider value={context}>
      {/* Child components consume context to avoid prop drilling */}
      <div>
        <Autocomplete />
        <List />
        <Footer />
      </div>
    </CompanyPickerCtx.Provider>
  );
}


/* ======================================================
   7) Smart Component wires everything
   ====================================================== */
export function CompanyPicker() {
  const state = useCompanyPickerState(); //Shared States

  // Child specific hooks
  const autocomplete = useAutocomplete(state, suggestions, loading);
  const selectedList = useSelectedList(state);
  const footer = useFooter(state);

// Memoize context to prevent unnecessary re-renders of CompanyPickerView
  const context = React.useMemo<CompanyPickerContext>(
    () => ({
      autocomplete,
      selectedList,
      footer,
    }),
    [autocomplete, selectedList, footer]
  );

  return <CompanyPickerView context={context} />;
}


```
