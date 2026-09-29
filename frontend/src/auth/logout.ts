// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { clearCredentials } from "../store/authSlice";
import { baseApi } from "../store/baseApi";
import type { AppThunk } from "../store/store";
import { clearTokens } from "./tokens";

// The one way to end a session: tokens, credentials, and the query cache go
// together so the next user never sees this one's data. RequireAuth then
// redirects to the sign-in screen. baseApi runs the same steps when a token
// refresh fails.
export function logout(): AppThunk {
  return (dispatch) => {
    clearTokens();
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
  };
}
