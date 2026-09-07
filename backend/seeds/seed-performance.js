/**
 * Performance Test Seeder
 *
 * Generates 1000+ realistic orders for performance testing.
 * Includes diverse customer data, order patterns, payment methods, and timestamps.
 *
 * Usage: node seeds/seed-performance.js [--count=1000] [--with-users] [--with-products]
 *
 * Environment Variables:
 *   MONGO_URI - MongoDB connection string
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const ORDER_COUNT = parseInt(args.count, 10) || 1000;
const WITH_USERS = args['with-users'] === true;
const WITH_PRODUCTS = args['with-products'] === true;

// ============================================================================
// Data Generators
// ============================================================================

// Kenyan names
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Grace', 'Robert', 'Faith', 'Michael', 'Joy', 'David', 'Hope',
  'Daniel', 'Mercy', 'William', 'Charity', 'Richard', 'Blessing', 'Joseph', 'Peace', 'Thomas', 'Patience',
  'Charles', 'Gladys', 'Christopher', 'Agnes', 'Andrew', 'Florence', 'Peter', 'Eunice', 'Paul', 'Alice',
  'Stephen', 'Martha', 'Patrick', 'Susan', 'Kenneth', 'Margaret', 'George', 'Ruth', 'Samuel', 'Esther',
  'Benjamin', 'Nancy', 'Raymond', 'Catherine', 'Gregory', 'Lucy', 'Frank', 'Hannah', 'Albert', 'Rebecca',
];

const LAST_NAMES = [
  'Mwangi', 'Wanjiku', 'Ochieng', 'Njeri', 'Kamau', 'Akinyi', 'Maina', 'Wambui', 'Omondi', 'Nyambura',
  'Otieno', 'Waithera', 'Onyango', 'Njoroge', 'Odhiambo', 'Muthoni', 'Kimani', 'Achieng', 'Njenga', 'Nyokabi',
  'Wairimu', 'Ouma', 'Gichuru', 'Owino', 'Kariuki', 'Ogada', 'Mburu', 'Onyango', 'Gitonga', 'Njoki',
  'Ndegwa', 'Okoth', 'Macharia', 'Okeyo', 'Kamathi', 'Adhiambo', 'Njau', 'Ombui', 'Mwangi', 'Wanjala',
];

// Kenyan cities and addresses
const CITIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale', 'Garissa', 'Kakamega',
  'Nyeri', 'Machakos', 'Meru', 'Lamu', 'Naivasha', 'Nandi Hills', 'Bungoma', 'Kericho', 'Embu', 'Migori',
];

const STREETS = [
  'Moi Avenue', 'Kenyatta Avenue', 'Oginga Odinga Street', 'Tom Mboya Street', 'Kimathi Street',
  'Haile Selassie Avenue', 'Uhuru Highway', 'Lumumba Drive', 'Kijabe Street', 'River Road',
  'Biashara Street', 'Dubai Street', 'Eastleigh', 'Karen Road', 'Runda Road',
  'Kiambu Road', 'Thika Road', 'Mombasa Road', 'Langata Road', 'Ngong Road',
];

// Product categories and items
const PRODUCT_CATEGORIES = [
  { name: 'Electronics', items: ['Laptop', 'Smartphone', 'Tablet', 'Headphones', 'Charger', 'Power Bank', 'USB Cable', 'Mouse', 'Keyboard', 'Monitor'] },
  { name: 'Accessories', items: ['Laptop Bag', 'Phone Case', 'Screen Protector', 'Earbuds', 'Smartwatch', 'Fitness Band', 'Ring Light', 'Tripod', 'Selfie Stick', 'Cable Organizer'] },
  { name: 'Software', items: ['Antivirus License', 'Microsoft Office', 'Adobe Creative Suite', 'VPN Subscription', 'Cloud Storage', 'Password Manager', 'Video Editor', 'Photo Editor', 'Development Tools', 'Game License'] },
  { name: 'Services', items: ['Website Design', 'Web Hosting', 'Domain Registration', 'SEO Package', 'Social Media Management', 'IT Support', 'Data Recovery', 'Virus Removal', 'System Installation', 'Network Setup'] },
];

const PAYMENT_METHODS = ['mpesa', 'card', 'bank_transfer', 'cash', 'paypal'];
const PAYMENT_STATUSES = ['completed', 'pending', 'failed', 'refunded'];
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

// ============================================================================
// Helper Functions
// ============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _randomItems(arr, min, max) {
  const count = randomInt(min, max);
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateEmail(firstName, lastName) {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const separators = ['.', '_', ''];
  const separator = randomItem(separators);
  const suffix = randomInt(1, 999);
  return `${firstName.toLowerCase()}${separator}${lastName.toLowerCase()}${suffix}@${randomItem(domains)}`;
}

function generatePhone() {
  const prefixes = ['+2547', '+2541', '+2545'];
  const prefix = randomItem(prefixes);
  const number = randomInt(1000000, 9999999);
  return `${prefix}${number}`;
}

function generateOrderNumber(index) {
  const prefix = randomItem(['ORD', 'INV', 'PCL']);
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}-${year}${month}-${String(index).padStart(6, '0')}`;
}

function generateTransactionId(method) {
  const prefixes = {
    mpesa: 'MP',
    card: 'CC',
    bank: 'BT',
    cash: 'CSH',
    paypal: 'PP',
  };
  const prefix = prefixes[method] || 'TX';
  const id = randomInt(10000000, 99999999);
  return `${prefix}-${id}`;
}

function generateAddress() {
  const building = randomInt(1, 500);
  const street = randomItem(STREETS);
  const city = randomItem(CITIES);

  return {
    street: `${building}, ${street}`,
    city,
    state: city,
    postalCode: `${randomInt(100, 999)}`,
    country: 'Kenya',
  };
}

function generateCustomer(_index) {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);

  return {
    name: `${firstName} ${lastName}`,
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    address: generateAddress(),
  };
}

function generateOrderItems() {
  const category = randomItem(PRODUCT_CATEGORIES);
  const itemCount = randomInt(1, 5);
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const itemName = randomItem(category.items);
    const quantity = randomInt(1, 3);
    const price = randomFloat(50, 150000);
    const discount = randomFloat(0, 0.3);

    items.push({
      name: `${itemName} - ${category.name}`,
      sku: `${category.name.slice(0, 3).toUpperCase()}-${randomInt(1000, 9999)}`,
      quantity,
      price,
      discount: parseFloat((price * discount).toFixed(2)),
      total: parseFloat((price * quantity * (1 - discount)).toFixed(2)),
    });
  }

  return items;
}

function generatePayment(method) {
  const status = randomItem(PAYMENT_STATUSES);
  const transactionId = generateTransactionId(method);

  return {
    method,
    status,
    transactionId,
    amount: 0, // Will be set later
    currency: 'KES',
    timestamp: new Date(),
    ...(method === 'mpesa' && {
      mpesa: {
        phoneNumber: generatePhone(),
        conversationId: `C-${randomInt(100000, 999999)}`,
      },
    }),
    ...(method === 'card' && {
      card: {
        last4: randomInt(1000, 9999).toString(),
        brand: randomItem(['visa', 'mastercard']),
      },
    }),
  };
}

function generateTimestamp(_index, _total) {
  // Distribute orders over the past 90 days
  const now = new Date();
  const daysAgo = randomInt(0, 90);
  const hoursAgo = randomInt(0, 23);
  const minutesAgo = randomInt(0, 59);

  const timestamp = new Date(now);
  timestamp.setDate(timestamp.getDate() - daysAgo);
  timestamp.setHours(timestamp.getHours() - hoursAgo);
  timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);

  return timestamp;
}

// ============================================================================
// Order Generator
// ============================================================================

function generateOrder(index) {
  const customer = generateCustomer(index);
  const items = generateOrderItems();
  const method = randomItem(PAYMENT_METHODS);
  const payment = generatePayment(method);
  const status = randomItem(ORDER_STATUSES);
  const createdAt = generateTimestamp(index, ORDER_COUNT);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const shipping = randomFloat(0, 500);
  const tax = parseFloat((subtotal * 0.16).toFixed(2)); // 16% VAT
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const total = parseFloat((subtotal + shipping + tax - discount).toFixed(2));

  payment.amount = total;

  // Generate tracking number for shipped/delivered orders
  const trackingNumber = ['shipped', 'delivered'].includes(status)
    ? `TRK-${randomInt(10000000, 99999999)}`
    : null;

  // Generate delivery date for delivered orders
  const deliveredAt = status === 'delivered'
    ? new Date(createdAt.getTime() + randomInt(1, 7) * 24 * 60 * 60 * 1000)
    : null;

  return {
    orderNumber: generateOrderNumber(index),
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    items,
    subtotal,
    shipping,
    tax,
    discount,
    total,
    currency: 'KES',
    status,
    payment,
    shippingAddress: customer.address,
    billingAddress: customer.address,
    trackingNumber,
    deliveredAt,
    notes: randomItem([null, 'Please deliver to reception', 'Leave at gate', 'Fragile items', '']),
    createdAt,
    updatedAt: createdAt,
  };
}

// ============================================================================
// User Generator
// ============================================================================

function generateUsers() {
  const users = [
    {
      name: 'Performance Test Admin',
      email: 'perfadmin@test.com',
      password: 'PerfAdmin@2026',
      role: 'SUPER_ADMIN',
      isOwner: true,
      superAdminLocked: true,
      isActive: true,
    },
    {
      name: 'Performance Test Staff',
      email: 'perfstaff@test.com',
      password: 'PerfStaff@2026',
      role: 'STAFF',
      departmentSlug: 'internet',
      isActive: true,
    },
    {
      name: 'Performance Test Customer',
      email: 'perfcustomer@test.com',
      password: 'PerfCustomer@2026',
      role: 'client',
      isActive: true,
    },
  ];

  // Generate additional customers
  for (let i = 0; i < 50; i++) {
    const customer = generateCustomer(i);
    users.push({
      ...customer,
      password: 'Customer@2026',
      role: 'client',
      isActive: true,
    });
  }

  return users;
}

// ============================================================================
// Product Generator
// ============================================================================

function generateProducts() {
  const products = [];

  for (const category of PRODUCT_CATEGORIES) {
    for (const item of category.items) {
      products.push({
        name: `${item} - ${category.name}`,
        slug: `${item.toLowerCase().replace(/\s+/g, '-')}-${category.name.toLowerCase()}`,
        category: category.name.toLowerCase(),
        description: `High-quality ${item.toLowerCase()} for your ${category.name.toLowerCase()} needs.`,
        shortDesc: `Premium ${item.toLowerCase()}`,
        price: randomFloat(50, 150000),
        stock: randomInt(0, 100),
        isActive: true,
        featured: randomFloat(0, 1) > 0.8,
        tags: [item.toLowerCase(), category.name.toLowerCase()],
        rating: randomFloat(3.5, 5),
        reviewCount: randomInt(0, 50),
        soldCount: randomInt(0, 200),
      });
    }
  }

  return products;
}

// ============================================================================
// Main Seeder
// ============================================================================

async function seed() {
  console.log('\n🚀 Performance Test Seeder');
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log(`  Generating ${ORDER_COUNT} orders with realistic data...`);
  console.log('══════════════════════════════════════════════════════════════════════════\n');

  if (!process.env.MONGO_URI) {
    console.error('\n❌  MONGO_URI not set in .env\n');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected.\n');

  const startTime = Date.now();

  // Clear existing performance test data
  console.log('🗑️   Clearing existing performance test data...');
  await mongoose.connection.db.collection('orders').deleteMany({});
  console.log('✅  Orders cleared.\n');

  // Generate and insert users (if requested)
  if (WITH_USERS) {
    console.log('👤  Generating users...');
    const users = generateUsers();

    for (const userData of users) {
      const hashed = await bcrypt.hash(userData.password, 10);
      await mongoose.connection.db.collection('users').insertOne({
        ...userData,
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`✅  ${users.length} users created.\n`);
  }

  // Generate and insert products (if requested)
  if (WITH_PRODUCTS) {
    console.log('📦  Generating products...');
    const products = generateProducts();

    for (const product of products) {
      await mongoose.connection.db.collection('products').insertOne({
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`✅  ${products.length} products created.\n`);
  }

  // Generate and insert orders in batches
  console.log('🛒  Generating orders...');

  const batchSize = 100;
  const totalBatches = Math.ceil(ORDER_COUNT / batchSize);
  let insertedCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, ORDER_COUNT);
    const batchSizeActual = batchEnd - batchStart;

    const orders = [];
    for (let i = batchStart; i < batchEnd; i++) {
      orders.push(generateOrder(i));
    }

    await mongoose.connection.db.collection('orders').insertMany(orders);
    insertedCount += batchSizeActual;

    const progress = ((insertedCount / ORDER_COUNT) * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${insertedCount}/${ORDER_COUNT})`);
  }

  console.log('\n');
  console.log(`✅  ${ORDER_COUNT} orders created.\n`);

  // Create indexes
  console.log('📇  Creating indexes...');
  await mongoose.connection.db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
  await mongoose.connection.db.collection('orders').createIndex({ status: 1 });
  await mongoose.connection.db.collection('orders').createIndex({ 'customer.email': 1 });
  await mongoose.connection.db.collection('orders').createIndex({ createdAt: -1 });
  await mongoose.connection.db.collection('orders').createIndex({ total: -1 });
  console.log('✅  Indexes created.\n');

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('  Performance Test Data Generated Successfully!');
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total Orders:     ${ORDER_COUNT}`);
  console.log(`  Duration:         ${duration}s`);
  console.log(`  Batch Size:       ${batchSize}`);
  console.log('');
  console.log('  Order Statistics:');

  // Get order statistics
  const stats = await mongoose.connection.db.collection('orders').aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgTotal: { $avg: '$total' },
        minTotal: { $min: '$total' },
        maxTotal: { $max: '$total' },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  for (const stat of stats) {
    console.log(`    ${stat._id}: ${stat.count} orders (avg: KES ${stat.avgTotal.toFixed(2)})`);
  }

  console.log('');
  console.log('  Payment Methods:');

  const paymentStats = await mongoose.connection.db.collection('orders').aggregate([
    {
      $group: {
        _id: '$payment.method',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  for (const stat of paymentStats) {
    console.log(`    ${stat._id}: ${stat.count} orders`);
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
