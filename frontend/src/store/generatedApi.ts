import { baseApi as api } from "./baseApi";
export const addTagTypes = [
    "auth",
    "flags",
    "health",
    "notes",
    "ready",
] as const;
const injectedRtkApi = api
    .enhanceEndpoints({
        addTagTypes,
    })
    .injectEndpoints({
        endpoints: (build) => ({
            authTokenCreate: build.mutation<
                AuthTokenCreateApiResponse,
                AuthTokenCreateApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/auth/token/`,
                    method: "POST",
                    body: queryArg.tokenObtainPairRequest,
                }),
                invalidatesTags: ["auth"],
            }),
            authTokenRefreshCreate: build.mutation<
                AuthTokenRefreshCreateApiResponse,
                AuthTokenRefreshCreateApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/auth/token/refresh/`,
                    method: "POST",
                    body: queryArg.tokenRefreshRequest,
                }),
                invalidatesTags: ["auth"],
            }),
            flags: build.query<FlagsApiResponse, FlagsApiArg>({
                query: () => ({ url: `/api/v1/flags/` }),
                providesTags: ["flags"],
            }),
            health: build.query<HealthApiResponse, HealthApiArg>({
                query: () => ({ url: `/api/v1/health/` }),
                providesTags: ["health"],
            }),
            notesList: build.query<NotesListApiResponse, NotesListApiArg>({
                query: (queryArg) => ({
                    url: `/api/v1/notes/`,
                    params: {
                        created_by: queryArg.createdBy,
                        ordering: queryArg.ordering,
                        page: queryArg.page,
                        page_size: queryArg.pageSize,
                        search: queryArg.search,
                    },
                }),
                providesTags: ["notes"],
            }),
            notesCreate: build.mutation<
                NotesCreateApiResponse,
                NotesCreateApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/notes/`,
                    method: "POST",
                    body: queryArg.noteRequest,
                }),
                invalidatesTags: ["notes"],
            }),
            notesRetrieve: build.query<
                NotesRetrieveApiResponse,
                NotesRetrieveApiArg
            >({
                query: (queryArg) => ({ url: `/api/v1/notes/${queryArg.id}/` }),
                providesTags: ["notes"],
            }),
            notesUpdate: build.mutation<
                NotesUpdateApiResponse,
                NotesUpdateApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/notes/${queryArg.id}/`,
                    method: "PUT",
                    body: queryArg.noteRequest,
                }),
                invalidatesTags: ["notes"],
            }),
            notesPartialUpdate: build.mutation<
                NotesPartialUpdateApiResponse,
                NotesPartialUpdateApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/notes/${queryArg.id}/`,
                    method: "PATCH",
                    body: queryArg.patchedNoteRequest,
                }),
                invalidatesTags: ["notes"],
            }),
            notesDestroy: build.mutation<
                NotesDestroyApiResponse,
                NotesDestroyApiArg
            >({
                query: (queryArg) => ({
                    url: `/api/v1/notes/${queryArg.id}/`,
                    method: "DELETE",
                }),
                invalidatesTags: ["notes"],
            }),
            ready: build.query<ReadyApiResponse, ReadyApiArg>({
                query: () => ({ url: `/api/v1/ready/` }),
                providesTags: ["ready"],
            }),
        }),
        overrideExisting: false,
    });
export { injectedRtkApi as generatedApi };
export type AuthTokenCreateApiResponse = /** status 200  */ TokenObtainPairRead;
export type AuthTokenCreateApiArg = {
    tokenObtainPairRequest: TokenObtainPairRequestWrite;
};
export type AuthTokenRefreshCreateApiResponse =
    /** status 200  */ TokenRefreshRead;
export type AuthTokenRefreshCreateApiArg = {
    tokenRefreshRequest: TokenRefreshRequest;
};
export type FlagsApiResponse = /** status 200  */ FlagsResponse;
export type FlagsApiArg = void;
export type HealthApiResponse = /** status 200  */ HealthResponse;
export type HealthApiArg = void;
export type NotesListApiResponse = /** status 200  */ PaginatedNoteListListRead;
export type NotesListApiArg = {
    createdBy?: string;
    /** Which field to use when ordering the results. */
    ordering?: string;
    /** A page number within the paginated result set. */
    page?: number;
    /** Number of results to return per page. */
    pageSize?: number;
    /** A search term. */
    search?: string;
};
export type NotesCreateApiResponse = /** status 201  */ NoteRead;
export type NotesCreateApiArg = {
    noteRequest: NoteRequest;
};
export type NotesRetrieveApiResponse = /** status 200  */ NoteRead;
export type NotesRetrieveApiArg = {
    /** A UUID string identifying this note. */
    id: string;
};
export type NotesUpdateApiResponse = /** status 200  */ NoteRead;
export type NotesUpdateApiArg = {
    /** A UUID string identifying this note. */
    id: string;
    noteRequest: NoteRequest;
};
export type NotesPartialUpdateApiResponse = /** status 200  */ NoteRead;
export type NotesPartialUpdateApiArg = {
    /** A UUID string identifying this note. */
    id: string;
    patchedNoteRequest: PatchedNoteRequest;
};
export type NotesDestroyApiResponse = unknown;
export type NotesDestroyApiArg = {
    /** A UUID string identifying this note. */
    id: string;
};
export type ReadyApiResponse = /** status 200  */ ReadyResponse;
export type ReadyApiArg = void;
export type TokenObtainPair = {};
export type TokenObtainPairRead = {
    access: string;
    refresh: string;
};
export type ErrorResponse = {
    type: "validation_error" | "client_error" | "server_error";
    errors: {
        code: string;
        detail: string;
        attr: string | null;
    }[];
};
export type TokenObtainPairRequest = {};
export type TokenObtainPairRequestWrite = {
    username: string;
    password: string;
};
export type TokenRefresh = {
    refresh: string;
};
export type TokenRefreshRead = {
    access: string;
    refresh: string;
};
export type TokenRefreshRequest = {
    refresh: string;
};
export type FlagsResponse = {
    flags: {
        [key: string]: boolean;
    };
};
export type HealthResponse = {
    status: string;
};
export type NoteList = {
    title: string;
};
export type NoteListRead = {
    title: string;
    /** Words in body; NULL until count_words has run. */
    word_count: number | null;
    id: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
};
export type PaginatedNoteListList = {
    count: number;
    next?: string | null;
    previous?: string | null;
    results: NoteList[];
};
export type PaginatedNoteListListRead = {
    count: number;
    next?: string | null;
    previous?: string | null;
    results: NoteListRead[];
};
export type Note = {
    title: string;
    body?: string;
};
export type NoteRead = {
    title: string;
    body?: string;
    /** Words in body; NULL until count_words has run. */
    word_count: number | null;
    id: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
};
export type NoteRequest = {
    title: string;
    body?: string;
};
export type PatchedNoteRequest = {
    title?: string;
    body?: string;
};
export type ReadyResponse = {
    status: string;
};
export const {
    useAuthTokenCreateMutation,
    useAuthTokenRefreshCreateMutation,
    useFlagsQuery,
    useHealthQuery,
    useNotesListQuery,
    useNotesCreateMutation,
    useNotesRetrieveQuery,
    useNotesUpdateMutation,
    useNotesPartialUpdateMutation,
    useNotesDestroyMutation,
    useReadyQuery,
} = injectedRtkApi;
