export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
