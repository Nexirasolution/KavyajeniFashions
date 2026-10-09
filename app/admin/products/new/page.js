import ProductForm from '@/components/admin/ProductForm';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Add New Product</h1>
      <ProductForm />
    </div>
  );
}
