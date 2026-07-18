import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";

async function test() {
  const options = await generateRegistrationOptions({
    rpName: "Foxly",
    rpID: "localhost",
    userID: new Uint8Array([1,2,3]),
    userName: "test@example.com",
    userDisplayName: "Test",
    attestationType: "none"
  });
  console.log(JSON.stringify(options, null, 2));
}

test();
