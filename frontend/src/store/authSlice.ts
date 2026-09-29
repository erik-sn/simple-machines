// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadTokens, type StoredTokens } from "../auth/tokens";

export interface AuthState {
  access: string | null;
  refresh: string | null;
}

const stored = loadTokens();

const initialState: AuthState = {
  access: stored?.access ?? null,
  refresh: stored?.refresh ?? null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Persistence is explicit at the call sites (tokens.ts), never a reducer
    // side effect.
    setCredentials: (state, action: PayloadAction<StoredTokens>) => {
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
    },
    clearCredentials: (state) => {
      state.access = null;
      state.refresh = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
