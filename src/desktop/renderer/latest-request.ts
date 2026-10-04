/** A response belongs only to the latest request/event in its state domain. */
export class LatestRequest {
  private sequence = 0;
  begin(): number { return ++this.sequence; }
  invalidate(): void { this.sequence++; }
  isCurrent(request: number): boolean { return request === this.sequence; }
}
