I’ll assume this structure:

```
project-root/
  App.tsx           // your code from the first message
  vitest.config.ts
  vitest.setup.ts
  tests/
    graphqlMocks.ts
    ui.test.tsx
    store-and-services.test.tsx
    connected-and-app.test.tsx
```

If App.tsx is actually in src/App.tsx, just change ../App → ../src/App in the test files.


1. vitest.config.ts
```jsx
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
```

2. vitest.setup.ts
```jsx
import "@testing-library/jest-dom";
import { vi } from "vitest";
import * as graphqlMocks from "./tests/graphqlMocks";

// IMPORTANT: this string must match your real import in App.tsx:
// “Whenever any file imports anything from ./__generated__/graphql,
// instead of loading the real generated GraphQL hooks,
//use this mocked version (graphqlMocks) instead.”
import "@testing-library/jest-dom";
//   import { ... } from "./__generated__/graphql";
vi.mock("./__generated__/graphql", () => graphqlMocks);
```

3. tests/graphqlMocks.ts

```jsx
Simple, clearly named GraphQL hook mocks + tiny builders.

import { vi } from "vitest";

// These names must match the generated Apollo hook exports.
export const useGetTodosQuery = vi.fn();
export const useToggleTodoMutation = vi.fn();
export const useGetOverviewQuery = vi.fn();

// ----------------------------------
// SIMPLE DEFAULT OBJECTS
// ----------------------------------

// "Domain-ish" defaults used for tests. You can tweak as needed.
export const defaultTodo = {
  id: "1",
  title: "Default Todo",
  completed: false,
};

export const defaultOverview = {
  totalTodos: 0,
  completedTodos: 0,
};

// ----------------------------------
// SMALL BUILDERS WITH PARTIAL OVERRIDES
// ----------------------------------

// Builds a Todo object with sensible defaults,
// but lets you override any field (id/title/completed).
export function todo(overrides: Partial<typeof defaultTodo> = {}) {
  return { ...defaultTodo, ...overrides };
}

// Builds an Overview object with defaults,
// again allowing partial override.
export function overview(overrides: Partial<typeof defaultOverview> = {}) {
  return { ...defaultOverview, ...overrides };
}

// Types for the data shape the hooks return.
type TodosData = { todos: ReturnType<typeof todo>[] };
type OverviewData = { overview: ReturnType<typeof overview> };

// ----------------------------------
// QUERY HOOK MOCKS
// ----------------------------------

// Mocks the Apollo generated `useGetTodosQuery` hook.
//
// In your components you do:
//   const { data, loading, error, refetch } = useGetTodosQuery();
//
// This function sets that hook to return a fake object with those fields.
// You can override data/loading/error/refetch as needed in tests.
export function mockGetTodosQuery(opts: {
  data?: TodosData | null;
  loading?: boolean;
  error?: Error | null;
  refetch?: ReturnType<typeof vi.fn>;
} = {}) {
  const {
    data,
    loading = false,
    error = null,
    refetch = vi.fn(),
  } = opts;

  (useGetTodosQuery as unknown as vi.Mock).mockReturnValue({
    // If no data passed, use one default todo.
    data: data ?? { todos: [todo()] },
    loading,
    // Apollo usually gives `error` as an Error object;
    // component typically uses `error?.message`.
    error: error ?? undefined,
    refetch,
  });

  return { refetch };
}

// Mocks the Apollo generated `useGetOverviewQuery` hook.
export function mockGetOverviewQuery(opts: {
  data?: OverviewData | null;
  loading?: boolean;
  error?: Error | null;
  refetch?: ReturnType<typeof vi.fn>;
} = {}) {
  const {
    data,
    loading = false,
    error = null,
    refetch = vi.fn(),
  } = opts;

  (useGetOverviewQuery as unknown as vi.Mock).mockReturnValue({
    data: data ?? { overview: overview() },
    loading,
    error: error ?? undefined,
    refetch,
  });

  return { refetch };
}

// ----------------------------------
// MUTATION HOOK MOCK
// ----------------------------------

// Mocks the Apollo generated `useToggleTodoMutation` hook.
//
// In your components you do:
//   const [toggleTodoMutation] = useToggleTodoMutation();
//   await toggleTodoMutation({ variables: { id } });
//
// This sets that hook to return `[mockFn]`. When your component calls it,
// the mock resolves to the given fake mutation result.
export function mockToggleTodoMutation(
  impl?: (vars: { id: string }) => any,
) {
  // Default implementation: echo back a todo with that id,
  // using defaults for other fields.
  const handler =
    impl ??
    ((variables: { id: string }) => ({
      data: { toggleTodo: todo({ id: variables.id }) },
    }));

  const mutation = vi.fn((args: { variables: { id: string } }) =>
    Promise.resolve(handler(args.variables)),
  );

  (useToggleTodoMutation as unknown as vi.Mock).mockReturnValue([mutation]);
  return mutation;
}

// ----------------------------------
// RESET ALL GRAPHQL MOCKS BETWEEN TESTS
// ----------------------------------

export function resetGraphqlMocks() {
  (useGetTodosQuery as vi.Mock).mockReset();
  (useToggleTodoMutation as vi.Mock).mockReset();
  (useGetOverviewQuery as vi.Mock).mockReset();
}
```

