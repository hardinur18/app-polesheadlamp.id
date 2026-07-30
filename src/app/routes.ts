import { createBrowserRouter } from "react-router";
import AuthenticatedApp from "./AuthenticatedApp";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: AuthenticatedApp,
  },
  {
    path: "/",
    Component: AuthenticatedApp,
  },
  {
    path: "/app/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/dashboard",
    Component: AuthenticatedApp,
  },
  {
    path: "/ads/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/affiliates",
    Component: AuthenticatedApp,
  },
  {
    path: "/leads/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/orders",
    Component: AuthenticatedApp,
  },
  {
    path: "/reports/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/schedule",
    Component: AuthenticatedApp,
  },
  {
    path: "/technician/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/monitoring/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/map",
    Component: AuthenticatedApp,
  },
  {
    path: "/profile",
    Component: AuthenticatedApp,
  },
  {
    path: "/finance/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/inventory/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/master-data",
    Component: AuthenticatedApp,
  },
  {
    path: "/users",
    Component: AuthenticatedApp,
  },
  {
    path: "/settings/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/audit-logs",
    Component: AuthenticatedApp,
  },
  {
    path: "/conversations/*",
    Component: AuthenticatedApp,
  },
  {
    path: "/booking",
    lazy: async () => {
      const { PublicBookingPage } = await import("./pages/affiliates/PublicBookingPage");
      return { Component: PublicBookingPage };
    },
  },
  {
    path: "/embed/form/:identifier",
    lazy: async () => {
      const { PublicEmbedLeadFormPage } = await import("./pages/embed/PublicEmbedLeadFormPage");
      return { Component: PublicEmbedLeadFormPage };
    },
  },
  {
    path: "/payment-gateway-preview",
    lazy: async () => {
      const { PaymentGatewayPreviewPage } = await import("./pages/orders/PaymentGatewayPreviewPage");
      return { Component: PaymentGatewayPreviewPage };
    },
  },
  {
    path: "*",
    Component: AuthenticatedApp,
  }
]);
