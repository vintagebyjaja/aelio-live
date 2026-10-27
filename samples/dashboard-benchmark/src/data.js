export const sampleData = {
  status: { state: "operational", message: "All systems normal", updatedAt: "2026-10-27T21:00:00Z" },
  activity: [
    { time: "21:04", text: "Training run tr-42 finished" },
    { time: "20:51", text: "Quality Lab: 18/18 tests passed" },
    { time: "20:30", text: "Preview deployment created" },
    { time: "19:12", text: "Dataset psf-stdlib v2 validated" },
    { time: "18:40", text: "Green Guardians: no thermal alerts" },
    { time: "17:05", text: "Older event that should not be shown" }
  ],
  metrics: [
    { label: "Requests / min", value: 128, unit: "rpm" },
    { label: "p95 latency", value: 210, unit: "ms" },
    { label: "Error rate", value: 0.4, unit: "%" }
  ]
};
