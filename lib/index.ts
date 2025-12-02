import { Document, FindCursor, WithId, MongoClient, ClientSession } from "mongodb";

import { fakeSessionBuilderV4, fakeSessionBuilderV6, stringToLong } from "./utils.js";

interface ExtendedFindCursor extends FindCursor<WithId<Document>> {
  client: MongoClient
}

type SharedCursor = {
  cursorId : string,
  sessionId : string;
}

type MongoDriverVersion = 4 | 5 | 6 | 7;

// Detect MongoDB driver version by checking session structure
// Defaults to 4 if detection fails
function detectMongoDriverVersion(client: MongoClient): MongoDriverVersion {
  try {
    const testSession = client.startSession();
    // MongoDB Driver 6+ has 'hasEnded' property
    // MongoDB Driver 4/5 don't have it directly accessible
    const hasHasEnded = "hasEnded" in testSession;
    if (hasHasEnded) {
      void testSession.endSession();
      return 6; // Assume 6+ if hasEnded exists
    }
    // @ts-expect-error: testSession is not defined in the type
    void testSession.endSession();
    return 4; // Default to 4 for older versions
  } catch {
    // If detection fails, default to 4
    return 4;
  }
}

type CustomCommand = {
  find : string,
  filter : object,
  hint? : string,
  sort? : object,
  skip? : number,
  limit? : number,
  projection? : object,
  batchSize : number;
}

class MongoCrossCursor {
  sharedCursor: SharedCursor;
  client: MongoClient;
  namespace: string;
  collection: string;
  batchSize: number;
  mongoDriverVersion: MongoDriverVersion;

  constructor(
    sharedCursor: SharedCursor, 
    client: MongoClient, 
    namespace: string, 
    collection: string, 
    batchSize = 20,
    mongoDriverVersion: MongoDriverVersion = 4
  ) {
    this.sharedCursor = sharedCursor;
    this.client = client;
    this.namespace = namespace;
    this.collection = collection;
    this.batchSize = batchSize;
    this.mongoDriverVersion = mongoDriverVersion;
  }

  private getFakeSession(sessionId: string): ClientSession {
    // MongoDB Driver 4 and 5 use the same session structure
    if (this.mongoDriverVersion === 4 || this.mongoDriverVersion === 5) {
      return fakeSessionBuilderV4(sessionId, this.client);
    }
    // MongoDB Driver 6 and 7 use the same session structure
    return fakeSessionBuilderV6(sessionId, this.client);
  }

  static async initiate(find : FindCursor<Document>) : Promise<MongoCrossCursor> {
    const cloned =  find.clone();

    const castedFind = cloned as ExtendedFindCursor;

    const db = castedFind.client.db(find.namespace.db);

    const session = castedFind.client.startSession();
    const sessionId = session.serverSession?.id?.id.toString("hex");

    // Close session now
    session.endSession();

    const symbolsProperties = Object.getOwnPropertySymbols(castedFind);

    // MongoDB Driver 5 and below
    const kFilter = symbolsProperties.find(symbol => symbol.description === "filter");
    const kBuiltOptions = symbolsProperties.find(symbol => symbol.description === "builtOptions");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let filter = castedFind[kFilter];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let builtOptions = castedFind[kBuiltOptions];

    // MongoDB Driver 6+
    // @ts-expect-error: cloned is not defined in the type
    if (cloned.findOptions) {
      // @ts-expect-error: cloned is not defined in the type
      builtOptions = cloned.findOptions;
    }

    // MongoDB Driver 6+
    // @ts-expect-error: cursorFilter is not defined in the type
    if (!filter && castedFind.cursorFilter) {
      // @ts-expect-error: cursorFilter is not defined in the type
      filter = castedFind.cursorFilter;
    }

    const _commandOptions = {
      find: cloned.namespace.collection,
      filter: filter,
      batchSize: 0,
    } as CustomCommand;

    if (builtOptions.hint) {
      _commandOptions.hint = builtOptions.hint;
    }

    if (builtOptions.sort) {
      _commandOptions.sort = builtOptions.sort;
    }

    if (builtOptions.skip) {
      _commandOptions.skip = builtOptions.skip;
    }

    if (builtOptions.limit) {
      _commandOptions.limit = builtOptions.limit;
    }

    if (builtOptions.projection) {
      _commandOptions.projection = builtOptions.projection;
    }

    // Detect MongoDB driver version from the client
    const mongoDriverVersion = detectMongoDriverVersion(castedFind.client);

    const fakeSession = mongoDriverVersion === 4 || mongoDriverVersion === 5
      ? fakeSessionBuilderV4(sessionId, castedFind.client)
      : fakeSessionBuilderV6(sessionId, castedFind.client);

    const cmd = await db.command(_commandOptions, {
      session : fakeSession
    });

    const cursorId = cmd.cursor.id.toString();

    return new MongoCrossCursor(
      {
        sessionId: sessionId,
        cursorId: cursorId
      },
      castedFind.client,
      find.namespace.db,
      cloned.namespace.collection || "",
      undefined,
      mongoDriverVersion
    );
  }

  async next() : Promise<unknown[]> {
    return Promise.resolve()
      .then(() => {
        return this.client.db(this.namespace).command({
          getMore: stringToLong(this.sharedCursor.cursorId),
          collection: this.collection,
          batchSize: this.batchSize,
        }, {
          session : this.getFakeSession(this.sharedCursor.sessionId)
        });
      }).then((result) => {
        return result.cursor.nextBatch || [];
      }).catch((error) => {
        // No results remaining
        if (error?.message?.indexOf("cursor id") !== -1  ||
            error?.message?.indexOf("Cursor not found") !== -1) {
          return Promise.resolve([]);
        }

        return Promise.reject(error);
      });
  }

  async * iterate() {
    let hasResults = true;

    while(hasResults) {
      const results = await this.next();

      if (results.length === 0) {
        hasResults = false;
      }

      for (let _i = 0; _i < results.length; _i++) {
        yield results[_i];
      }
    }
  }
}

export default MongoCrossCursor;
