/**
 * Merge buyerreviews into reviews and normalize camelCase fields.
 * Idempotent — marked via _migrations.unified_reviews_v1.
 */
async function migrateUnifiedReviews(connection) {
  const db = connection.db;
  if (!db) {
    return { skipped: true, reason: "no-db" };
  }

  const meta = db.collection("_migrations");
  const already = await meta.findOne({ _id: "unified_reviews_v1" });
  if (already) {
    return { skipped: true, reason: "already-done" };
  }

  const reviews = db.collection("reviews");
  const buyerReviews = db.collection("buyerreviews");
  let migratedBuyers = 0;
  let normalized = 0;
  let removedMirrors = 0;

  const buyerRows = await buyerReviews.find({}).toArray();
  for (const br of buyerRows) {
    const id = br._id;
    const legacyExternalId = `buyer-${id}`;
    const mirror = await reviews.findOne({
      $or: [{ externalId: legacyExternalId }, { legacyExternalId }],
    });

    const unified = {
      userId: br.userId || null,
      storeId: String(br.storeId || ""),
      storeName: String(br.storeName || ""),
      productName: String(br.productName || ""),
      orderCode: String(br.orderCode || ""),
      userName: String(br.userName || "Khách hàng"),
      rating: Number(br.rating) || 1,
      comment: String(br.comment || ""),
      imageUrl: String(br.imageUrl || ""),
      isHidden: Boolean(br.isHidden) || Boolean(br.deletedAt) ? 1 : 0,
      isDeleted: Boolean(br.isDeleted) || Boolean(br.deletedAt) ? 0 : 1,
      deletedAt: br.deletedAt || null,
      legacyExternalId,
      CreatedAt: br.CreatedAt || br.createdAt || new Date(),
      UpdatedAt: br.UpdatedAt || br.updatedAt || new Date(),
    };

    await reviews.updateOne(
      { _id: id },
      {
        $set: unified,
        $unset: {
          externalId: "",
          store_id: "",
          user_name: "",
          is_hidden: "",
          is_deleted: "",
          deleted_at: "",
          created_at: "",
          updated_at: "",
          image_url: "",
        },
      },
      { upsert: true }
    );
    migratedBuyers += 1;

    if (mirror && String(mirror._id) !== String(id)) {
      await reviews.deleteOne({ _id: mirror._id });
      removedMirrors += 1;
    }
  }

  const cursor = reviews.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const set = {};
    const unset = {};

    if (!doc.storeId && doc.store_id) {
      set.storeId = String(doc.store_id);
    }
    if (doc.store_id !== undefined) {
      unset.store_id = "";
    }

    if (!doc.userName && doc.user_name) {
      set.userName = String(doc.user_name);
    }
    if (doc.user_name !== undefined) {
      unset.user_name = "";
    }

    if (doc.isHidden === undefined && doc.is_hidden !== undefined) {
      set.isHidden = Boolean(doc.is_hidden) ? 1 : 0;
    }
    if (doc.is_hidden !== undefined) {
      unset.is_hidden = "";
    }

    if (doc.isDeleted === undefined && doc.is_deleted !== undefined) {
      set.isDeleted = Boolean(doc.is_deleted) ? 0 : 1;
    }
    if (doc.is_deleted !== undefined) {
      unset.is_deleted = "";
    }

    if (!doc.deletedAt && doc.deleted_at) {
      set.deletedAt = doc.deleted_at;
    }
    if (doc.deleted_at !== undefined) {
      unset.deleted_at = "";
    }

    if (!doc.CreatedAt && (doc.created_at || doc.createdAt)) {
      set.CreatedAt = doc.created_at || doc.createdAt;
    }
    if (doc.created_at !== undefined) {
      unset.created_at = "";
    }

    if (!doc.UpdatedAt && (doc.updated_at || doc.updatedAt)) {
      set.UpdatedAt = doc.updated_at || doc.updatedAt;
    }
    if (doc.updated_at !== undefined) {
      unset.updated_at = "";
    }

    if (!doc.imageUrl && doc.image_url) {
      set.imageUrl = String(doc.image_url);
    }
    if (doc.image_url !== undefined) {
      unset.image_url = "";
    }

    if (!doc.legacyExternalId && doc.externalId) {
      set.legacyExternalId = String(doc.externalId);
    }
    if (doc.externalId !== undefined) {
      unset.externalId = "";
    }

    if (!doc.storeName) {
      set.storeName = String(doc.storeName || "");
    }
    if (!doc.productName) {
      set.productName = String(doc.productName || "");
    }
    if (doc.orderCode === undefined) {
      set.orderCode = "";
    }

    const ops = {};
    if (Object.keys(set).length) {
      ops.$set = set;
    }
    if (Object.keys(unset).length) {
      ops.$unset = unset;
    }
    if (Object.keys(ops).length) {
      await reviews.updateOne({ _id: doc._id }, ops);
      normalized += 1;
    }
  }

  try {
    await buyerReviews.drop();
  } catch {
    // collection may not exist
  }

  await meta.updateOne(
    { _id: "unified_reviews_v1" },
    {
      $set: {
        at: new Date(),
        migratedBuyers,
        normalized,
        removedMirrors,
      },
    },
    { upsert: true }
  );

  return { migratedBuyers, normalized, removedMirrors };
}

module.exports = { migrateUnifiedReviews };
