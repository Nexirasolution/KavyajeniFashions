import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    storeName: { type: String, default: 'Lakshmibala Clothing Store' },
    logo: { type: String, default: '' },
    whatsapp: { type: String, default: '918524858771' },
    instagram: { type: String, default: 'Lakshmibala_Clothing Store' },
    address: { type: String, default: 'Sivakasi, Virudhunagar Dt, Tamil Nadu' },
    shippingFee: { type: Number, default: 49 },
    freeShippingAbove: { type: Number, default: 999 },
    seoTitle: { type: String, default: 'Lakshmibala Clothing Store - Women Kurtis, Innerwear & More' },
    seoDescription: { type: String, default: 'Shop trendy women kurtis, nighties, 2 piece sets and innerwear online from Lakshmibala Clothing Store, Sivakasi.' }
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
