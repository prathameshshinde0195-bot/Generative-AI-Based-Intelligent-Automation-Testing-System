import { MongoClient } from 'mongodb';

const LOCAL_URI = 'mongodb://127.0.0.1:27017/ai-testing-system';
const ATLAS_URI = 'mongodb+srv://genai_user:TestPass12345@cluster0.szjtmxo.mongodb.net/ai-testing-system?retryWrites=true&w=majority';

async function migrateDirectBSON() {
  console.log('Connecting to Local and Atlas MongoDB instances...');
  const localClient = new MongoClient(LOCAL_URI);
  const atlasClient = new MongoClient(ATLAS_URI);

  await Promise.all([localClient.connect(), atlasClient.connect()]);
  console.log('✅ Connected to both databases.');

  const localDb = localClient.db('ai-testing-system');
  const atlasDb = atlasClient.db('ai-testing-system');

  const localCollections = await localDb.listCollections().toArray();
  console.log(`Found ${localCollections.length} collections in local database.`);

  for (const collInfo of localCollections) {
    const collName = collInfo.name;
    if (collName.startsWith('system.')) continue;

    console.log(`\n📦 Migrating collection: ${collName}`);
    const localColl = localDb.collection(collName);
    const atlasColl = atlasDb.collection(collName);

    const count = await localColl.countDocuments();
    console.log(`   Local count: ${count}`);

    if (count === 0) {
      console.log(`   Skipping empty collection.`);
      continue;
    }

    // Drop collection on Atlas to replace with native BSON documents
    try {
      await atlasColl.drop();
      console.log(`   Dropped existing Atlas collection to ensure clean BSON types.`);
    } catch (e) {
      // If collection doesn't exist, ignore
    }

    // Fetch raw BSON documents directly
    const docs = await localColl.find({}).toArray();

    // Insert batches of up to 1000
    const batchSize = 1000;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      await atlasColl.insertMany(batch);
      console.log(`   Inserted batch ${i + 1} to ${Math.min(i + batchSize, docs.length)} of ${docs.length}`);
    }

    const atlasCount = await atlasColl.countDocuments();
    const sample = await atlasColl.findOne();
    console.log(`   ✅ Atlas count: ${atlasCount} | Sample _id isObjectId: ${sample._id?._bsontype === 'ObjectID' || typeof sample._id === 'object'}`);
  }

  await Promise.all([localClient.close(), atlasClient.close()]);
  console.log('\n🎉 Direct BSON migration complete!');
}

migrateDirectBSON().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
