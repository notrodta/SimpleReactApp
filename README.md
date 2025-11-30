✅ 1. Example GraphQL Query Types (from Codegen)
---------------------------------------------------------
```
GetTodosQuery
export type GetTodosQuery = {
  todos: {
    id: string;
    title: string;
    completed: boolean;
    __typename: "Todo";
    metadata?: {
      priority?: "low" | "medium" | "high";
      tags?: string[];
    } | null;
  }[];
};

GetOverviewQuery
export type GetOverviewQuery = {
  overview: {
    totalTodos: number;
    completedTodos: number;
    pendingTodos: number;
    __typename: "OverviewStats";
    extra?: {
      lastUpdated?: string;
    } | null;
  };
};
```
---------------------------------------------------------
✅ 2. Mock Data Builders (ts-auto-mock + deep merge)
---------------------------------------------------------
🔵 buildGetTodosData.ts
```
// tests/factories/buildGetTodosData.ts
import { createMock } from "ts-auto-mock";
import merge from "lodash.merge";
import type { GetTodosQuery } from "../__generated__/graphql";

export const buildGetTodosData = (
  overrides: Partial<GetTodosQuery> = {}
): GetTodosQuery => {
  const base = createMock<GetTodosQuery>();

  const defaults: GetTodosQuery = merge({}, base, {
    todos: [
      {
        id: "todo-1",
        title: "Buy milk",
        completed: false,
        __typename: "Todo",
        metadata: {
          priority: "medium",
          tags: ["groceries"],
        },
      },
      {
        id: "todo-2",
        title: "Write tests",
        completed: true,
        __typename: "Todo",
        metadata: {
          priority: "high",
          tags: ["work"],
        },
      },
    ],
  });

  return merge({}, defaults, overrides);
};

🔵 buildGetOverviewData.ts
// tests/factories/buildGetOverviewData.ts
import { createMock } from "ts-auto-mock";
import merge from "lodash.merge";
import type { GetOverviewQuery } from "../__generated__/graphql";

export const buildGetOverviewData = (
  overrides: Partial<GetOverviewQuery> = {}
): GetOverviewQuery => {
  const base = createMock<GetOverviewQuery>();

  const defaults: GetOverviewQuery = merge({}, base, {
    overview: {
      totalTodos: 2,
      completedTodos: 1,
      pendingTodos: 1,
      __typename: "OverviewStats",
      extra: {
        lastUpdated: "2025-01-01T12:00:00Z",
      },
    },
  });

  return merge({}, defaults, overrides);
};
```
---------------------------------------------------------
✅ 3. Example Test Usage
---------------------------------------------------------
✔ Todos Test
```
// tests/Todos.test.tsx
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildGetTodosData } from "./factories/buildGetTodosData";

const useGetTodosQueryMock = vi.fn();

vi.mock("../__generated__/graphql", () => ({
  useGetTodosQuery: useGetTodosQueryMock,
}));

import { Todos } from "../Todos";

test("renders default todos", () => {
  useGetTodosQueryMock.mockReturnValue({
    data: buildGetTodosData(),
    loading: false,
    error: undefined,
  });

  render(<Todos />);

  expect(screen.getByText("Buy milk")).toBeInTheDocument();
  expect(screen.getByText("Write tests")).toBeInTheDocument();
});

test("overrides nested todo metadata", () => {
  useGetTodosQueryMock.mockReturnValue({
    data: buildGetTodosData({
      todos: [
        {
          id: "999",
          title: "Urgent Task",
          completed: false,
          metadata: { priority: "high" },
        },
      ],
    }),
    loading: false,
    error: undefined,
  });

  render(<Todos />);

  expect(screen.getByText("Urgent Task")).toBeInTheDocument();
});

✔ Overview Test
// tests/Overview.test.tsx
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildGetOverviewData } from "./factories/buildGetOverviewData";

const useGetOverviewQueryMock = vi.fn();

vi.mock("../__generated__/graphql", () => ({
  useGetOverviewQuery: useGetOverviewQueryMock,
}));

import { Overview } from "../Overview";

test("renders default overview stats", () => {
  useGetOverviewQueryMock.mockReturnValue({
    data: buildGetOverviewData(),
    loading: false,
    error: undefined,
  });

  render(<Overview />);

  expect(screen.getByText(/2 total/i)).toBeInTheDocument();
});

test("overrides nested overview fields", () => {
  useGetOverviewQueryMock.mockReturnValue({
    data: buildGetOverviewData({
      overview: {
        totalTodos: 10,
        completedTodos: 7,
        pendingTodos: 3,
        extra: {
          lastUpdated: "2025-11-27",
        },
      },
    }),
    loading: false,
    error: undefined,
  });

  render(<Overview />);

  expect(screen.getByText(/10 total/i)).toBeInTheDocument();
});
```
---------------------------------------------------------
✅ 4. RFC Bullet Points (Why We Do This)
---------------------------------------------------------

These are ready to paste directly into your RFC.

Why This Mocking Strategy Works Well

Mocking of generated hooks stays local to each test file, keeping setup explicit and easy to understand.

Data builders generate full GraphQL results using ts-auto-mock, ensuring that the mock data always remains fully typed and structurally complete.

Deep merge allows us to override only the fields we care about, while the rest of the GraphQL result is auto-filled or retained from defaults.

Meaningful default values keep our component tests readable, requiring minimal overrides for common UI scenarios.

As the schema grows, newly added nested fields are automatically included by ts-auto-mock, requiring no modifications to existing tests.

Tests remain small and expressive, focusing on behavior rather than maintaining bulky mock objects.

This pattern scales with complexity while staying simple to use for everyday testing needs.
