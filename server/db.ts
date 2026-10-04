import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users, type InsertUser, type User } from "../drizzle/schema";
function createDatabase(url: string) {
  return drizzle(mysql.createPool({ uri: url, connectionLimit: 2, waitForConnections: true }));
}
let database: ReturnType<typeof createDatabase> | undefined;
export async function getDb() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required for persistent CivicFix operations. Configure MySQL and run pnpm db:migrate."
    );
  return (database ??= createDatabase(process.env.DATABASE_URL));
}
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  return (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
}
export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}
export async function createUser(input: InsertUser) {
  const db = await getDb();
  await db.insert(users).values(input);
  const user = await getUserByEmail(input.email);
  if (!user) throw new Error("Registered account could not be retrieved.");
  return user;
}
export async function recordSignIn(id: number, role: "user" | "admin") {
  const db = await getDb();
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), role })
    .where(eq(users.id, id));
}
