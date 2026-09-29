// Default MSW handlers: the backend's shapes for the endpoints the screens
// use. A test that needs another response overrides with server.use(...);
// handlers reset after every test (src/test/setup.ts).
import { HttpResponse, http } from "msw";
import type {
  FlagsResponse,
  NoteRead,
  PaginatedNoteListListRead,
  TokenObtainPairRead,
} from "../store/generatedApi";

export const notes: NoteRead[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "First note",
    body: "Body of first note.",
    word_count: 4,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Second note",
    body: "Body of second note.",
    word_count: null,
    created_at: "2026-09-02T11:30:00Z",
    updated_at: "2026-09-02T11:30:00Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Third note",
    body: "Body of third note.",
    word_count: 1,
    created_at: "2026-09-03T12:00:00Z",
    updated_at: "2026-09-03T12:00:00Z",
    created_by: null,
    updated_by: null,
  },
];

const PAGE_SIZE = 2;

// Two pages, like the backend's PageNumberPagination: absolute next and
// previous URLs, null at the ends. List rows are NoteListRead (no body); the
// detail fixtures carry the extra field, which the list type tolerates.
export function notesPage(page: number): PaginatedNoteListListRead {
  const start = (page - 1) * PAGE_SIZE;
  const pages = Math.ceil(notes.length / PAGE_SIZE);
  const url = (n: number) => `http://localhost:3000/api/v1/notes/?page=${n}`;
  return {
    count: notes.length,
    next: page < pages ? url(page + 1) : null,
    previous: page > 1 ? url(page - 1) : null,
    results: notes.slice(start, start + PAGE_SIZE),
  };
}

export const tokens: TokenObtainPairRead = {
  access: "access-token",
  refresh: "refresh-token",
};

export const handlers = [
  http.post("/api/v1/auth/token/", () => HttpResponse.json(tokens)),
  // The defaults example/flags.py declares.
  http.get("/api/v1/flags/", () =>
    HttpResponse.json<FlagsResponse>({
      flags: { notes: true, "example-banner": false },
    }),
  ),
  http.get("/api/v1/notes/", ({ request }) => {
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    return HttpResponse.json(notesPage(page));
  }),
];
