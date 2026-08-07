/**
 * Align reviews collection indexes with Review schema
 * (shopId / productId / reservationId / soft-delete flags).
 */
async function syncReviewCollectionIndexes(connection) {
  const db = connection.db;
  if (!db) {
    return;
  }

  const reviews = db.collection("reviews");
  let indexes = [];
  try {
    indexes = await reviews.indexes();
  } catch {
    return;
  }

  const indexByName = new Map(indexes.map((idx) => [idx.name, idx]));

  const stale = [
    "externalId_1",
    "store_id_1",
    "user_name_1",
    "storeId_1",
    "storeId_1_CreatedAt_-1",
    "orderCode_1",
    "orderCode_1_sparse",
    "legacyExternalId_1",
    "reservationId_1",
  ];
  for (const name of stale) {
    if (indexByName.has(name)) {
      try {
        await reviews.dropIndex(name);
        console.log(`Dropped stale reviews index: ${name}`);
        indexByName.delete(name);
      } catch (error) {
        console.warn(`Could not drop reviews index ${name}:`, error.message);
      }
    }
  }

  const desired = [
    { keys: { shopId: 1, CreatedAt: -1 }, options: { name: "shopId_1_CreatedAt_-1" } },
    { keys: { productId: 1, CreatedAt: -1 }, options: { name: "productId_1_CreatedAt_-1" } },
    { keys: { userId: 1, CreatedAt: -1 }, options: { name: "userId_1_CreatedAt_-1" } },
    {
      keys: { removedBy: 1 },
      options: { name: "removedBy_1" },
    },
    {
      keys: { isDeleted: 1 },
      options: { name: "isDeleted_1" },
    },
    {
      keys: { reservationId: 1 },
      options: {
        name: "reservationId_1_active",
        unique: true,
        partialFilterExpression: {
          $or: [
            { isDeleted: 1 },
            { isDeleted: false },
            { isDeleted: { $exists: false } },
          ],
        },
      },
    },
  ];

  for (const item of desired) {
    if (indexByName.has(item.options.name)) {
      continue;
    }
    try {
      await reviews.createIndex(item.keys, item.options);
    } catch (error) {
      console.warn(`Could not create reviews index ${item.options.name}:`, error.message);
    }
  }
}

module.exports = { syncReviewCollectionIndexes };
