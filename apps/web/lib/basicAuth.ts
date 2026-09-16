export type BasicCredentials = {
  username: string;
  password: string;
};

function decodeBase64Utf8(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function parseBasicAuthorization(header: string | null): BasicCredentials | null {
  if (!header) return null;

  const match = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  const decoded = decodeBase64Utf8(match[1]);
  if (decoded === null) return null;

  const separator = decoded.indexOf(":");
  if (separator < 0) return null;

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
