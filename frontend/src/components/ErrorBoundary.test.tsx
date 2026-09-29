// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Screen({ crash }: { crash: boolean }) {
  if (crash) {
    throw new Error("render failed");
  }
  return <p>Rendered fine</p>;
}

function retryButton(reset: () => void): ReactNode {
  return (
    <button type="button" onClick={reset}>
      Try again
    </button>
  );
}

test("renders the fallback for a render error and can try again", async () => {
  // React reports the caught error through console.error; keep the output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  const { rerender } = render(
    <ErrorBoundary fallback={retryButton}>
      <Screen crash={true} />
    </ErrorBoundary>,
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.queryByText("Rendered fine")).not.toBeInTheDocument();

  // The cause is gone; the boundary still shows the fallback until reset.
  rerender(
    <ErrorBoundary fallback={retryButton}>
      <Screen crash={false} />
    </ErrorBoundary>,
  );
  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(screen.getByText("Rendered fine")).toBeInTheDocument();
});
