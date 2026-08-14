export type OptimizeStatus = "idle" | "running" | "done" | "error";

export type OptimizeResult = {
  status: OptimizeStatus;
  data?: string;
  size?: number;
  gzip?: number;
  error?: string;
};

export type ResultMap = Record<string, OptimizeResult>;
