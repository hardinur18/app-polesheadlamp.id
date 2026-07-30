export type ServiceErrorPayload = {
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export type ServiceDataResponse<T> = {
  data: T;
};

export type ServiceOptionalDataResponse<T> = {
  data?: T;
};
