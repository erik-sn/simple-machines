// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { type InitialEntry, MemoryRouter } from "react-router";
import { type AppStore, type RootState, setupStore } from "../store/store";
import "../i18n";

interface Options extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  // Where the component is rendered: a path, or an entry with state.
  route?: InitialEntry;
}

// A fresh store per test (never the app singleton), a MemoryRouter at the
// given route, and i18n. Returns the store for asserting on state.
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = setupStore(preloadedState),
    route = "/",
    ...renderOptions
  }: Options = {},
) {
  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>,
    renderOptions,
  );
  return { store, ...result };
}
