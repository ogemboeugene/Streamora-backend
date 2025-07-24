const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('./models/User');

async function checkSchema() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check indexes
    const indexes = await User.collection.getIndexes();
    console.log('\n📊 Current indexes:');
    console.log(JSON.stringify(indexes, null, 2));
    
    // Check if we have any users to see the schema
    const userCount = await User.countDocuments();
    console.log(`\n👥 Total users in database: ${userCount}`);
    
    if (userCount > 0) {
      const user = await User.findOne().lean();
      console.log('\n📋 Sample user structure:');
      console.log('Keys:', Object.keys(user));
      
      // Check for new fields
      const hasRatings = user.hasOwnProperty('ratings');
      const hasCustomLists = user.hasOwnProperty('customLists');
      
      console.log('\n🔍 Schema validation:');
      console.log('- Has ratings field:', hasRatings);
      console.log('- Has customLists field:', hasCustomLists);
      console.log('- Has watchlist field:', user.hasOwnProperty('watchlist'));
      console.log('- Has favorites field:', user.hasOwnProperty('favorites'));
      console.log('- Has watchHistory field:', user.hasOwnProperty('watchHistory'));
      
      if (hasRatings) {
        console.log('- Ratings array length:', user.ratings ? user.ratings.length : 0);
      }
      if (hasCustomLists) {
        console.log('- Custom lists array length:', user.customLists ? user.customLists.length : 0);
      }
    } else {
      console.log('\n⚠️  No users found in database');
    }
    
    // Try to create the indexes manually if they don't exist
    console.log('\n🔧 Ensuring indexes are created...');
    try {
      // Check if we need to drop and recreate any indexes with conflicts
      const currentIndexes = await User.collection.getIndexes();
      
      // Check if email index needs to be updated to unique
      if (currentIndexes.email_1 && !currentIndexes.email_1.unique) {
        console.log('📝 Updating email index to be unique...');
        await User.collection.dropIndex('email_1');
        await User.collection.createIndex({ email: 1 }, { unique: true, background: true });
        console.log('✅ Email index updated');
      }
      
      // Create/verify all indexes
      await User.createIndexes();
      console.log('✅ Indexes created/verified');
    } catch (indexError) {
      if (indexError.code === 86) {
        console.log('⚠️  Index conflict detected - indexes already exist with correct specifications');
      } else {
        console.error('❌ Index creation error:', indexError.message);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSchema();
