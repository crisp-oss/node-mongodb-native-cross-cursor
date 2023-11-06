import { Document, FindCursor, WithId, MongoClient } from "mongodb";

import { fakeSessionBuilder , stringToLong } from "./utils";

interface ExtendedFindCursor extends FindCursor<WithId<Document>> {
  client: MongoClient
}

type SharedCursor = {
  cursorId : string,
  sessionId : string;
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

  constructor(sharedCursor: SharedCursor, client: MongoClient, namespace: string, collection: string, batchSize = 20) {
    this.sharedCursor = sharedCursor;
    this.client = client;
    this.namespace = namespace;
    this.collection = collection;
    this.batchSize = batchSize;
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
    const kFilter = symbolsProperties.find(symbol => symbol.description === "filter");
    const kBuiltOptions = symbolsProperties.find(symbol => symbol.description === "builtOptions");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const filter = castedFind[kFilter];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const builtOptions = castedFind[kBuiltOptions];

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

    const cmd = await db.command(_commandOptions, {
      session : fakeSessionBuilder(sessionId)
    });

    const cursorId = cmd.cursor.id.toString();

    return new MongoCrossCursor(
      {
        sessionId: sessionId,
        cursorId: cursorId
      },
      castedFind.client,
      find.namespace.db,
      cloned.namespace.collection || ""
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
          session : fakeSessionBuilder(this.sharedCursor.sessionId)
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

module.exports = MongoCrossCursor;
export default MongoCrossCursor;