4. tests/ui.test.tsx
```jsx
//Pure UI tests for TodosView + OverviewView

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodosView,
  type Todo,
  OverviewView,
  type OverviewStats,
} from "../App";

// ----------------- TodosView -----------------

describe("TodosView (pure UI)", () => {
  const baseProps = {
    todos: [] as Todo[],
    loading: false,
    error: undefined as string | undefined,
    onToggle: vi.fn(),
    onReload: vi.fn(),
  };

  it("shows 'No todos yet.' when empty and not loading", () => {
    render(<TodosView {...baseProps} />);

    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("No todos yet.")).toBeInTheDocument();
  });

  it("renders todos with correct checked state", () => {
    const todos: Todo[] = [
      { id: "1", title: "Todo A", completed: false },
      { id: "2", title: "Todo B", completed: true },
    ];

    render(<TodosView {...baseProps} todos={todos} />);

    const todoACheckbox = screen.getByLabelText("Todo A") as HTMLInputElement;
    const todoBCheckbox = screen.getByLabelText("Todo B") as HTMLInputElement;

    expect(todoACheckbox.checked).toBe(false);
    expect(todoBCheckbox.checked).toBe(true);
  });

  it("calls onReload when reload button is clicked", () => {
    const onReload = vi.fn();

    render(<TodosView {...baseProps} onReload={onReload} />);

    const button = screen.getByRole("button", { name: "Reload" });
    fireEvent.click(button);

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle with todo id when checkbox is toggled", () => {
    const todos: Todo[] = [{ id: "1", title: "Todo A", completed: false }];
    const onToggle = vi.fn();

    render(
      <TodosView
        {...baseProps}
        todos={todos}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByLabelText("Todo A");
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("shows error text when error prop is set", () => {
    render(<TodosView {...baseProps} error="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables reload button and shows 'Loading...' when loading", () => {
    render(<TodosView {...baseProps} loading={true} />);

    const button = screen.getByRole("button", { name: "Loading..." });
    expect(button).toBeDisabled();
  });
});

// ----------------- OverviewView -----------------

describe("OverviewView (pure UI)", () => {
  const baseProps = {
    stats: undefined as OverviewStats | undefined,
    loading: false,
    error: undefined as string | undefined,
    onReload: vi.fn(),
  };

  it("shows 'No overview data.' when no stats and not loading/error", () => {
    render(<OverviewView {...baseProps} />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("No overview data.")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<OverviewView {...baseProps} loading={true} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Loading..." });
    expect(button).toBeDisabled();
  });

  it("shows error text", () => {
    render(<OverviewView {...baseProps} error="Oops" />);
    expect(screen.getByText("Oops")).toBeInTheDocument();
  });

  it("renders stats when available and not loading/error", () => {
    const stats: OverviewStats = { totalTodos: 3, completedTodos: 1 };
    render(<OverviewView {...baseProps} stats={stats} />);

    expect(screen.getByText("Total todos: 3")).toBeInTheDocument();
    expect(screen.getByText("Completed todos: 1")).toBeInTheDocument();
  });

  it("calls onReload when reload button is clicked", () => {
    const onReload = vi.fn();
    render(<OverviewView {...baseProps} onReload={onReload} />);

    const button = screen.getByRole("button", { name: "Reload" });
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
```

