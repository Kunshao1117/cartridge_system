import matter from "./safe-frontmatter.js"

interface RawParts {
  opening: string
  fields: string
  closing: string
  body: string
}

function splitRaw(raw: string): RawParts | null {
  const opening = /^\uFEFF*---[^\r\n]*\r?\n/.exec(raw)?.[0]
  if (!opening) return null
  const rest = raw.slice(opening.length)
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest)
  if (!closing) return null
  return {
    opening,
    fields: rest.slice(0, closing.index),
    closing: closing[0],
    body: rest.slice(closing.index + closing[0].length),
  }
}

/** Keep ordinary YAML comments, custom keys, dates, ordering and body bytes intact. */
function updateManagedFields(
  raw: string,
  body: string,
  data: Record<string, unknown>,
  updates: Record<string, unknown>,
): string {
  const changed = Object.entries(updates).filter(([key, value]) => data[key] !== value)
  const parts = splitRaw(raw)
  if (parts && changed.length === 0) {
    return parts.opening + parts.fields + parts.closing + body
  }
  if (parts && /^\uFEFF*---(?:[ \t]*(?:yaml|yml))?[ \t]*\r?\n$/.test(parts.opening)) {
    let fields = parts.fields
    const newline = parts.opening.endsWith('\r\n') ? '\r\n' : '\n'
    let patchable = true
    for (const [key, value] of changed) {
      if (!/^[A-Za-z_][\w-]*$/.test(key) ||
        (value !== null && !['string', 'number', 'boolean'].includes(typeof value))) {
        patchable = false
        break
      }
      const scalarValue = typeof value === 'string'
        ? (/^[A-Za-z_][\w-]*$/.test(value) && !/^(?:true|false|yes|no|on|off|null)$/i.test(value) ? value : JSON.stringify(value))
        : String(value)
      const line = new RegExp(`^(${key}[ \\t]*:[ \\t]*)([^\\r\\n]*)(\\r?\\n|$)`, 'm')
      const match = line.exec(fields)
      if (match) {
        // Block scalars, tagged values and complex/quoted keys take the safe
        // serializer fallback rather than leaving dangling YAML continuation.
        const scalar = /^(?:[-+]?\d+(?:\.\d+)?|[\w-]+|"[^"\r\n]*"|'[^'\r\n]*')([ \t]*(?:#.*)?)$/.exec(match[2])
        if (!scalar) { patchable = false; break }
        fields = fields.slice(0, match.index) + match[1] + scalarValue + scalar[1] + match[3] + fields.slice(match.index + match[0].length)
      } else if (!Object.hasOwn(data, key)) {
        fields += `${key}: ${scalarValue}${newline}`
      } else {
        patchable = false
        break
      }
    }
    if (patchable) {
      const candidate = parts.opening + fields + parts.closing + body
      const expected = { ...data, ...updates }
      // Verify the surgical update before writing; unusual YAML falls back to
      // the shared data-only serializer with all unknown values preserved.
      if (JSON.stringify(matter(candidate).data) === JSON.stringify(expected)) return candidate
    }
  }
  if (!parts && changed.length === 0 && body === raw) return raw
  return matter.stringify(body, { ...data, ...updates }, raw)
}

/** Parse data safely while retaining original body bytes for bounded edits. */
export function readMemorySource(raw: string): { data: Record<string, unknown>; content: string } {
  const parsed = matter(raw)
  return { data: parsed.data, content: splitRaw(raw)?.body ?? parsed.content }
}

/** Patch selected metadata and an optional already-reviewed body, never evaluate it. */
export function patchMemorySource(raw: string, updates: Record<string, unknown>, content?: string): string {
  const parsed = readMemorySource(raw)
  return updateManagedFields(raw, content ?? parsed.content, parsed.data, updates)
}
