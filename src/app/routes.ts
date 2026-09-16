import { createBrowserRouter } from "react-router";
import AuthenticatedApp from "./AuthenticatedApp";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

const authenticatedRoute = (path: string) => ({
  path,
  Component: AuthenticatedApp,
  ErrorBoundary: RouteErrorBoundary,
});

export const router = createBrowserRouter([
  authenticatedRoute("/login"),
  authenticatedRoute("/"),
  authenticatedRoute("/app/*"),
  authenticatedRoute("/dashboard"),
  authenticatedRoute("/ads/*"),
  authenticatedRoute("/affiliates"),
  authenticatedRoute("/leads/*"),
  authenticatedRoute("/orders"),
  authenticatedRoute("/reports/*"),
  authenticatedRoute("/schedule"),
  authenticatedRoute("/technician/*"),
  authenticatedRoute("/monitoring/*"),
  authenticatedRoute("/map"),
  authenticatedRoute("/profile"),
  authenticatedRoute("/finance/*"),
  authenticatedRoute("/inventory/*"),
  authenticatedRoute("/master-data"),
  authenticatedRoute("/users"),
  authenticatedRoute("/settings/*"),
  authenticatedRoute("/audit-logs"),
  authenticatedRoute("/conversations/*"),
  authenticatedRoute("/whatsapp"),
  authenticatedRoute("/whatsapp/*"),
  authenticatedRoute("/proof-assets"),
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
  authenticatedRoute("*"),
]);
