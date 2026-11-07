import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { createQueryClient } from "../lib/queryClient";
import { AuthProvider } from "../features/auth/AuthProvider";

/** Рендер страницы со всеми провайдерами и роутером в памяти. */
export function renderAt(path: string, routes: RouteObject[]) {
  const router = createMemoryRouter([...routes, { path: "*", element: <p>другая страница</p> }], {
    initialEntries: [path],
  });
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return {
    router,
    ...render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/** Подменяет fetch: обработчик получает метод и путь, возвращает ответ. */
export function mockFetch(handler: (method: string, path: string, body: unknown) => Reply) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url, "http://localhost");
    const text = req.method === "GET" ? "" : await req.text();
    const reply = handler(req.method, url.pathname, text ? JSON.parse(text) : undefined);
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json", ...reply.headers },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
