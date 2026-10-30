export const startRouteOptimization = (places) => {
  const worker = new Worker(new URL("./route-worker.js", import.meta.url), { type: "module" });
  let rejectJob;
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject;
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("OPTIMIZATION_FAILED"));
    };
    worker.postMessage({ places });
  });
  return { promise, cancel() { worker.terminate(); rejectJob(new Error("OPTIMIZATION_CANCELLED")); } };
};
