import { createBrowserRouter } from "react-router";
import AuthenticatedApp from "./AuthenticatedApp";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

const authenticatedRoute = (path: string) => ({
  path,
  Component: AuthenticatedApp,
  ErrorBoundary: RouteErrorBoundary,
});

const authenticatedRoutes = (path: string) => {
  const routes = [authenticatedRoute(path)];
  const shouldAddTrailingSlashAlias =
    path !== '/' &&
    path !== '*' &&
    !path.endsWith('/') &&
    !path.endsWith('/*');

  return shouldAddTrailingSlashAlias
    ? [...routes, authenticatedRoute(`${path}/`)]
    : routes;
};

export const router = createBrowserRouter([
  ...authenticatedRoutes("/login"),
  ...authenticatedRoutes("/"),
  ...authenticatedRoutes("/app/*"),
  ...authenticatedRoutes("/dashboard"),
  ...authenticatedRoutes("/ads/*"),
  ...authenticatedRoutes("/affiliates"),
  ...authenticatedRoutes("/leads/*"),
  ...authenticatedRoutes("/orders"),
  ...authenticatedRoutes("/reports/*"),
  ...authenticatedRoutes("/schedule"),
  ...authenticatedRoutes("/technician/*"),
  ...authenticatedRoutes("/monitoring/*"),
  ...authenticatedRoutes("/map"),
  ...authenticatedRoutes("/profile"),
  ...authenticatedRoutes("/finance/*"),
  ...authenticatedRoutes("/inventory/*"),
  ...authenticatedRoutes("/master-data"),
  ...authenticatedRoutes("/users"),
  ...authenticatedRoutes("/settings/*"),
  ...authenticatedRoutes("/audit-logs"),
  ...authenticatedRoutes("/conversations/*"),
  ...authenticatedRoutes("/whatsapp"),
  ...authenticatedRoutes("/whatsapp/*"),
  ...authenticatedRoutes("/proof-assets"),
  {
    path: "/booking",
    ErrorBoundary: RouteErrorBoundary,
    lazy: async () => {
      const { PublicBookingPage } = await import("./pages/affiliates/PublicBookingPage");
      return { Component: PublicBookingPage };
    },
  },
  {
    path: "/embed/form/:identifier",
    ErrorBoundary: RouteErrorBoundary,
    lazy: async () => {
      const { PublicEmbedLeadFormPage } = await import("./pages/embed/PublicEmbedLeadFormPage");
      return { Component: PublicEmbedLeadFormPage };
    },
  },
  ...authenticatedRoutes("*"),
]);
