/** Read a server-sent event stream into its data payloads, without the final [DONE] marker. */
export function events(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join(""))
    .filter((data) => data !== "" && data !== "[DONE]")
    .map((data) => JSON.parse(data) as Record<string, unknown>);
}
