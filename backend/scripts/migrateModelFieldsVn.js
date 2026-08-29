/**
 * Migrate tên trường dài (EN) → rút gọn tiếng Việt.
 * Chạy một lần: node backend/scripts/migrateModelFieldsVn.js
 */
require("../config/env");
const connectDB = require("../config/database");
const { FIELD_RENAME_MAP } = require("../constants/modelFields");

const COLLECTIONS = [
  "products",
  "reviews",
  "reservations",
  "shopprofiles",
  "users",
  "notifications",
  "sellersubscriptions",
  "sellerbannerplans",
  "withdrawrequests",
  "reservationdisputes",
  "reservationadjustments",
  "reports",
  "sellerverifications",
  "systemwallets",
];

async function migrateCollection(db, collectionName) {
  const col = db.collection(collectionName);
  let total = 0;

  for (const [oldKey, newKey] of FIELD_RENAME_MAP) {
    const filter = { [oldKey]: { $exists: true } };
    const count = await col.countDocuments(filter);
    if (!count) {
      continue;
    }

    const result = await col.updateMany(filter, [
      {
        $set: {
          [newKey]: `$${oldKey}`,
        },
      },
      {
        $unset: oldKey,
      },
    ]);

    const modified = Number(result.modifiedCount) || 0;
    if (modified > 0) {
      console.log(`  ${collectionName}: ${oldKey} → ${newKey} (${modified})`);
      total += modified;
    }
  }

  return total;
}

async function cleanupSystemWalletFields(db) {
  const col = db.collection("systemwallets");
  const result = await col.updateMany({}, { $unset: { key: "", maVi: "" } });
  const modified = Number(result.modifiedCount) || 0;
  if (modified > 0) {
    console.log(`  systemwallets: removed key/maVi (${modified})`);
  }
  return modified;
}

async function dropLegacyIndexes(db) {
  const indexDrops = [
    ["products", "IsPromotion_1_PtGiam_-1_NgayKmKT_1"],
    ["reservations", "status_1_hanGiaiCoc_1"],
    ["reservationdisputes", "hanPhShop_1"],
  ];

  for (const [name, indexName] of indexDrops) {
    try {
      await db.collection(name).dropIndex(indexName);
      console.log(`  dropped index ${name}.${indexName}`);
    } catch {
      // index may not exist
    }
  }
}

async function run() {
  await connectDB();
  const db = require("mongoose").connection.db;
  console.log("Migrating model field names…");

  let grandTotal = 0;
  for (const collectionName of COLLECTIONS) {
    if (collectionName === "systemwallets") {
      grandTotal += await cleanupSystemWalletFields(db);
      continue;
    }
    grandTotal += await migrateCollection(db, collectionName);
  }

  await dropLegacyIndexes(db);
  console.log(`Done. Documents touched: ${grandTotal}`);
  await require("mongoose").disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
