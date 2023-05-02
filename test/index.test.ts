import mongoCrossCursor from "../lib/index";

import { MongoClient, Collection } from "mongodb";

type Article = {
  title : string,
  index : number
};

let CLIENT : MongoClient;
let COLLECTION : Collection;

// -- alright let's test this shiznit!
describe("indexing", () => {
  beforeAll(async () => {
    const client = new MongoClient("mongodb://localhost:27017");

    const database = client.db("test");
    const articles = database.collection("articles");

    CLIENT = client;
    COLLECTION = articles;

    try {
      // Delete articles collection
      await COLLECTION.drop();
    } catch(e) {
      // Collection could not exist
    }

    const rawArticles : Article[] = [];

    for (let index = 0; index < 1000; index++) {
      rawArticles.push({
        title : `article_${index}`,
        index : index
      });
    }

    // Insert articles
    await articles.insertMany(rawArticles);
  });

  afterAll(async () => {
    CLIENT.close();
  });

  describe("Cursor", () => {
    it("It should result the first results", async () => {
      const find = COLLECTION
        .find({
          index : {
            $gte: 500
          }
        })
        .skip(10)
        .sort({
          index : -1
        })
        .limit(300);

      const instance = await mongoCrossCursor.initiate(find);

      let count = 0;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of instance.iterate()) {
        count++;
      }

      expect(count).toBe(300);

      return Promise.resolve();
    });
  });
});