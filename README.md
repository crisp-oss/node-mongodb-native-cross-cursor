# MongoDB NodeJS Cross Instance Cursor

[![Test and Build](https://github.com/crisp-oss/node-mongodb-native-cross-cursor/actions/workflows/test.yml/badge.svg)](https://github.com/crisp-oss/node-mongodb-native-cross-cursor/actions/workflows/test.yml) [![Build and Release](https://github.com/crisp-oss/node-mongodb-native-cross-cursor/actions/workflows/build.yml/badge.svg)](https://github.com/crisp-oss/node-mongodb-native-cross-cursor/actions/workflows/build.yml) [![Version](https://img.shields.io/npm/v/mongodb-cross-cursor.svg)](https://www.npmjs.com/package/mongodb-cross-cursor) [![Downloads](https://img.shields.io/npm/dt/mongodb-cross-cursor.svg)](https://www.npmjs.com/package/mongodb-cross-cursor)

MongoDB Driver Extension allowing to use MongoDB cursors in a micro-service environment by consuming the same cursor accross different NodeJS workers.

Copyright 2023 Crisp IM SAS. See LICENSE for copying information.

* **📝 Implements**: [MongoDB NodeJS Driver](https://github.com/mongodb/node-mongodb-native/) at revision: 4.9
* **😘 Maintainers**: [@baptistejamin](https://github.com/baptistejamin)

## Introduction

MongoDB cursors are a powerful way to paginate over millions of results. However, Mongo Drivers are not offering anyway to consume cursors accross different instances. Cursors cannot be resumed after an instance restart or upgrade and this can be problematic in microservice environments

Usually a such tasks are performed using two different solutions:

- Find queries using `limit` and `skip`, however, those queries can become unresponsive when paginating over many different results.
- Find queries using ranges, however, this can be costly as well when consumming queries accross different indexes.

This project solves all those issues by consuming internal MongoDB APIs that are not exposed by the official MongoDB NodeJS Driver.

This package is using the official MongoDB driver, but relies on internal Mongo Wire commands.

## Installation

`npm install --save mongodb-cross-cursor`

## Initiating a cursor

You can use `mongodb-cross-cursor` with the regular MongoDB driver (currently only 4.X version is supported).

```javascript
var MongoCrossCursor = require("mongodb-cross-cursor");

// Use the regular Mongo client
const client    = new MongoClient("mongodb://localhost:270017");
const database  =  client.db("test");
const articles  = database.collection("articles");

const instance = await MongoDBCrossCursor.initiate(
  // Regular MongoDB find command
  articles.find({
    published : true
  })
);

// A shared cursor is now available. You can re-use this cursor in a different worker
// {
//    sessionId : "XXXXXXXX",
//    cursorId  : "YYYYYYYY"
// }
console.log(instance.sharedCursor)

```

## Resuming a cursor

You can now resume your cursor in a completely different project (for instance a project performing CPU intensive tasks)

```javascript
var MongoCrossCursor = require("mongodb-cross-cursor");

// Use the regular Mongo client
const client    = new MongoClient("mongodb://localhost:270017");

// The cursor we just created above
const sharedCursor = {
  sessionId : "XXXXXXXX",
  cursorId  : "YYYYYYYY"
};

// Resume a cross cursor instance using the sharedCursor object and a 100 batch Size
const instance = new MongoDBCrossCursor(sharedCursor, client, "test", "articles", 100)

// We can now fetch results, by iterating the cursor.
const results = instance.next();

// It should return 100 results.
console.log(results)

```

## Iterators

This package also provides iterators

```javascript
var MongoCrossCursor = require("mongodb-cross-cursor");

// Resume a cross cursor instance with a 1 batch size
const instance = new MongoDBCrossCursor(sharedCursor, client, "test", "articles", 1)

// We can now fetch results, by iterating the cursor.
for await (const result of instance.iterate()) {
  console.log(result);
}

```