5. tests/store-and-services.test.tsx
``` jsx
// Zustand store + useTodoService + useOverviewService

import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import {
  renderHook,
  waitFor,
  act,
} from "@testing-library/react";
import {
  useTodoStore,
  useTodoService,
  useOverviewService,
} from "../App";
import {
  resetGraphqlMocks,
  mockGetTodosQuery,
  mockToggleTodoMutation,
  mockGetOverviewQuery,
  todo,
  overview,
} from "./graphqlMocks";

// ----------------- useTodoStore -----------------

describe("useTodoStore (Zustand)", () => {
  beforeEach(() => {
    useTodoStore.setState({
      todos: [],
      loading: false,
      error: undefined,
    });
  });

  it("setTodos updates todos", () => {
    const { setTodos } = useTodoStore.getState();

    setTodos([
      { id: "1", title: "A", completed: false },
      { id: "2", title: "B", completed: true },
    ]);

    expect(useTodoStore.getState().todos).toEqual([
      { id: "1", title: "A", completed: false },
      { id: "2", title: "B", completed: true },
    ]);
  });

  it("setLoading updates loading", () => {
    const { setLoading } = useTodoStore.getState();

    setLoading(true);
    expect(useTodoStore.getState().loading).toBe(true);

    setLoading(false);
    expect(useTodoStore.getState().loading).toBe(false);
  });

  it("setError updates error", () => {
    const { setError } = useTodoStore.getState();

    setError("Oops");
    expect(useTodoStore.getState().error).toBe("Oops");

    setError(undefined);
    expect(useTodoStore.getState().error).toBeUndefined();
  });

  it("updateTodo updates an existing todo", () => {
    useTodoStore.setState({
      todos: [
        { id: "1", title: "A", completed: false },
        { id: "2", title: "B", completed: false },
      ],
      loading: false,
      error: undefined,
    });

    const { updateTodo } = useTodoStore.getState();

    updateTodo({ id: "2", title: "B updated", completed: true });

    expect(useTodoStore.getState().todos).toEqual([
      { id: "1", title: "A", completed: false },
      { id: "2", title: "B updated", completed: true },
    ]);
  });
});

// ----------------- useTodoService -----------------

describe("useTodoService (Apollo + Zustand)", () => {
  beforeEach(() => {
    useTodoStore.setState({
      todos: [],
      loading: false,
      error: undefined,
    });
    resetGraphqlMocks();
  });

  it("syncs Apollo todos into Zustand and exposes them", async () => {
    mockGetTodosQuery({
      data: { todos: [todo({ id: "1", title: "From GraphQL" })] },
    });

    mockToggleTodoMutation();

    const { result } = renderHook(() => useTodoService());

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(1);
      expect(result.current.todos[0].title).toBe("From GraphQL");
    });

    expect(useTodoStore.getState().todos).toHaveLength(1);
  });

  it("maps loading and error from Apollo into store", async () => {
    mockGetTodosQuery({
      data: null,
      loading: true,
      error: new Error("GraphQL failed"),
    });

    mockToggleTodoMutation();

    const { result } = renderHook(() => useTodoService());

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe("GraphQL failed");
    });

    expect(useTodoStore.getState().loading).toBe(true);
    expect(useTodoStore.getState().error).toBe("GraphQL failed");
  });

  it("loadTodos calls Apollo refetch", async () => {
    const { refetch } = mockGetTodosQuery({
      data: { todos: [] },
      loading: false,
    });

    mockToggleTodoMutation();

    const { result } = renderHook(() => useTodoService());

    await act(async () => {
      await result.current.loadTodos();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("toggleTodo calls mutation and updates store", async () => {
    mockGetTodosQuery({
      data: { todos: [todo({ id: "1", title: "From GraphQL" })] },
    });

    const mutationFn = mockToggleTodoMutation(({ id }) => ({
      data: {
        toggleTodo: todo({ id, title: "From GraphQL", completed: true }),
      },
    }));

    const { result } = renderHook(() => useTodoService());

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(1);
    });

    await act(async () => {
      await result.current.toggleTodo("1");
    });

    expect(mutationFn).toHaveBeenCalledWith({ variables: { id: "1" } });

    await waitFor(() => {
      expect(result.current.todos[0].completed).toBe(true);
    });

    expect(useTodoStore.getState().todos[0].completed).toBe(true);
  });
});

// ----------------- useOverviewService -----------------

describe("useOverviewService (Apollo only)", () => {
  beforeEach(() => {
    resetGraphqlMocks();
  });

  it("maps Apollo overview to stats and loading=false", async () => {
    mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 5, completedTodos: 2 }) },
    });

    const { result } = renderHook(() => useOverviewService());

    await waitFor(() => {
      expect(result.current.stats).toEqual({
        totalTodos: 5,
        completedTodos: 2,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });

  it("maps error.message when GraphQL has error", async () => {
    mockGetOverviewQuery({
      data: null,
      loading: false,
      error: new Error("Overview error"),
    });

    const { result } = renderHook(() => useOverviewService());

    await waitFor(() => {
      expect(result.current.error).toBe("Overview error");
    });
  });

  it("reload calls Apollo refetch", async () => {
    const { refetch } = mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 1, completedTodos: 1 }) },
    });

    const { result } = renderHook(() => useOverviewService());

    await act(async () => {
      await result.current.reload();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

6. tests/connected-and-app.test.tsx
``` jsx
// Connected components + root App

