import "dotenv/config"; // must be first: loads server/.env before config is read
import { createApp } from "./app.js";
import { config } from "./config.js";

const { httpServer } = createApp();

httpServer.listen(config.port, () => {
  console.log(`[EkScreen] server listening on http://localhost:${config.port}`);
});
