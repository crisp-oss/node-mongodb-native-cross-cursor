import { ClientSession, Binary, Long, MongoClient } from "mongodb";

// Generates a dummy MongoDB Session compatible with MongoDB Driver 4
const fakeSessionBuilderV4 = (sessionId : string, client: MongoClient) : ClientSession => {
  const fakeSession = {
    client: client,
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

// Generates a dummy MongoDB Session compatible with MongoDB Driver 6
const fakeSessionBuilderV6 = (sessionId : string, client: MongoClient) : ClientSession => {
  // Create the server session ID structure matching MongoDB Driver 6
  const serverSessionId = {
    id: new Binary(Buffer.from(sessionId, "hex"), Binary.SUBTYPE_UUID)
  };

  // Create a fake server session matching ServerSession structure
  const serverSession = {
    id: serverSessionId,
    lastUse: Date.now(),
    txnNumber: 0,
    isDirty: false
  };

  // Create a fake transaction matching Transaction structure
  const transaction = {
    state: "NO_TRANSACTION" as const,
    options: {},
    get isActive() {
      return false;
    },
    get isStarting() {
      return false;
    },
    get isCommitted() {
      return false;
    },
    get isPinned() {
      return false;
    },
    transition: () => {
      // Empty function - no-op for fake session
    },
    pinServer: () => {
      // Empty function - no-op for fake session
    },
    unpinServer: () => {
      // Empty function - no-op for fake session
    }
  };

  // Create the fake session matching ClientSession structure from MongoDB Driver 6
  const fakeSession = {
    client: client,
    hasEnded: false,
    explicit: false,
    clientOptions: undefined,
    operationTime: undefined,
    supports: {
      causalConsistency: false
    },
    get serverSession() {
      return serverSession;
    },
    get id() {
      return serverSessionId;
    },
    inTransaction: () => {
      return transaction.isActive;
    },
    transaction: transaction,
    advanceOperationTime: () => {
      // Empty function - no-op for fake session
    },
    advanceClusterTime: () => {
      // Empty function - no-op for fake session
    },
    equals: () => {
      return false;
    },
    endSession: async () => {
      // Empty function - no-op for fake session
    },
    startTransaction: () => {
      // Empty function - no-op for fake session
    },
    commitTransaction: async () => {
      // Empty function - no-op for fake session
    },
    abortTransaction: async () => {
      // Empty function - no-op for fake session
    },
    withTransaction: async () => {
      // Empty function - no-op for fake session
    },
    toBSON: () => {
      throw new Error("ClientSession cannot be serialized to BSON.");
    }
  };

  return fakeSession as unknown as ClientSession;
};

const stringToLong = (cursorId : string) : Long => {
  return Long.fromString(cursorId);
};

export { fakeSessionBuilderV4, fakeSessionBuilderV6, stringToLong };