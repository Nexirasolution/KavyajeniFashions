import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/apiAuth';

function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

export async function GET(req, { params }) {
  await dbConnect();

  const category = await Category.findOne(getFilter(params.id)).populate('parent', 'name slug');
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  // Active subcategories, used by the storefront to decide: show subcategory grid or show sizes+products
  const subcategories = await Category.find({ parent: category._id, isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });

  return NextResponse.json({ category, subcategories });
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  // Normalize parent: '' or undefined -> null, otherwise validate it exists and isn't itself
  if ('parent' in body) {
    if (!body.parent) {
      body.parent = null;
    } else {
      if (!mongoose.isValidObjectId(body.parent)) {
        return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 });
      }
      const current = await Category.findOne(getFilter(params.id));
      if (current && String(current._id) === String(body.parent)) {
        return NextResponse.json({ error: 'A category cannot be its own parent' }, { status: 400 });
      }
      const parentDoc = await Category.findById(body.parent);
      if (!parentDoc) return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });
    }
  }

  const category = await Category.findOneAndUpdate(getFilter(params.id), body, { new: true });
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  return NextResponse.json({ category });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();

  const category = await Category.findOne(getFilter(params.id));
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const subCount = await Category.countDocuments({ parent: category._id });
  if (subCount > 0) {
    return NextResponse.json(
      { error: 'This category has subcategories. Delete or reassign them first.' },
      { status: 400 }
    );
  }

  await Category.findByIdAndDelete(category._id);
  return NextResponse.json({ success: true });
});