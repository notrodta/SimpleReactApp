```
// App.tsx
import React from "react";
import { create } from "zustand";

// =======================
// Domain Types
// =======================

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

export type OverviewStats = {
  totalTodos: number;
  completedTodos: number;
};

// =======================
// Apollo Codegen Hooks
// (Adjust import path & hook names to your project)
// =======================
import {
  useGetTodosQuery,
  useToggleTodoMutation,
  useGetOverviewQuery,
} from "./__generated__/graphql";

// =======================
// ZUSTAND STORE
// Shared todos + loading + error
// =======================

type TodoState = {
  todos: Todo[];
  loading: boolean;
  error?: string;

  setTodos: (todos: Todo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (err?: string) => void;
  updateTodo: (todo: Todo) => void;
};

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  loading: false,
  error: undefined,

  setTodos(todos) {
    set({ todos });
  },

  setLoading(loading) {
    set({ loading });
  },

  setError(error) {
    set({ error });
  },

  updateTodo(todo) {
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === todo.id ? todo : t
      ),
    }));
  },
}));

// =======================
// SERVICE: TODOS (Apollo + Zustand)
// Thin facade for DIP
// =======================

export type TodoService = {
  todos: Todo[];
  loading: boolean;
  error?: string;
  loadTodos: () => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
};

export function useTodoService(): TodoService {
  // ---- Apollo hooks ----
  const {
    data,
    loading: apolloLoading,
    error: apolloError,
    refetch,
  } = useGetTodosQuery({
    notifyOnNetworkStatusChange: true,
  });

  const [toggleTodoMutation] = useToggleTodoMutation();

  // ---- Zustand mutators ----
  const setTodos = useTodoStore((s) => s.setTodos);
  const setLoading = useTodoStore((s) => s.setLoading);
  const setError = useTodoStore((s) => s.setError);
  const updateTodo = useTodoStore((s) => s.updateTodo);

  // Sync Apollo → Zustand: todos
  React.useEffect(() => {
    if (data?.todos) {
      setTodos(
        data.todos.map((t) => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
        }))
      );
    }
  }, [data, setTodos]);

  // Sync Apollo → Zustand: loading
  React.useEffect(() => {
    setLoading(apolloLoading);
  }, [apolloLoading, setLoading]);

  // Sync Apollo → Zustand: error
  React.useEffect(() => {
    setError(apolloError ? apolloError.message : undefined);
  }, [apolloError, setError]);

  // ---- UI-facing state ----
  const todos = useTodoStore((s) => s.todos);
  const loading = useTodoStore((s) => s.loading);
  const error = useTodoStore((s) => s.error);

  async function loadTodos() {
    await refetch();
  }

  async function toggleTodo(id: string) {
    const res = await toggleTodoMutation({ variables: { id } });

    const updated = res.data?.toggleTodo;
    if (updated) {
      updateTodo({
        id: updated.id,
        title: updated.title,
        completed: updated.completed,
      });
    }
  }

  return {
    todos,
    loading,
    error,
    loadTodos,
    toggleTodo,
  };
}

// =======================
// SERVICE: OVERVIEW (Apollo only, no Zustand)
// =======================

export type OverviewService = {
  stats?: OverviewStats;
  loading: boolean;
  error?: string;
  reload: () => Promise<void>;
};

export function useOverviewService(): OverviewService {
  const { data, loading, error, refetch } = useGetOverviewQuery();

  const stats: OverviewStats | undefined = data?.overview
    ? {
        totalTodos: data.overview.totalTodos,
        completedTodos: data.overview.completedTodos,
      }
    : undefined;

  async function reload() {
    await refetch();
  }

  return {
    stats,
    loading,
    error: error?.message,
    reload,
  };
}

// =======================
// MICRO CONTEXT for Todos UI
// (UI-only: no Apollo/Zustand here)
// =======================

export type TodosUiContextValue = {
  todos: Todo[];
  loading: boolean;
  error?: string;
  onToggle(id: string): void;
  onReload(): void;
};

const TodosUiContext = React.createContext<TodosUiContextValue | undefined>(
  undefined
);

export function TodosUiProvider({
  value,
  children,
}: {
  value: TodosUiContextValue;
  children: React.ReactNode;
}) {
  return (
    <TodosUiContext.Provider value={value}>
      {children}
    </TodosUiContext.Provider>
  );
}

export function useTodosUi() {
  const ctx = React.useContext(TodosUiContext);
  if (!ctx) {
    throw new Error("useTodosUi must be used within a TodosUiProvider");
  }
  return ctx;
}

// =======================
// PURE UI: TodosView (entry point for Storybook)
// =======================

export type TodosViewProps = {
  todos: Todo[];
  loading: boolean;
  error?: string;
  onToggle(id: string): void;
  onReload(): void;
};

export function TodosView(props: TodosViewProps) {
  return (
    <TodosUiProvider value={props}>
      <TodosLayout />
    </TodosUiProvider>
  );
}

// =======================
// Nested UI under micro context
// =======================

export function TodosLayout() {
  const { error, loading } = useTodosUi();

  return (
    <section style={{ padding: 16, maxWidth: 400 }}>
      <h2>Todos</h2>

      <TodosToolbar />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <TodosList />

      {loading && <p>Loading...</p>}
    </section>
  );
}

export function TodosToolbar() {
  const { loading, onReload } = useTodosUi();

  const handleReloadClick = React.useCallback(() => {
    // UI-only logic on top of the service callback
    console.log("[TodosToolbar] Reload clicked");
    // e.g. analytics, toast, etc...
    onReload();
  }, [onReload]);

  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={handleReloadClick} disabled={loading}>
        {loading ? "Loading..." : "Reload"}
      </button>
    </div>
  );
}

export function TodosList() {
  const { todos, loading } = useTodosUi();

  if (!loading && todos.length === 0) {
    return <p>No todos yet.</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {todos.map((t) => (
        <TodoRow key={t.id} todo={t} />
      ))}
    </ul>
  );
}

export function TodoRow({ todo }: { todo: Todo }) {
  const { onToggle } = useTodosUi();

  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
        />
        <span
          style={{
            marginLeft: 8,
            textDecoration: todo.completed ? "line-through" : "none",
          }}
        >
          {todo.title}
        </span>
      </label>
    </li>
  );
}

// =======================
// PURE UI: Overview
// =======================

export type OverviewViewProps = {
  stats?: OverviewStats;
  loading: boolean;
  error?: string;
  onReload(): void;
};

export function OverviewView({
  stats,
  loading,
  error,
  onReload,
}: OverviewViewProps) {
  return (
    <section style={{ padding: 16, maxWidth: 300 }}>
      <h2>Overview</h2>

      <button onClick={onReload} disabled={loading}>
        {loading ? "Loading..." : "Reload"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && !error && !stats && <p>No overview data.</p>}

      {stats && !loading && !error && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>Total todos: {stats.totalTodos}</li>
          <li>Completed todos: {stats.completedTodos}</li>
        </ul>
      )}
    </section>
  );
}

// =======================
// CONNECTED COMPONENTS
// =======================

export function TodosConnected() {
  const { todos, loading, error, loadTodos, toggleTodo } = useTodoService();

  return (
    <TodosView
      todos={todos}
      loading={loading}
      error={error}
      onToggle={toggleTodo}
      onReload={loadTodos}
    />
  );
}

export function OverviewConnected() {
  const { stats, loading, error, reload } = useOverviewService();

  return (
    <OverviewView
      stats={stats}
      loading={loading}
      error={error}
      onReload={reload}
    />
  );
}

// =======================
// DASHBOARD + APP ROOT
// =======================

export function DashboardConnected() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Dashboard</h1>
      <div style={{ display: "flex", gap: 24 }}>
        <TodosConnected />
        <OverviewConnected />
      </div>
    </div>
  );
}

export default function App() {
  return <DashboardConnected />;
}
```
