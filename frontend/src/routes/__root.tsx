import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Toaster } from "sonner";

import { themeAtom } from "@/store/atoms";

function RootLayout() {
  const theme = useAtomValue(themeAtom);

  return (
    <>
      <Outlet />
      <Toaster position="top-center" theme={theme} />
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
