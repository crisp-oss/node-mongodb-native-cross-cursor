import { Document, FindCursor, WithId, MongoClient } from "mongodb";

import { fakeSessionBuilder , stringToLong } from "./utils";

interface ExtendedFindCursor extends FindCursor<WithId<Document>> {
  client: MongoClient
}

type SharedCursor = {
  cursorId : string,
  sessionId : string;
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

  static async initiate(find : FindCursor<WithId<Document>>) : Promise<MongoCrossCursor> {
    const cloned =  find.clone();

    const castedFind = cloned as ExtendedFindCursor;

    const db = castedFind.client.db(find.namespace.db);

    const session = castedFind.client.startSession();
    const sessionId = session.serverSession?.id?.id.toString("hex");

    // Close session now
    session.endSession();
  
    const cmd = await db.command({
      find: cloned.namespace.collection,
      filter: cloned.filter,
      batchSize: 0,
      hint: cloned.hint,
      sort: cloned.sort,
      skip: cloned.skip,
      limit: cloned.limit
    }, {
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
    const cmd = await this.client.db(this.namespace).command({
      getMore: stringToLong(this.sharedCursor.cursorId),
      collection: "articles",
      batchSize: this.batchSize
    }, {
      session : fakeSessionBuilder(this.sharedCursor.sessionId)
    });

    return cmd.cursor.nextBatch;
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