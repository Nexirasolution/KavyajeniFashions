import ProductForm from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Add New Product</h1>
      <ProductForm />
    </div>
  );
}
