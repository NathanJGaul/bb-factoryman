/** One `FMX1` line, as the remote wrapper prints it. The line ends in a carriage return, as a terminal writes it. */
export function frame(code: number, stdout = "", stderr = ""): string {
  const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
  return `FMX1 ${code} ${b64(stdout)} ${b64(stderr)}\r\n`;
}
