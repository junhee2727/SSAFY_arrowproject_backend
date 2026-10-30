import { optimizeVisitOrder } from "./route-optimizer.js";

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: optimizeVisitOrder(data.places) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
