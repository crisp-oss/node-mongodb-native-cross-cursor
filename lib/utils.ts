import { ClientSession, Binary, Long } from "mongodb";

// Generates a dummy MongoDB Session
const fakeSessionBuilder = (sessionId : string) : ClientSession => {
  const fakeSession = {
    inTransaction: () => {
      return false;
    },
    serverSession: {
      id: {
        id: new Binary(Buffer.from(sessionId, "hex"), Binary.SUBTYPE_UUID)
      },
      lastUse: null
    },
    clientOptions: {
      readConcern: null
    },
    transaction: {
      transition: () => {
        // Empty function
      },
      options: {
        readConcern : null
      },
    },
    supports: {
      causalConsistency : false
    }
  };

  return fakeSession as unknown as ClientSession;
};

const stringToLong = (cursorId : string) : Long => {
  return Long.fromString(cursorId);
};

export { fakeSessionBuilder, stringToLong };