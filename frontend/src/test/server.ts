// template-managed (bootstrap): do not edit; handlers live in handlers.ts.
// Delete this line to take ownership.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
