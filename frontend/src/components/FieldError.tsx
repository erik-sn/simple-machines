interface Props {
  // The id the input's aria-describedby points at.
  id: string;
  messages: string[] | undefined;
}

// Field-level API errors under an input, one line per message.
export function FieldError({ id, messages }: Props) {
  if (messages === undefined || messages.length === 0) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-red-700">
      {messages.map((message) => (
        <span key={message} className="block">
          {message}
        </span>
      ))}
    </p>
  );
}
