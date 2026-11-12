export class ServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  if (error instanceof ServiceError)
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  return {
    status: 500,
    body: {
      error: {
        code: "SERVICE_ERROR",
        message:
          "The service could not complete that request. Your saved work is unchanged.",
      },
    },
  };
}
