export type HealthStatus = {
  status: "ok";
  service: "piece-conditioned-chess-api";
  milestone: "foundation";
};

export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    service: "piece-conditioned-chess-api",
    milestone: "foundation"
  };
}
