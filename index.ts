import "dotenv/config";
import express from "express";
import { createApp } from "./server/_core/app.js";

// Vercel discovers the root Express entrypoint and invokes the exported app.
// The local long-running server remains server/_core/index.ts.
void express;
process.env.NODE_ENV = "production";
export default createApp(true);

