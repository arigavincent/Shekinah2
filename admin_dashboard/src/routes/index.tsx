import { createFileRoute } from "@tanstack/react-router";
import AdminApp from "../admin/AdminApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shekinah Admin Console" },
      { name: "description", content: "Editorial admin console for managing Shekinah content, care, and operations." },
    ],
  }),
  component: AdminApp,
});
