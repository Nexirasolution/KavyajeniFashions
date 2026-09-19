/**
 * Run with: npm run seed
 * Creates the first admin account, default categories (from your category list),
 * and default store settings. Safe to re-run - it skips items that already exist.
 */
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env. Add your MongoDB Atlas connection string first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const AdminSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, passwordHash: String, role: String }, { timestamps: true });
  const CategorySchema = new mongoose.Schema({ name: String, slug: { type: String, unique: true }, image: String, description: String, sizes: [String], sortOrder: Number, isActive: Boolean }, { timestamps: true });
  const SettingsSchema = new mongoose.Schema({ key: { type: String, unique: true } }, { strict: false, timestamps: true });

  const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
  const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
  const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

  // 1. Admin account
  const email = (process.env.ADMIN_EMAIL || 'admin@kavyajeninighties.com').toLowerCase();
  const existingAdmin = await Admin.findOne({ email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await Admin.create({ name: 'Admin', email, passwordHash, role: 'owner' });
    console.log(`Created admin account: ${email}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  // 2. Categories (from your handwritten category list)
  const categories = [
    { name: 'Salwar Set', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Rayon Umbrella Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Side Open Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Umbrella Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Nighties', sizes: ['M', 'L', 'XL', 'XXL', 'Free Size'] },
    { name: 'Innerwear', sizes: ['S', 'M', 'L', 'XL'] },
    { name: '2 Piece Set', sizes: ['S', 'M', 'L', 'XL', 'XXL'] }
  ];

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const slug = slugify(c.name, { lower: true });
    const exists = await Category.findOne({ slug });
    if (!exists) {
      await Category.create({ ...c, slug, sortOrder: i, isActive: true });
      console.log(`Created category: ${c.name}`);
    }
  }

  // 3. Default settings
  const existingSettings = await Settings.findOne({ key: 'global' });
  if (!existingSettings) {
    await Settings.create({
      key: 'global',
      storeName: 'Kavyajeni Nighties',
      whatsapp: '918098232385',
      instagram: 'Kavyajeni Nighties',
      address: 'Nagercoil, Kanyakumari District, Tamil Nadu',
      shippingFee: 0,
      freeShippingAbove: 0,
      seoTitle: 'Kavyajeni Nighties - Women Kurtis, Innerwear & More',
      seoDescription: 'Shop trendy women kurtis, rayon umbrella kurtis, side open kurtis, nighties, 2 piece sets and innerwear online from Kavyajeni Nighties, Kanyakumari District.'
    });
    console.log('Created default store settings.');
  }

  console.log('\nSeed complete! Admin login:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);
  console.log('  URL: /admin/login\n');

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
