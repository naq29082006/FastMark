async function dropIndexIfExists(collection, indexName) {
  try {
    await collection.dropIndex(indexName);
    console.log(`[Mongo] Dropped stale index: ${indexName}`);
    return true;
  } catch (error) {
    if (error?.codeName === "IndexNotFound" || /index not found/i.test(error?.message || "")) {
      return false;
    }
    throw error;
  }
}

async function syncProductCollectionIndexes(connection) {
  const collection = connection.collection("products");
  const indexes = await collection.indexes();
  const indexNames = new Set(indexes.map((index) => index.name));

  const staleIndexes = ["externalId_1", "store_id_1"];
  for (const indexName of staleIndexes) {
    if (indexNames.has(indexName)) {
      await dropIndexIfExists(collection, indexName);
    }
  }

  const Product = require("../models/Product");
  await Product.syncIndexes();
}

module.exports = {
  syncProductCollectionIndexes,
};