import React from "react";
import {
  describe,
  it,
  expect,
  beforeEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";

import {
  TodosConnected,
  OverviewConnected,
  DashboardConnected,
  default as App,
  useTodoStore,
} from "../App";
import {
  resetGraphqlMocks,
  mockGetTodosQuery,
  mockToggleTodoMutation,
  mockGetOverviewQuery,
  todo,
  overview,
} from "./graphqlMocks";

beforeEach(() => {
  useTodoStore.setState({
    todos: [],
    loading: false,
    error: undefined,
  });
  resetGraphqlMocks();
});

// ----------------- TodosConnected -----------------

describe("TodosConnected", () => {
  it("renders todos from Apollo data", async () => {
    mockGetTodosQuery({
      data: { todos: [todo({ id: "1", title: "From GraphQL" })] },
    });

    mockToggleTodoMutation();

    render(<TodosConnected />);

    expect(await screen.findByText("From GraphQL")).toBeInTheDocument();
  });

  it("calls refetch when Reload is clicked", async () => {
    const { refetch } = mockGetTodosQuery({
      data: { todos: [todo({ id: "1", title: "Todo X" })] },
    });

    mockToggleTodoMutation();

    render(<TodosConnected />);

    const reloadButton = await screen.findByRole("button", { name: "Reload" });
    fireEvent.click(reloadButton);

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows error text from Apollo error", async () => {
    mockGetTodosQuery({
      data: null,
      loading: false,
      error: new Error("Todos error"),
    });

    mockToggleTodoMutation();

    render(<TodosConnected />);

    expect(await screen.findByText("Todos error")).toBeInTheDocument();
  });
});

// ----------------- OverviewConnected -----------------

describe("OverviewConnected", () => {
  it("renders overview stats from Apollo data", async () => {
    mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 5, completedTodos: 2 }) },
    });

    render(<OverviewConnected />);

    expect(await screen.findByText("Total todos: 5")).toBeInTheDocument();
    expect(screen.getByText("Completed todos: 2")).toBeInTheDocument();
  });

  it("shows overview error", async () => {
    mockGetOverviewQuery({
      data: null,
      loading: false,
      error: new Error("Overview error"),
    });

    render(<OverviewConnected />);

    expect(await screen.findByText("Overview error")).toBeInTheDocument();
  });

  it("calls refetch when Reload is clicked", async () => {
    const { refetch } = mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 1, completedTodos: 1 }) },
    });

    render(<OverviewConnected />);

    const button = await screen.findByRole("button", { name: "Reload" });
    fireEvent.click(button);

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// ----------------- DashboardConnected -----------------

describe("DashboardConnected", () => {
  it("renders Dashboard title and both sections", async () => {
    mockGetTodosQuery({
      data: { todos: [] },
    });

    mockToggleTodoMutation();

    mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 0, completedTodos: 0 }) },
    });

    render(<DashboardConnected />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });
});

// ----------------- App (root) -----------------

