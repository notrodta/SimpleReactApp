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

  // ---- Zustand mutators (each selected separately) ----
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

  // ---- UI-facing state (each selected separately) ----
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
// PURE UI COMPONENTS
// =======================

export type TodosViewProps = {
  todos: Todo[];
  loading: boolean;
  error?: string;
  onToggle(id: string): void;
  onReload(): void;
};

export function TodosView({
  todos,
  loading,
  error,
  onToggle,
  onReload,
}: TodosViewProps) {
  return (
    <section style={{ padding: 16, maxWidth: 400 }}>
      <h2>Todos</h2>

      <button onClick={onReload} disabled={loading}>
        {loading ? "Loading..." : "Reload"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {todos.length === 0 && !loading && <p>No todos yet.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {todos.map((t) => (
          <li key={t.id}>
            <label>
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => onToggle(t.id)}
              />
              <span
                style={{
                  marginLeft: 8,
                  textDecoration: t.completed ? "line-through" : "none",
                }}
              >
                {t.title}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
// DASHBOARD
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

// =======================
// APP ROOT
// =======================

export default function App() {
  return <DashboardConnected />;
}

S – Single Responsibility

useTodoStore → manages todo client state only.

useTodoService → coordinates Apollo + Zustand + domain mapping.

TodosView / OverviewView → render-only UI.

TodosConnected / OverviewConnected / DashboardConnected → wiring/layout.
Each piece has one clear reason to change.

O – Open/Closed

You can add new features (e.g. “archive todo”, extra fields on Todo, new views) by extending services, store, or adding new connected/pure components without changing existing UI contracts (TodosViewProps, OverviewViewProps, TodoService shape).

L – Liskov Substitution

Anything that pretends to be a TodoService or OverviewService (mock, different backend, React Query instead of Apollo, etc.) can be swapped in and the connected components still work, as long as they return the same shape.

I – Interface Segregation

UI only gets what it needs: TodosView doesn’t know about Apollo, Zustand, or mutators; it just gets todos, loading, error, and callbacks. Same for OverviewView. No “fat interface” leaking infra concerns into the UI.

D – Dependency Inversion

React components depend on abstract service shapes (useTodoService, useOverviewService) and props contracts, not on the concrete data layer (Apollo, Zustand, GraphQL documents).

If you rewired useTodoService to REST, React Query, or mocked data, the UI wouldn’t need to change.

So yes: even without use
