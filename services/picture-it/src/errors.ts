export class PictureError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400, options?: ErrorOptions) {
    super(message, options);
    this.name = "PictureError";
    this.code = code;
    this.status = status;
  }
}
