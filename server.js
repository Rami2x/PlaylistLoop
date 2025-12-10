// Main Express server
import express from "express";
import path from "node:path";
import dotenv from "dotenv";
import apiRoutes from "./server/routes/api.js";
import spotifyRoutes from "./server/routes/spotify.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(".")));

// API routes
app.use("/api", apiRoutes);
app.use("/api/spotify", spotifyRoutes);

app.listen(PORT, () => {
  console.log(`LoopWave server körs på http://localhost:${PORT}`);
});
