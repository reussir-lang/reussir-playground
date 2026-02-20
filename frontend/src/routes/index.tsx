import { createFileRoute } from "@tanstack/react-router";
import { Playground } from "@/components/playground";

export const Route = createFileRoute("/")({
  component: Playground,
});
