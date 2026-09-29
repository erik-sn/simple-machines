// The page itself: a full-viewport layer behind every scene. The texture
// recipe per theme lives in index.css (.paper); this component only places it.
export function Paper() {
  return <div aria-hidden="true" className="paper absolute inset-0" />;
}
