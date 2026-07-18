import { store } from "./src/store.js";
import pg from "pg";

console.log("Store loaded. Check if DB is connected.");

async function testStore() {
  const user = store.findUserByEmail("some@example.com");
  console.log("DB test done");
  process.exit(0);
}

testStore();