describe("App root", () => {
  it("renders DashboardConnected via App", async () => {
    mockGetTodosQuery({
      data: { todos: [] },
    });

    mockToggleTodoMutation();

    mockGetOverviewQuery({
      data: { overview: overview({ totalTodos: 0, completedTodos: 0 }) },
    });

    render(<App />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
```

Usage 

Assume this is your mock file:

```
// tests/graphqlMocks.ts
export const useGetTodosQuery = vi.fn();
export const useToggleTodoMutation = vi.fn();
export const useGetOverviewQuery = vi.fn();

export const defaultTodo = { id: "1", title: "Default Todo", completed: false };
export const defaultOverview = { totalTodos: 0, completedTodos: 0 };

export function todo(overrides?: Partial<typeof defaultTodo>) { /* ... */ }
export function overview(overrides?: Partial<typeof defaultOverview>) { /* ... */ }

export function mockGetTodosQuery(...) { /* ... */ }
export function mockGetOverviewQuery(...) { /* ... */ }
export function mockToggleTodoMutation(...) { /* ... */ }

export function resetGraphqlMocks() { /* ... */ }
```

1. todo() – building a fake Todo
```
import { todo } from "./graphqlMocks";

// Default todo (no overrides)
const t1 = todo();
/*
t1 is:
{
  id: "1",
  title: "Default Todo",
  completed: false,
}
*/

// Override just the title
const t2 = todo({ title: "Write tests" });
/*
t2 is:
{
  id: "1",              // from default
  title: "Write tests", // overridden
  completed: false,     // from default
}
*/

// Override id and completed
const t3 = todo({ id: "42", completed: true });
/*
t3 is:
{
  id: "42",
  title: "Default Todo",
  completed: true,
}
*/


You’ll usually use todo() inside your mocks or when constructing test data.
```

2. overview() – building fake Overview stats
```
import { overview } from "./graphqlMocks";

// Default overview
const o1 = overview();
/*
o1 is:
{
  totalTodos: 0,
  completedTodos: 0,
}
*/

// Override values
const o2 = overview({ totalTodos: 5, completedTodos: 2 });
/*
o2 is:
{
  totalTodos: 5,
  completedTodos: 2,
}
*/

3. mockGetTodosQuery – mocking useGetTodosQuery

Your component / service does something like:

const { data, loading, error, refetch } = useGetTodosQuery();
```

3.1 Basic usage – default todo
```
import { mockGetTodosQuery } from "./graphqlMocks";

mockGetTodosQuery();

/*
Now, inside your component/hook, useGetTodosQuery() returns:

{
  data: {
    todos: [
      { id: "1", title: "Default Todo", completed: false }
    ]
  },
  loading: false,
  error: undefined,
  refetch: mockFn(), // a vi.fn() you can inspect if needed
}
*/
```

3.2 Custom todos
```
import { mockGetTodosQuery, todo } from "./graphqlMocks";

mockGetTodosQuery({
  data: {
    todos: [
      todo({ id: "1", title: "Read docs" }),
      todo({ id: "2", title: "Write tests", completed: true }),
    ],
  },
});

/*
useGetTodosQuery() now returns:

{
  data: {
    todos: [
      { id: "1", title: "Read docs",  completed: false },
      { id: "2", title: "Write tests", completed: true },
    ]
  },
  loading: false,
  error: undefined,
  refetch: mockFn(),
}
*/
```

3.3 Loading state
```
mockGetTodosQuery({
  loading: true,
});

/*
useGetTodosQuery() now returns:

{
  data: { todos: [ defaultTodo ] }, // we didn't override data
  loading: true,
  error: undefined,
  refetch: mockFn(),
}
*/
```

3.4 Error state
```
mockGetTodosQuery({
  error: new Error("Network failed"),
});

/*
useGetTodosQuery() now returns:

{
  data: { todos: [ defaultTodo ] },
  loading: false,
  error: Error("Network failed"),
  refetch: mockFn(),
}
*/
// In your code you'll usually see error?.message === "Network failed"
```

3.5 Using refetch in expectations
```
const { refetch } = mockGetTodosQuery();

render(<TodosConnected />);

// After some UI action:
expect(refetch).toHaveBeenCalled();
/*
refetch is the same mock function returned by mockGetTodosQuery(),
so you can assert how many times it was called.
*/
```

4. mockGetOverviewQuery – mocking useGetOverviewQuery

Your code calls:
```
const { data, loading, error, refetch } = useGetOverviewQuery();
```

4.1 Basic usage
```
import { mockGetOverviewQuery } from "./graphqlMocks";

mockGetOverviewQuery();

/*
useGetOverviewQuery() returns:

{
  data: {
    overview: {
      totalTodos: 0,
      completedTodos: 0,
    },
  },
  loading: false,
  error: undefined,
  refetch: mockFn(),
}
*/
```
4.2 Custom stats
```
import { mockGetOverviewQuery, overview } from "./graphqlMocks";

mockGetOverviewQuery({
  data: {
    overview: overview({ totalTodos: 10, completedTodos: 4 }),
  },
});

/*
useGetOverviewQuery() returns:

{
  data: {
    overview: {
      totalTodos: 10,
      completedTodos: 4,
    },
  },
  loading: false,
  error: undefined,
  refetch: mockFn(),
}
*/
```

4.3 Error + loading
```
mockGetOverviewQuery({
  data: null,
  loading: true,
  error: new Error("Overview error"),
});

/*
useGetOverviewQuery() returns:

{
  data: null,
  loading: true,
  error: Error("Overview error"),
  refetch: mockFn(),
}
*/
```

5. mockToggleTodoMutation – mocking useToggleTodoMutation

Real code:
```
const [toggleTodoMutation] = useToggleTodoMutation();

const res = await toggleTodoMutation({ variables: { id } });
// res.data.toggleTodo ...
```

5.1 Default behavior (no custom impl)
```
import { mockToggleTodoMutation } from "./graphqlMocks";

const mutationFn = mockToggleTodoMutation();

/*
Inside your component, when it does:
  const [toggleTodoMutation] = useToggleTodoMutation();
  const res = await toggleTodoMutation({ variables: { id: "123" } });

What actually happens:

- toggleTodoMutation is our mockFn.
- It resolves to:

  res = {
    data: {
      toggleTodo: {
        id: "123",
        title: "Default Todo",
        completed: false,
      }
    }
  }

So it echoes back the id, but other fields come from defaultTodo.
*/

// You can also assert:

expect(mutationFn).toHaveBeenCalledWith({
  variables: { id: "123" },
});
```

5.2 Custom mutation result
```
import { mockToggleTodoMutation, todo } from "./graphqlMocks";

const mutationFn = mockToggleTodoMutation(({ id }) => ({
  data: {
    toggleTodo: todo({ id, title: "Updated", completed: true }),
  },
}));

/*
Now, when your component calls:

  const res = await toggleTodoMutation({ variables: { id: "1" } });

res becomes:

{
  data: {
    toggleTodo: {
      id: "1",
      title: "Updated",
      completed: true,
    }
  }
}
*/

// And you can still assert call args:
expect(mutationFn).toHaveBeenCalledWith({
  variables: { id: "1" },
});
```

6. resetGraphqlMocks – clearing everything between tests

You want a “clean slate” for each test file or describe block, so previous mocks don’t leak into new tests.

```
import { beforeEach } from "vitest";
import { resetGraphqlMocks } from "./graphqlMocks";

beforeEach(() => {
  resetGraphqlMocks();
});

/*
This calls .mockReset() on:

- useGetTodosQuery
- useToggleTodoMutation
- useGetOverviewQuery

So each test starts with:
- No previous mockReturnValue
- No previous call history
*/
```

Combine this with resetting Zustand (which you already do) and you get fully isolated tests.

7. Tiny integrated example (putting it together)

Here’s a small, realistic test using several pieces at once:

```
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { TodosConnected } from "../App";
import {
  resetGraphqlMocks,
  mockGetTodosQuery,
  mockToggleTodoMutation,
  todo,
} from "./graphqlMocks";

describe("TodosConnected (example)", () => {
  beforeEach(() => {
    resetGraphqlMocks();
  });

  it("renders todos from mocked GraphQL and toggles one", async () => {
    // 1) Mock initial todos
    mockGetTodosQuery({
      data: {
        todos: [
          todo({ id: "1", title: "From GraphQL", completed: false }),
        ],
      },
    });

    // 2) Mock the mutation result when toggling
    const mutationFn = mockToggleTodoMutation(({ id }) => ({
      data: {
        toggleTodo: todo({ id, title: "From GraphQL", completed: true }),
      },
    }));

    // 3) Render connected component
    render(<TodosConnected />);

    // 4) It should show our mocked todo title
    const checkbox = await screen.findByLabelText("From GraphQL");
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    // 5) Click checkbox -> triggers mutation
    fireEvent.click(checkbox);

    // 6) Mutation was called with correct variables
    expect(mutationFn).toHaveBeenCalledWith({
      variables: { id: "1" },
    });

    // 7) After mutation, the checkbox should be checked
    const updated = screen.getByLabelText("From GraphQL") as HTMLInputElement;
    expect(updated.checked).toBe(true);
  });
});
```
