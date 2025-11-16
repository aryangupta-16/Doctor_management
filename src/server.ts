import dotenv from "dotenv";
dotenv.config();
import { app } from "./app";
import { config } from "./config";
import { connectDB } from "./config/database";

const PORT = config.PORT || 8000;

(async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
})();
