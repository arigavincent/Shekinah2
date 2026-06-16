import { createFileRoute } from "@tanstack/react-router";
import AdminApp from "../admin/AdminApp";

// Splat route: hand every non-root path to the admin dashboard's
// internal react-router so its existing routing (and business logic)
// keeps working unchanged.
export const Route = createFileRoute("/$")({
  component: AdminApp,
});
