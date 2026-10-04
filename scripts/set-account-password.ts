import "dotenv/config";
import readline from "node:readline";
import { Writable } from "node:stream";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, getUserByEmail } from "../server/db.js";
import { users, authSessions } from "../drizzle/schema.js";
import { isBootstrapAdmin } from "../server/services/auth.js";

async function run() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: pnpm account:password <existing-email>");
  const user = await getUserByEmail(email);
  if (!user)
    throw new Error(
      "Account not found. Register a new account through the application first."
    );
  process.stdout.write(`Set password for ${email}: `);
  const hiddenOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const input = readline.createInterface({
    input: process.stdin,
    output: hiddenOutput,
    terminal: true,
  });
  const password = await new Promise<string>(resolve =>
    input.question("", resolve)
  );
  input.close();
  process.stdout.write("\n");
  if (password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error("Use 12 or more characters, up to 72 UTF-8 bytes.");
  const db = await getDb();
  await db.transaction(async tx => {
    await tx
      .update(users)
      .set({
        passwordHash: await bcrypt.hash(password, 12),
        role: isBootstrapAdmin(email) ? "admin" : user.role,
      })
      .where(eq(users.id, user.id));
    await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
  });
  console.log("Password set; existing sessions revoked.");
}
run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.message);
    process.exit(1);
  });
