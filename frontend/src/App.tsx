import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./features/auth/AuthProvider";
import { createQueryClient } from "./lib/queryClient";
import { createRouter } from "./router";

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createRouter);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
