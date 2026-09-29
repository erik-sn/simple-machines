// template-managed (bootstrap): do not edit; add project slices to the
// reducer map via ownership takeover or keep state in RTK Query. Delete this
// line to take ownership.
import {
  combineReducers,
  configureStore,
  createSelector,
  type ThunkAction,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { authSlice } from "./authSlice";
import { baseApi } from "./baseApi";

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

// Tests build a fresh store per test with setupStore(preloadedState); the app
// mounts the singleton below.
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
    devTools: import.meta.env.DEV,
  });
}

export const store = setupStore();

export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<Result = void> = ThunkAction<
  Result,
  RootState,
  unknown,
  UnknownAction
>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
// Derived values shared by several components live at module scope as
// memoized selectors; a selector returning a fresh object re-renders forever.
export const createAppSelector = createSelector.withTypes<RootState>();
