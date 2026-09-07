const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');

  // Delete all users
  await User.deleteMany({});
  console.log('All users deleted');

  // Re-run seed
  console.log('Please run: node seed.js');

  mongoose.disconnect();
}).catch(console.error);
